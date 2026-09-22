import { standardizeCustomerName } from '../utils/indicTransliterator.js';

const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';

const ALLOWED_TRANSACTION_TYPES = [
  'CASH_SALE',
  'CREDIT_SALE',
  'KHATA_REPAYMENT',
  'EXPENSE'
];

const SYSTEM_PROMPT = `You are an expert financial ledger OCR parser for Indian Kirana (grocery/retail) stores.
Your job is to convert raw OCR extracted handwritten or printed ledger text into structured individual transaction drafts.

Supported transaction types (STRICTLY ONE OF THESE 4):
1. CASH_SALE: Cash received for a sale (e.g. "Cash", "Cash sale", "Nagad", "नकद").
2. CREDIT_SALE: Goods/items given on credit/udhar/kadan/baaki to a customer (e.g. "Udhaar", "Baaki", "Kadan", "उधार"). Customer name must be extracted.
3. KHATA_REPAYMENT: Customer repaid/returned past debt/khata/credit (e.g. "wapas diye", "Received", "jama", "chukaya", "वापस दिया"). Customer name must be extracted.
4. EXPENSE: Shop expenses, supplier payouts, distributor stock payment, utility bills, rent, electricity (e.g. "Supplier Payment", "Bijli ka bill", "Expense", "Kharcha", "खर्चा"). Customer name is null or supplier name.

Rules:
1. Parse EVERY identifiable row/entry as an individual item in the transactions array. Preserve original order.
2. Customer Name (CRITICAL): ALWAYS extract and output customer names in standard English / Latin alphabet with Title Case (e.g., "Karan", "Ramesh", "Suresh", "Abhijit", "Vikram"). If written in Hindi/Devanagari, phonetically transliterate to English. Never output Devanagari script for customer names.
3. Amount Normalization:
   - Normalize obvious OCR character confusions in numbers (e.g., "5OO" -> 500, "2,000" -> 2000, "1O00" -> 1000).
   - If amount is missing or unreadable, set amount = 0.
4. Date: Convert any ledger date (e.g., "01-09-24", "01/09/2024", "1 Sep 24") to standard ISO format "YYYY-MM-DD" (e.g. "2024-09-01"). If missing, set transaction_date = null.
5. Ambiguity: If an entry has a customer and amount but unclear type (e.g. "14-09-24 Dinesh 500" without specifying udhar/cash/received), set is_ambiguous = true, transaction_type = null.
6. Output Format:
Respond ONLY with a valid JSON object matching this concise schema without markdown codeblocks or extra conversation text:
{
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD or null",
      "customer_name": "string or null",
      "amount": number,
      "transaction_type": "CASH_SALE" | "CREDIT_SALE" | "KHATA_REPAYMENT" | "EXPENSE" | null,
      "description": "item details or note",
      "is_ambiguous": boolean
    }
  ]
}`;

/**
 * Converts Indic numerals (Devanagari ०-९) to ASCII 0-9
 */
function normalizeIndicDigits(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[०]/g, '0')
    .replace(/[१]/g, '1')
    .replace(/[२]/g, '2')
    .replace(/[३]/g, '3')
    .replace(/[४]/g, '4')
    .replace(/[५]/g, '5')
    .replace(/[६]/g, '6')
    .replace(/[७]/g, '7')
    .replace(/[८]/g, '8')
    .replace(/[९]/g, '9');
}

/**
 * Normalizes common OCR number errors like '5OO' -> 500, '2,000' -> 2000
 */
