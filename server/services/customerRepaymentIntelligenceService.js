import pool from '../config/db.js';

/**
 * Calculates days between two date strings or timestamps.
 * @param {string|Date} date1 
 * @param {string|Date} date2 
 * @returns {number}
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Performs chronological FIFO settlement of repayments against credit transactions.
 *
 * @param {Array<{ id: number, amount: number, transaction_date: string }>} creditTxs
 * @param {Array<{ id: number, amount: number, transaction_date: string }>} repayTxs
 * @returns {{
 *   total_credit: number,
 *   total_repaid: number,
 *   outstanding: number,
 *   credit_transactions: number,
 *   repayment_transactions: number,
 *   settled_credit_count: number,
 *   unsettled_credit_count: number,
 *   recent_credit_count: number,
 *   recent_unrepaid_count: number,
 *   credits_with_settlement: Array<any>
 * }}
 */
export function performFifoSettlement(creditTxs, repayTxs) {
  // Sort ascending by transaction_date then ID
  const sortedCredits = [...creditTxs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date) || a.id - b.id);
  const sortedRepays = [...repayTxs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date) || a.id - b.id);

  const totalCredit = sortedCredits.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalRepaid = sortedRepays.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const outstanding = Math.max(0, totalCredit - totalRepaid);

  let remainingRepaymentPool = totalRepaid;
  const creditsWithSettlement = [];

  for (const ctx of sortedCredits) {
    const amt = parseFloat(ctx.amount || 0);
    if (remainingRepaymentPool >= amt) {
      remainingRepaymentPool -= amt;
      creditsWithSettlement.push({
        ...ctx,
        amount: amt,
        settled_amount: amt,
        unsettled_amount: 0,
        is_settled: true
      });
    } else if (remainingRepaymentPool > 0) {
      const settled = remainingRepaymentPool;
      const unsettled = amt - remainingRepaymentPool;
      remainingRepaymentPool = 0;
      creditsWithSettlement.push({
        ...ctx,
        amount: amt,
        settled_amount: settled,
        unsettled_amount: unsettled,
        is_settled: false
      });
    } else {
      creditsWithSettlement.push({
        ...ctx,
        amount: amt,
        settled_amount: 0,
        unsettled_amount: amt,
        is_settled: false
      });
    }
  }

  const unsettledCredits = creditsWithSettlement.filter(c => !c.is_settled);
  const settledCredits = creditsWithSettlement.filter(c => c.is_settled);

  // Recent 8-10 credit transactions window
  const RECENT_WINDOW = 10;
  const recentCreditSlice = creditsWithSettlement.slice(-RECENT_WINDOW);
  const recentCreditCount = recentCreditSlice.length;
  const recentUnrepaidCount = recentCreditSlice.filter(c => !c.is_settled).length;

  return {
    total_credit: totalCredit,
    total_repaid: totalRepaid,
    outstanding,
    credit_transactions: sortedCredits.length,
    repayment_transactions: sortedRepays.length,
    settled_credit_count: settledCredits.length,
    unsettled_credit_count: unsettledCredits.length,
    recent_credit_count: recentCreditCount,
    recent_unrepaid_count: recentUnrepaidCount,
    credits_with_settlement: creditsWithSettlement
  };
}

/**
 * Analyzes customer repayment behavior dynamically from MySQL transactions.
 * Non-judgmental, purely factual and mathematical.
 *
 * @param {number} merchantId Merchant ID (defaults to 1)
 * @returns {Promise<{
 *   success: boolean,
 *   summary: {
 *     total_customers: number,
 *     customers_with_outstanding: number,
 *     total_outstanding: number,
 *     attention_count: number
 *   },
 *   customers: Array<{
 *     customer_id: number,
 *     name: string,
 *     phone: string|null,
 *     total_credit: number,
 *     total_repaid: number,
 *     outstanding: number,
 *     credit_transactions: number,
 *     repayment_transactions: number,
 *     repayment_rate: number,
 *     last_credit_date: string|null,
 *     last_repayment_date: string|null,
 *     days_since_last_repayment: number|null,
 *     days_since_last_credit: number|null,
 *     recent_credit_count: number,
 *     recent_unrepaid_count: number,
 *     unsettled_credit_count: number,
 *     attention_flag: boolean,
 *     attention_reason: string|null
 *   }>
 * }>}
 */
