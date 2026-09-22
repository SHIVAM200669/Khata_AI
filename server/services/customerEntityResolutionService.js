import pool from '../config/db.js';
import {
  standardizeCustomerName,
  isCustomerNameMatch,
  normalizeNameTokens
} from '../utils/indicTransliterator.js';

/**
 * Resolves a spoken, OCR-scanned, or typed customer name against the merchant's
 * customer ledger in MySQL.
 *
 * Guaranteed Safety Rules:
 * 1. Strictly scoped to req.user.merchantId.
 * 2. EXACT_MATCH: Returned ONLY when exactly 1 customer matches the full/unique name.
 * 3. AMBIGUOUS_MATCH: Returned when multiple candidates match (e.g. "Karan" matches "Karan Rashtodi" & "Karan Verma").
 *    NEVER automatically selects a candidate. Returns all matches with distinguishing metadata.
 * 4. NO_MATCH: Returned when zero candidates match.
 *
 * @param {number} merchantId Authenticated merchant ID
 * @param {string} rawNameOrQuery Raw customer name or phrase
 * @returns {Promise<{
 *   status: 'EXACT_MATCH' | 'AMBIGUOUS_MATCH' | 'NO_MATCH',
 *   query_name: string,
 *   standardized_name: string,
 *   customer: object | null,
 *   matches: Array<{
 *     id: number,
 *     name: string,
 *     phone: string|null,
 *     outstanding: number,
 *     total_credit: number,
 *     total_repaid: number,
 *     last_transaction_date: string|null,
 *     transaction_count: number
 *   }>,
 *   message: string
 * }>}
 */