function normalizeAmount(rawAmount) {
  if (typeof rawAmount === 'number') {
    return Math.abs(rawAmount);
  }
  if (!rawAmount) return 0;

  let str = normalizeIndicDigits(String(rawAmount).trim());
  // Remove currency symbols & spaces
  str = str.replace(/[₹$,\s]/g, '');
  // Replace letter O or o with zero when mixed in digits
  str = str.replace(/([0-9])([Oo]+)/g, (_, d, os) => d + '0'.repeat(os.length));
  str = str.replace(/([Oo]+)([0-9])/g, (_, os, d) => '0'.repeat(os.length) + d);
  // If string contains only '5OO' or '3OO'
  str = str.replace(/^([0-9]+)[Oo]+$/g, (_, d) => d + '00');

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validates or normalizes ISO date format YYYY-MM-DD
 */
function normalizeIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = normalizeIndicDigits(dateStr.trim());
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // Match DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    let [_, day, month, year] = dmyMatch;
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Robust multi-tier JSON extraction & truncated recovery from LLM response text
 */
function extractJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Convert Indic numerals
  let text = normalizeIndicDigits(rawText);

  // 2. Remove markdown code fences
  text = text.replace(/```(?:json|JSON)?([\s\S]*?)```/g, '$1').trim();

  // Helper to remove trailing commas before } or ]
  const sanitizeCommas = (str) => str.replace(/,\s*([}\]])/g, '$1');

  // 3. Try direct parse
  try {
    const direct = JSON.parse(sanitizeCommas(text));
    if (direct) return direct;
  } catch {}

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  // 4. If array starts before object, parse array
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      const candidate = text.slice(firstBracket, lastBracket + 1);
      try {
        const arr = JSON.parse(sanitizeCommas(candidate));
        if (Array.isArray(arr)) {
          return { transactions: arr };
        }
      } catch {}
    }
  }

  // 5. Look for object { ... }
  if (firstBrace !== -1) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try {
        const obj = JSON.parse(sanitizeCommas(candidate));
        if (obj) return obj;
      } catch {}
    }
  }

  // 6. Look for array anywhere
  if (firstBracket !== -1) {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      const candidate = text.slice(firstBracket, lastBracket + 1);
      try {
        const arr = JSON.parse(sanitizeCommas(candidate));
        if (Array.isArray(arr)) {
          return { transactions: arr };
        }
      } catch {}
    }
  }

  // 7. Truncated Recovery: Salvage all complete transaction objects
  try {
    const objectRegex = /\{[^{}]*?"(?:amount|customer_name|transaction_type)"[^{}]*?\}/g;
    const matches = text.match(objectRegex);
    if (matches && matches.length > 0) {
      const items = [];
      for (const m of matches) {
        try {
          const item = JSON.parse(sanitizeCommas(m));
          items.push(item);
        } catch {}
      }
      if (items.length > 0) {
        console.warn(`[ocrTransactionParser] Salvaged ${items.length} transaction objects from truncated response.`);
        return { transactions: items };
      }
    }
  } catch {}

  return null;
}

/**
 * Parses raw OCR text from handwritten or printed ledger into structured transaction drafts.
 *
 * @param {string} text Raw OCR text
 * @returns {Promise<{
 *   success: boolean,
 *   transactions: Array<Object>,
 *   summary: {
 *     total_count: number,
 *     credit_sales_sum: number,
 *     cash_sales_sum: number,
 *     repayments_sum: number,
 *     expenses_sum: number,
 *     needs_review_count: number,
 *     ambiguous_count: number
 *   }
 * }>}
 */