export async function getCustomerRepaymentIntelligence(merchantId = 1) {
  // 1. Fetch all customers belonging to this merchant
  const [customers] = await pool.query(
    `SELECT id, merchant_id, name, phone, created_at, updated_at
     FROM customers
     WHERE merchant_id = ?
     ORDER BY name ASC`,
    [merchantId]
  );

  // 2. Fetch all transactions for this merchant
  const [txRows] = await pool.query(
    `SELECT id, customer_id, transaction_type, amount, transaction_date, source, description
     FROM transactions
     WHERE merchant_id = ? AND customer_id IS NOT NULL
     ORDER BY transaction_date ASC, id ASC`,
    [merchantId]
  );

  // Group transactions by customer_id
  const txByCustomer = {};
  for (const tx of txRows) {
    if (!txByCustomer[tx.customer_id]) {
      txByCustomer[tx.customer_id] = [];
    }
    txByCustomer[tx.customer_id].push(tx);
  }

  const now = new Date();
  const customerIntelligenceList = [];
  let totalOutstanding = 0;
  let customersWithOutstanding = 0;
  let attentionCount = 0;

  for (const c of customers) {
    const cTxs = txByCustomer[c.id] || [];

    // Filter credit and repayment transactions (CASH_SALE and EXPENSE are strictly ignored for Khata)
    const creditTxs = cTxs.filter(t => t.transaction_type === 'CREDIT_SALE');
    const repayTxs = cTxs.filter(t => t.transaction_type === 'KHATA_REPAYMENT');

    const fifo = performFifoSettlement(creditTxs, repayTxs);
    const { total_credit, total_repaid, outstanding, recent_credit_count, recent_unrepaid_count, unsettled_credit_count } = fifo;

    // Repayment rate: (total repaid / total credit) * 100
    const repaymentRate = total_credit > 0
      ? Math.min(100, Math.round((total_repaid / total_credit) * 100))
      : 0;

    // Dates
    let lastCreditDate = null;
    let daysSinceLastCredit = null;
    if (creditTxs.length > 0) {
      const sortedCredits = [...creditTxs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date) || a.id - b.id);
      const latestCredit = sortedCredits[sortedCredits.length - 1];
      lastCreditDate = String(latestCredit.transaction_date).slice(0, 10);
      daysSinceLastCredit = getDaysDifference(lastCreditDate, now);
    }

    let lastRepaymentDate = null;
    let daysSinceLastRepayment = null;
    if (repayTxs.length > 0) {
      const sortedRepays = [...repayTxs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date) || a.id - b.id);
      const latestRepay = sortedRepays[sortedRepays.length - 1];
      lastRepaymentDate = String(latestRepay.transaction_date).slice(0, 10);
      daysSinceLastRepayment = getDaysDifference(lastRepaymentDate, now);
    }

    // Attention Flag Determination (Factual, non-judgmental)
    let attentionFlag = false;
    let attentionReason = null;

    if (outstanding > 0) {
      customersWithOutstanding++;

      if (repayTxs.length === 0) {
        // No repayment recorded yet
        if (creditTxs.length >= 2 || (daysSinceLastCredit !== null && daysSinceLastCredit >= 14) || outstanding >= 2000) {
          attentionFlag = true;
          attentionReason = `No repayment recorded yet across ${creditTxs.length} credit transaction(s) (₹${outstanding.toLocaleString('en-IN')} outstanding).`;
        }
      } else if (recent_unrepaid_count >= 2 && repaymentRate < 50) {
        attentionFlag = true;
        attentionReason = `${recent_unrepaid_count} of the last ${recent_credit_count} credit transactions remain unsettled (${repaymentRate}% repayment rate, ₹${outstanding.toLocaleString('en-IN')} outstanding).`;
      } else if (recent_unrepaid_count >= 3) {
        attentionFlag = true;
        attentionReason = `${recent_unrepaid_count} of the last ${recent_credit_count} credit transactions remain unsettled (₹${outstanding.toLocaleString('en-IN')} outstanding).`;
      } else if (repaymentRate < 40 && creditTxs.length >= 2 && outstanding >= 1000) {
        attentionFlag = true;
        attentionReason = `Repayment rate of ${repaymentRate}% with ₹${outstanding.toLocaleString('en-IN')} outstanding across ${creditTxs.length} credit transactions.`;
      } else if (daysSinceLastRepayment !== null && daysSinceLastRepayment >= 14 && outstanding >= 500) {
        attentionFlag = true;
        attentionReason = `No repayment recorded in the last ${daysSinceLastRepayment} days (₹${outstanding.toLocaleString('en-IN')} outstanding).`;
      } else if (unsettled_credit_count >= 4) {
        attentionFlag = true;
        attentionReason = `₹${outstanding.toLocaleString('en-IN')} outstanding across ${unsettled_credit_count} unsettled credit transactions.`;
      }
    }

    if (attentionFlag) {
      attentionCount++;
    }

    totalOutstanding += outstanding;

    customerIntelligenceList.push({
      customer_id: c.id,
      name: c.name,
      phone: c.phone || null,
      total_credit,
      total_repaid,
      outstanding,
      credit_transactions: creditTxs.length,
      repayment_transactions: repayTxs.length,
      repayment_rate: repaymentRate,
      last_credit_date: lastCreditDate,
      last_repayment_date: lastRepaymentDate,
      days_since_last_repayment: daysSinceLastRepayment,
      days_since_last_credit: daysSinceLastCredit,
      recent_credit_count,
      recent_unrepaid_count,
      unsettled_credit_count,
      attention_flag: attentionFlag,
      attention_reason: attentionReason,
      recent_transactions: cTxs
        .filter(t => t.transaction_type === 'CREDIT_SALE' || t.transaction_type === 'KHATA_REPAYMENT')
        .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
        .slice(0, 20)
        .map(t => ({
          date: new Date(t.transaction_date).toISOString().slice(0, 10),
          type: t.transaction_type,
          amount: parseFloat(t.amount),
          desc: t.description || ''
        }))
    });
  }

  // Sort by attention flag first, then highest outstanding, then name
  customerIntelligenceList.sort((a, b) => {
    if (a.attention_flag !== b.attention_flag) {
      return a.attention_flag ? -1 : 1;
    }
    return b.outstanding - a.outstanding || a.name.localeCompare(b.name);
  });

  return {
    success: true,
    summary: {
      total_customers: customers.length,
      customers_with_outstanding: customersWithOutstanding,
      total_outstanding: totalOutstanding,
      attention_count: attentionCount
    },
    customers: customerIntelligenceList
  };
}