export async function resolveCustomerEntity(merchantId, rawNameOrQuery) {
  if (!merchantId) {
    throw new Error('Merchant ID is required for customer entity resolution.');
  }

  if (!rawNameOrQuery || typeof rawNameOrQuery !== 'string' || !rawNameOrQuery.trim()) {
    return {
      status: 'NO_MATCH',
      query_name: '',
      standardized_name: '',
      customer: null,
      matches: [],
      message: 'No customer name provided.'
    };
  }

  const queryInfo = normalizeNameTokens(rawNameOrQuery);
  const standardizedQuery = queryInfo.standardized;
  const cleanQuery = queryInfo.clean;
  const firstToken = queryInfo.firstToken;

  // 1. Fetch all customers for this merchant from MySQL
  const [customers] = await pool.query(
    'SELECT id, merchant_id, name, phone, created_at FROM customers WHERE merchant_id = ? ORDER BY id ASC',
    [merchantId]
  );

  if (customers.length === 0) {
    return {
      status: 'NO_MATCH',
      query_name: rawNameOrQuery,
      standardized_name: standardizedQuery,
      customer: null,
      matches: [],
      message: `I couldn't find "${standardizedQuery}" in your customers. Do you want to create a new customer named "${standardizedQuery}"?`
    };
  }

  // 2. Fetch all transactions for these customers to attach live ledger context
  const [transactions] = await pool.query(
    `SELECT customer_id, transaction_type, amount, transaction_date
     FROM transactions
     WHERE merchant_id = ? AND customer_id IS NOT NULL`,
    [merchantId]
  );

  const txByCustomer = {};
  for (const t of transactions) {
    if (!txByCustomer[t.customer_id]) {
      txByCustomer[t.customer_id] = [];
    }
    txByCustomer[t.customer_id].push(t);
  }

  // Enrich customer records with ledger metadata
  const enrichedCustomers = customers.map(c => {
    const cTxs = txByCustomer[c.id] || [];
    let totalCredit = 0;
    let totalRepaid = 0;
    let lastTxDate = null;

    for (const t of cTxs) {
      const amt = parseFloat(t.amount || 0);
      if (t.transaction_type === 'CREDIT_SALE') totalCredit += amt;
      else if (t.transaction_type === 'KHATA_REPAYMENT') totalRepaid += amt;

      const txDate = t.transaction_date ? String(t.transaction_date).slice(0, 10) : null;
      if (txDate && (!lastTxDate || txDate > lastTxDate)) {
        lastTxDate = txDate;
      }
    }

    const outstanding = Math.max(0, totalCredit - totalRepaid);
    const cTokens = normalizeNameTokens(c.name);

    return {
      id: c.id,
      name: c.name,
      standardized_name: cTokens.standardized,
      tokens: cTokens.tokens,
      firstToken: cTokens.firstToken,
      phone: c.phone || null,
      outstanding,
      total_credit: totalCredit,
      total_repaid: totalRepaid,
      last_transaction_date: lastTxDate,
      transaction_count: cTxs.length
    };
  });

  // 3. Step A: Check for EXACT FULL NAME MATCH
  const exactMatches = enrichedCustomers.filter(c => {
    return isCustomerNameMatch(c.name, standardizedQuery) ||
           c.tokens.join(' ') === queryInfo.tokens.join(' ');
  });

  if (exactMatches.length === 1) {
    const single = exactMatches[0];
    return {
      status: 'EXACT_MATCH',
      query_name: rawNameOrQuery,
      standardized_name: standardizedQuery,
      customer: {
        id: single.id,
        name: single.name,
        phone: single.phone,
        outstanding: single.outstanding,
        total_credit: single.total_credit,
        total_repaid: single.total_repaid,
        last_transaction_date: single.last_transaction_date,
        transaction_count: single.transaction_count
      },
      matches: exactMatches.map(m => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        outstanding: m.outstanding,
        total_credit: m.total_credit,
        total_repaid: m.total_repaid,
        last_transaction_date: m.last_transaction_date,
        transaction_count: m.transaction_count
      })),
      message: `Exact match found for ${single.name}.`
    };
  }

  // 4. Step B: Candidate Matching (First Name, Prefix, or Token Overlap)
  // E.g., Query is "Karan" / "करण" -> matches both "Karan Rashtodi" and "Karan Verma"
  const candidateMatches = enrichedCustomers.filter(c => {
    // 1. First token matches (e.g., "Karan" matches "Karan Verma" and "Karan Rashtodi")
    if (firstToken && c.firstToken && (firstToken === c.firstToken || isCustomerNameMatch(firstToken, c.firstToken))) {
      return true;
    }
    // 2. Query tokens are a subset of customer tokens
    if (queryInfo.tokens.length > 0 && queryInfo.tokens.every(qt => c.tokens.some(ct => ct === qt || isCustomerNameMatch(ct, qt)))) {
      return true;
    }
    // 3. Customer name starts with or includes the query name
    if (cleanQuery && c.tokens.join(' ').includes(cleanQuery)) {
      return true;
    }
    return false;
  });

  if (candidateMatches.length > 1) {
    // AMBIGUOUS: Multiple existing customers match
    const formattedCandidates = candidateMatches.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      outstanding: m.outstanding,
      total_credit: m.total_credit,
      total_repaid: m.total_repaid,
      last_transaction_date: m.last_transaction_date,
      transaction_count: m.transaction_count
    }));

    return {
      status: 'AMBIGUOUS_MATCH',
      query_name: rawNameOrQuery,
      standardized_name: standardizedQuery,
      customer: null,
      matches: formattedCandidates,
      candidates: formattedCandidates,
      message: `I found multiple customers named ${standardizedQuery} (${candidateMatches.map(c => c.name).join(', ')}). Please select which ${standardizedQuery} you mean.`
    };
  }

  if (candidateMatches.length === 1) {
    // Single candidate found
    const single = candidateMatches[0];
    const singleData = {
      id: single.id,
      name: single.name,
      phone: single.phone,
      outstanding: single.outstanding,
      total_credit: single.total_credit,
      total_repaid: single.total_repaid,
      last_transaction_date: single.last_transaction_date,
      transaction_count: single.transaction_count
    };

    return {
      status: 'EXACT_MATCH',
      query_name: rawNameOrQuery,
      standardized_name: standardizedQuery,
      customer: singleData,
      matches: [singleData],
      candidates: [singleData],
      message: `Matched to ${single.name}.`
    };
  }

  // 5. Step C: Zero Matches (NO_MATCH)
  return {
    status: 'NO_MATCH',
    query_name: rawNameOrQuery,
    standardized_name: standardizedQuery,
    customer: null,
    matches: [],
    candidates: [],
    message: `I couldn't find "${standardizedQuery}" in your customers. Do you want to create a new customer named "${standardizedQuery}"?`
  };
}