export async function parseOcrText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw Object.assign(new Error('OCR text cannot be empty.'), {
      code: 'EMPTY_OCR_TEXT',
      statusCode: 400
    });
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('SARVAM_API_KEY is not configured on the server.'), {
      code: 'MISSING_API_KEY',
      statusCode: 500
    });
  }

  const cleanText = text.trim();
  console.log(`[ocrTransactionParser] Parsing text (length: ${cleanText.length} chars). Preview: "${cleanText.slice(0, 150).replace(/\n/g, ' ')}"`);

  let response;
  try {
    response = await fetch(SARVAM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Extract transactions from this OCR text:\n\n${cleanText}` }
        ],
        temperature: 0.1,
        max_tokens: 4096, // Prevents truncation on large multi-row ledgers
      })
    });
  } catch (netErr) {
    console.error('[ocrTransactionParser] Network error reaching Sarvam:', netErr.message);
    throw Object.assign(new Error('Could not reach AI OCR parser service. Network error: ' + netErr.message), {
      code: 'OCR_PARSER_NETWORK_ERROR',
      statusCode: 502
    });
  }

  const bodyText = await response.text();

  if (!response.ok) {
    console.error('[ocrTransactionParser] Sarvam API HTTP error:', response.status, bodyText);
    let errorDetail = `Sarvam API error (Status ${response.status})`;
    try {
      const errJson = JSON.parse(bodyText);
      errorDetail = errJson.message || errJson.error?.message || errJson.detail || errorDetail;
    } catch {}

    const safeDetail = errorDetail.replace(apiKey, '***');
    throw Object.assign(new Error(safeDetail), {
      code: 'AI_OCR_PARSER_ERROR',
      statusCode: response.status >= 500 ? 502 : 400
    });
  }

  let rawContent = '';
  try {
    const data = JSON.parse(bodyText);
    rawContent = data.choices?.[0]?.message?.content || '';
  } catch (jsonErr) {
    console.error('[ocrTransactionParser] Failed to parse Sarvam response payload:', bodyText.slice(0, 300));
    throw Object.assign(new Error('Invalid response structure from Sarvam AI service.'), {
      code: 'AI_RESPONSE_PARSE_ERROR',
      statusCode: 502
    });
  }

  console.log(`[ocrTransactionParser] Received AI response (length: ${rawContent.length} chars)`);

  // Robust extraction of JSON payload
  const parsed = extractJsonPayload(rawContent);

  if (!parsed) {
    console.error('[ocrTransactionParser] Could not extract JSON. Raw AI content:\n', rawContent);
    throw Object.assign(new Error('Could not extract structured transactions from OCR text. Raw response was not valid JSON.'), {
      code: 'AI_EXTRACTION_FAILED',
      statusCode: 422,
      raw_content_preview: rawContent.slice(0, 200)
    });
  }

  // Extract array from any recognized top-level key or array
  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (Array.isArray(parsed.transactions)) {
    rawList = parsed.transactions;
  } else if (Array.isArray(parsed.data)) {
    rawList = parsed.data;
  } else if (Array.isArray(parsed.items)) {
    rawList = parsed.items;
  } else if (Array.isArray(parsed.entries)) {
    rawList = parsed.entries;
  } else if (Array.isArray(parsed.records)) {
    rawList = parsed.records;
  } else if (typeof parsed === 'object') {
    if (parsed.amount || parsed.transaction_type || parsed.customer_name) {
      rawList = [parsed];
    }
  }

  const validatedList = [];
  let creditSum = 0;
  let cashSum = 0;
  let repaymentSum = 0;
  let expenseSum = 0;
  let needsReviewCount = 0;
  let ambiguousCount = 0;

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const amount = normalizeAmount(item.amount);

    let type = item.transaction_type ? String(item.transaction_type).toUpperCase().trim() : null;
    if (type && !ALLOWED_TRANSACTION_TYPES.includes(type)) {
      type = null;
    }

    let customerName = standardizeCustomerName(item.customer_name);

    const isoDate = normalizeIsoDate(item.transaction_date);
    let isAmbiguous = Boolean(item.is_ambiguous) || !type;
    let needsReview = Boolean(item.needs_review);
    let reviewReason = item.review_reason || null;

    if (amount <= 0) {
      needsReview = true;
      reviewReason = reviewReason || 'Amount missing or unreadable';
    }

    if (!isoDate) {
      needsReview = true;
      reviewReason = reviewReason || 'Date missing or ambiguous';
    }

    if (isAmbiguous) {
      ambiguousCount++;
    }
    if (needsReview) {
      needsReviewCount++;
    }

    // Accumulate summary numbers
    if (type === 'CREDIT_SALE') creditSum += amount;
    else if (type === 'CASH_SALE') cashSum += amount;
    else if (type === 'KHATA_REPAYMENT') repaymentSum += amount;
    else if (type === 'EXPENSE') expenseSum += amount;

    validatedList.push({
      temp_id: `ocr_tx_${i + 1}`,
      transaction_date: isoDate,
      customer_name: customerName,
      amount,
      transaction_type: type,
      description: item.description ? String(item.description).slice(0, 500) : 'Handwritten ledger entry',
      is_ambiguous: isAmbiguous,
      possible_types: item.possible_types && Array.isArray(item.possible_types) && item.possible_types.length > 0
        ? item.possible_types.filter(t => ALLOWED_TRANSACTION_TYPES.includes(t))
        : ['CREDIT_SALE', 'KHATA_REPAYMENT'],
      needs_review: needsReview,
      review_reason: reviewReason,
      source: 'OCR',
      is_duplicate: false
    });
  }

  if (validatedList.length === 0) {
    throw Object.assign(new Error('No financial transaction rows could be detected from the OCR text.'), {
      code: 'NO_TRANSACTIONS_DETECTED',
      statusCode: 422
    });
  }

  console.log(`[ocrTransactionParser] Successfully parsed ${validatedList.length} transactions.`);

  return {
    success: true,
    transactions: validatedList,
    summary: {
      total_count: validatedList.length,
      credit_sales_sum: creditSum,
      cash_sales_sum: cashSum,
      repayments_sum: repaymentSum,
      expenses_sum: expenseSum,
      needs_review_count: needsReviewCount,
      ambiguous_count: ambiguousCount
    }
  };
}