/**
 * Checks a customer's repayment status and calculates projected outstanding
 * BEFORE a new credit transaction is confirmed.
 *
 * @param {number} merchantId
 * @param {string|number} customerIdentifier Customer Name (string) or Customer ID (number)
 * @param {number} newCreditAmount Proposed additional credit
 * @returns {Promise<{
 *   success: boolean,
 *   customer_exists: boolean,
 *   customer: { id: number|null, name: string, phone: string|null },
 *   current_outstanding: number,
 *   new_credit_amount: number,
 *   projected_outstanding: number,
 *   total_credit: number,
 *   total_repaid: number,
 *   repayment_rate: number,
 *   recent_credit_count: number,
 *   recent_unsettled_count: number,
 *   last_repayment_date: string|null,
 *   days_since_last_repayment: number|null,
 *   show_warning: boolean,
 *   warning_reason: string|null
 * }>}
 */
export async function getCustomerPreCreditCheck(merchantId, customerIdentifier, newCreditAmount = 0) {
  const numAmount = parseFloat(newCreditAmount || 0);

  if (!customerIdentifier) {
    return {
      success: true,
      customer_exists: false,
      customer: { id: null, name: 'Walk-in Customer', phone: null },
      current_outstanding: 0,
      new_credit_amount: numAmount,
      projected_outstanding: numAmount,
      total_credit: 0,
      total_repaid: 0,
      repayment_rate: 0,
      recent_credit_count: 0,
      recent_unsettled_count: 0,
      last_repayment_date: null,
      days_since_last_repayment: null,
      show_warning: false,
      warning_reason: null
    };
  }

  // Find customer in MySQL
  let custRows = [];
  if (typeof customerIdentifier === 'number' || /^\d+$/.test(String(customerIdentifier).trim())) {
    [custRows] = await pool.query(
      'SELECT id, name, phone FROM customers WHERE id = ? AND merchant_id = ? LIMIT 1',
      [parseInt(customerIdentifier, 10), merchantId]
    );
  } else {
    const cleanName = String(customerIdentifier).trim();
    [custRows] = await pool.query(
      'SELECT id, name, phone FROM customers WHERE merchant_id = ? AND LOWER(TRIM(name)) = LOWER(?) LIMIT 1',
      [merchantId, cleanName]
    );
  }

  if (custRows.length === 0) {
    return {
      success: true,
      customer_exists: false,
      customer: { id: null, name: String(customerIdentifier).trim(), phone: null },
      current_outstanding: 0,
      new_credit_amount: numAmount,
      projected_outstanding: numAmount,
      total_credit: 0,
      total_repaid: 0,
      repayment_rate: 0,
      recent_credit_count: 0,
      recent_unsettled_count: 0,
      last_repayment_date: null,
      days_since_last_repayment: null,
      show_warning: false,
      warning_reason: null
    };
  }

  const customer = custRows[0];

  // Fetch all transactions for this customer
  const [txRows] = await pool.query(
    `SELECT id, customer_id, transaction_type, amount, transaction_date, source, description
     FROM transactions
     WHERE merchant_id = ? AND customer_id = ?
     ORDER BY transaction_date ASC, id ASC`,
    [merchantId, customer.id]
  );

  const creditTxs = txRows.filter(t => t.transaction_type === 'CREDIT_SALE');
  const repayTxs = txRows.filter(t => t.transaction_type === 'KHATA_REPAYMENT');

  const fifo = performFifoSettlement(creditTxs, repayTxs);
  const projectedOutstanding = fifo.outstanding + numAmount;
  const repaymentRate = fifo.total_credit > 0
    ? Math.min(100, Math.round((fifo.total_repaid / fifo.total_credit) * 100))
    : 0;

  const now = new Date();
  let lastRepaymentDate = null;
  let daysSinceLastRepayment = null;
  if (repayTxs.length > 0) {
    const sortedRepays = [...repayTxs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date) || a.id - b.id);
    const latestRepay = sortedRepays[sortedRepays.length - 1];
    lastRepaymentDate = String(latestRepay.transaction_date).slice(0, 10);
    daysSinceLastRepayment = getDaysDifference(lastRepaymentDate, now);
  }

  // Pre-credit warning logic:
  // If customer has existing outstanding (> 0) or unsettled credits, flag advisory warning
  let showWarning = false;
  let warningReason = null;

  if (fifo.outstanding > 0 || fifo.unsettled_credit_count > 0) {
    showWarning = true;
    if (repayTxs.length === 0) {
      warningReason = `Customer has ₹${fifo.outstanding.toLocaleString('en-IN')} current outstanding across ${fifo.credit_transactions} credit transaction(s) with no recorded repayments.`;
    } else if (fifo.recent_unrepaid_count >= 2 && repaymentRate < 50) {
      warningReason = `${fifo.recent_unrepaid_count} of the last ${fifo.recent_credit_count} credit transactions remain unsettled (${repaymentRate}% repayment rate, ₹${fifo.outstanding.toLocaleString('en-IN')} current outstanding).`;
    } else if (fifo.recent_unrepaid_count >= 2) {
      warningReason = `${fifo.recent_unrepaid_count} of the last ${fifo.recent_credit_count} credit transactions remain unsettled (₹${fifo.outstanding.toLocaleString('en-IN')} current outstanding).`;
    } else if (daysSinceLastRepayment !== null && daysSinceLastRepayment >= 14) {
      warningReason = `No repayment recorded in the last ${daysSinceLastRepayment} days (₹${fifo.outstanding.toLocaleString('en-IN')} current outstanding).`;
    } else {
      warningReason = `Customer has ₹${fifo.outstanding.toLocaleString('en-IN')} current outstanding across ${fifo.unsettled_credit_count} unsettled credit transaction(s).`;
    }
  }

  return {
    success: true,
    customer_exists: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || null
    },
    current_outstanding: fifo.outstanding,
    new_credit_amount: numAmount,
    projected_outstanding: projectedOutstanding,
    total_credit: fifo.total_credit,
    total_repaid: fifo.total_repaid,
    repayment_rate: repaymentRate,
    recent_credit_count: fifo.recent_credit_count,
    recent_unsettled_count: fifo.recent_unrepaid_count,
    last_repayment_date: lastRepaymentDate,
    days_since_last_repayment: daysSinceLastRepayment,
    show_warning: showWarning,
    warning_reason: warningReason
  };
}

