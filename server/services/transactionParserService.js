import { standardizeCustomerName } from '../utils/indicTransliterator.js';

const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';

const ALLOWED_TRANSACTION_TYPES = [
  'CASH_SALE',
  'CREDIT_SALE',
  'KHATA_REPAYMENT',
  'EXPENSE'
];

const SYSTEM_PROMPT = `You are an expert financial transaction semantic parser for Indian Kirana (grocery/retail) stores.
Your job is to convert spoken transcripts (in Hindi, English, Tamil, Telugu, Hinglish, Tanglish, or any code-mixed Indic language) into structured financial transactions.

CRITICAL CUSTOMER NAME STANDARDIZATION RULE:
- ALWAYS write customer and party names in standard English / Latin alphabet with Title Case (e.g. "Karan", "Ramesh", "Suresh", "Abhijit", "Vikram", "Gupta Ji", "Mohan").
- NEVER return customer names in Devanagari, Hindi, Tamil, or Indic scripts. Phonetically transliterate them to standard English (e.g., "करण" -> "Karan", "रमेश" -> "Ramesh", "सुरेश" -> "Suresh").

CRITICAL CASH-FLOW DISTINCTIONS:
Do NOT treat every "diya" / "gave" / "giving" / "give" sentence as CREDIT_SALE. You must understand full semantic context:

1. Credit sale of goods to a customer (CREDIT_SALE with is_cash_loan=false):
   - Merchant gave goods/items/groceries/maal on credit/udhar/kadan to a retail customer.
   - Examples: "Ramesh ko 2000 ka maal udhaar diya", "Suresh ko ration udhar diya", "Ramesh-ku 500 kadan kuduthen (goods)".
   - Cash register: NO CHANGE. Customer khata receivable: +amount.

2. Money/Payment given to supplier/vendor/distributor/company/brand/bills/expense (EXPENSE):
   - Merchant paid or scheduled payment of money to a supplier, distributor, dairy, brand, wholesaler, company, utility bill, rent, staff, tea/maintenance.
   - Company/Brand/Supplier keywords: "foods", "co", "and co", "ltd", "agency", "distributor", "wholesaler", "supplier", "dairy", "traders", "enterprises", "amul", "britannia", "nestle", "parle", "hul", "itc", "tata", "mother dairy".
   - Examples: "i am give amul foods and co 500 rs in 23 sept", "amul foods and co ko 500 rs diye 23 sept", "Supplier ko 2000 rupaye diye", "Vendor ko payment diya", "Bijli ka bill 1500 diya", "Chai biscuit ka 50 diya".
   - Cash register: -amount (outflow).
   - If an explicit future date is mentioned (e.g., "23 sept", "23 September", "kal"), extract explicit_date as YYYY-MM-DD.

3. Cash/Money lent to a person (CREDIT_SALE with is_cash_loan=true):
   - Merchant gave/lent physical cash or money to a person as a loan/udhar.
   - Examples: "Maine Mohan ko 2000 rupaye udhaar diye", "Mohan ko 2000 cash udhar diya", "Lent 2000 cash to Mohan".
   - Cash register: -amount. Customer khata receivable: +amount.

4. Khata Repayment (KHATA_REPAYMENT):
   - Customer paid back previous debt/udhar/khata.
   - Examples: "Ramesh ne 2000 rupaye wapas diye", "Ramesh gave back 2000 khata", "Mohan paid back 500", "Karan ne 8225 jama kiya".
   - Cash register: +amount. Outstanding khata: -amount.

5. Cash Sale (CASH_SALE):
   - Cash received for a sale at the counter.
   - Examples: "Aaj 2000 rupaye ki cash sale hui", "1000 cash mila", "Sold groceries for 800 cash".
   - Cash register: +amount.

DATE HANDLING RULES:
- TODAY'S DATE: {TODAY_DATE}. Use this as your reference point for all date calculations.
- If the merchant explicitly mentions a FULL date (day + month) in the speech (e.g., "23 sept", "23 September", "20 September ko", "15 August ko", "10 September 2026"): extract the date in "YYYY-MM-DD" format as "explicit_date".
- If the merchant mentions ONLY a day number or "तारीख" (tarikh) WITHOUT a month (e.g., "22 तारीख को", "23 ko", "25 ko"): assume the CURRENT month ({CURRENT_MONTH_YEAR}) and extract as "YYYY-MM-DD". If the day has already passed this month, assume next month.
- If the merchant mentions a relative day (e.g., "kal", "parson", "aaj"): resolve relative to TODAY'S DATE and extract as "YYYY-MM-DD".
- If the merchant does NOT explicitly mention any date in the speech (e.g., "Maine Abhijit ko 5000 rupaye udhaar diye", "Ramesh ne 200 wapas diye"): set "explicit_date": null. DO NOT invent, hallucinate, or assume any date.
- CRITICAL: Do NOT confuse amounts with dates. "15000" is an amount, NOT "15th". "2000 rupaye" is an amount, NOT a date.

Ambiguity:
- If a sentence is genuinely ambiguous regarding intent or transaction type (e.g., "Ramesh ko 500 rupaye diye" without context whether it's loan, supplier payment, or expense), set is_ambiguous=true, transaction_type=null, possible_types=["CREDIT_SALE", "EXPENSE", "KHATA_REPAYMENT"], and provide clarification_question.

Multiple Transactions:
- If the transcript contains multiple distinct transactions, extract all of them into the "transactions" array.

Output format (Raw JSON only, no markdown):
{
  "transactions": [
    {
      "customer_name": "string or null",
      "amount": number,
      "transaction_type": "CASH_SALE" | "CREDIT_SALE" | "KHATA_REPAYMENT" | "EXPENSE" | null,
      "is_cash_loan": boolean,
      "description": "short description",
      "explicit_date": "YYYY-MM-DD or null"
    }
  ],
  "is_ambiguous": boolean,
  "possible_types": ["CREDIT_SALE", "EXPENSE", "KHATA_REPAYMENT"],
  "clarification_question": "string or null"
}`;

/**
 * Parses a voice transcript into structured transaction drafts using Sarvam LLM.
 *
 * @param {string} transcript Spoken transcript text
 * @returns {Promise<{
 *   transactions: Array<{
 *     customer_name: string|null,
 *     amount: number,
 *     transaction_type: string|null,
 *     is_cash_loan: boolean,
 *     description: string,
 *     timestamp: string,
 *     transaction_date: string,
 *     has_explicit_date: boolean,
 *     source: string
 *   }>,
 *   is_ambiguous: boolean,
 *   possible_types: string[],
 *   clarification_question: string|null
 * }>}
 */
export async function parseTransactionTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw Object.assign(new Error('Transcript text cannot be empty.'), {
      code: 'EMPTY_TRANSCRIPT',
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

  const cleanTranscript = transcript.trim();

  // Build dynamic system prompt with today's actual date injected
  const promptNow = new Date();
  const todayISO = promptNow.toISOString().slice(0, 10);
  const promptMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentMonthYear = `${promptMonthNames[promptNow.getMonth()]} ${promptNow.getFullYear()}`;
  const dynamicPrompt = SYSTEM_PROMPT
    .replace('{TODAY_DATE}', todayISO)
    .replaceAll('{CURRENT_MONTH_YEAR}', currentMonthYear);

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
          { role: 'system', content: dynamicPrompt },
          { role: 'user', content: `Transcript: "${cleanTranscript}"` }
        ],
        temperature: 0.1,
      })
    });
  } catch (netErr) {
    console.error('[transactionParser] Network error:', netErr.message);
    throw Object.assign(new Error('Could not reach transaction parser service.'), {
      code: 'PARSER_NETWORK_ERROR',
      statusCode: 502
    });
  }

  const bodyText = await response.text();

  if (!response.ok) {
    console.error('[transactionParser] API error:', response.status, bodyText);
    const safeDetail = bodyText.replace(apiKey, '***');
    throw Object.assign(new Error('AI parsing service failed: ' + safeDetail), {
      code: 'AI_PARSER_ERROR',
      statusCode: response.status >= 500 ? 502 : 400
    });
  }

  let rawContent = '';
  try {
    const data = JSON.parse(bodyText);
    rawContent = data.choices?.[0]?.message?.content || '';
  } catch (jsonErr) {
    throw Object.assign(new Error('Failed to parse AI response payload.'), {
      code: 'AI_RESPONSE_PARSE_ERROR',
      statusCode: 502
    });
  }

  // Extract JSON from response text (handling possible ```json ... ``` wrapper)
  let parsed;
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in AI response.');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[transactionParser] JSON parsing error on text:', rawContent);
    throw Object.assign(new Error('Could not extract structured transaction from transcript.'), {
      code: 'AI_EXTRACTION_FAILED',
      statusCode: 422
    });
  }

  // Backend dynamic server date (Source of Truth for Today's date/time)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDateStr = `${year}-${month}-${day}`;
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const currentTimestampStr = `${todayDateStr} ${nowTimeStr}`;
  const isoTimestamp = now.toISOString();

  const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const isAmbiguous = Boolean(parsed.is_ambiguous);
  const possibleTypes = Array.isArray(parsed.possible_types)
    ? parsed.possible_types.filter(t => ALLOWED_TRANSACTION_TYPES.includes(t))
    : [];
  const clarificationQuestion = parsed.clarification_question || null;

  // Validate and sanitize each transaction
  const validatedTransactions = [];

  for (const item of rawTransactions) {
    // Sanitize amount
    const numAmount = typeof item.amount === 'number'
      ? Math.abs(item.amount)
      : parseFloat(String(item.amount || '0').replace(/[^0-9.]/g, ''));

    if (isNaN(numAmount) || numAmount <= 0) {
      throw Object.assign(new Error('Transaction amount must be a positive number.'), {
        code: 'INVALID_AMOUNT',
        statusCode: 422
      });
    }

    // Validate type if not ambiguous
    let type = item.transaction_type ? String(item.transaction_type).toUpperCase().trim() : null;
    if (type && !ALLOWED_TRANSACTION_TYPES.includes(type)) {
      type = null;
    }

    // Customer name - standardizing to clean English Title Case
    let customerName = standardizeCustomerName(item.customer_name);
    if ((type === 'CREDIT_SALE' || type === 'KHATA_REPAYMENT') && !customerName) {
      customerName = 'Walk-in Customer';
    }

    const isCashLoan = Boolean(item.is_cash_loan);

    // DATE RULE:
    // If merchant explicitly mentioned a date (explicit_date is a valid YYYY-MM-DD):
    // Use that date.
    // If NO explicit date mentioned: Automatically use TODAY'S actual backend/server date.
    // GUARDRAIL: If transcript contains "आज" (today) or no real date tokens,
    // the LLM-returned explicit_date is discarded to prevent hallucination
    // (e.g., LLM confusing amount "15,000" with "January 15").
    let finalTxDate = currentTimestampStr;
    let hasExplicitDate = false;

    if (item.explicit_date && typeof item.explicit_date === 'string') {
      const match = item.explicit_date.trim().match(/^\d{4}-\d{2}-\d{2}/);
      if (match) {
        const llmDate = match[0];

        // Cross-validate: Does the transcript ACTUALLY mention a date?
        const lowerTranscript = cleanTranscript.toLowerCase();

        // "आज" / "aaj" / "today" means TODAY — override any LLM date to server today
        const todayWords = /\b(आज|aaj|today)\b/i;
        const hasTodayWord = todayWords.test(cleanTranscript);

        // Check for real date references in transcript
        // 1. Standalone month names in English (e.g., "September", "sep")
        // 2. Hindi month names in Devanagari (e.g., "सितंबर") — multiple spellings
        // 3. Romanized Hindi month names (e.g., "sitambar", "sitamber") — Sarvam STT often transcribes this way
        // 4. DD/MM/YYYY or DD-MM-YYYY patterns
        // 5. Relative date words (kal, parson, etc.)
        // 6. Hindi temporal markers (तारीख, तारिख)
        const monthNames = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;
        const hindiMonthNames = /(जनवरी|फ[रे]वरी|मार्च|अप्र[ैे]ल|मई|जून|जुलाई|अगस्त|सित[मं][्ब]र|सितम्बर|अक्[तट][ूु]बर|नव[मं][्ब]र|नवम्बर|दिस[मं][्ब]र|दिसम्बर)/;
        const romanHindiMonths = /\b(janvari|farvari|march|aprail|aprel|mai|june|julai|agast|sitambar|sitamber|sitamber|aktubar|aktobar|navambar|navamber|disambar|disamber)\b/i;
        const datePatterns = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/;
        const relativeDays = /\b(kal|parson|parso|कल|परसों|परसो|अगले|पिछले)\b/i;
        const hindiDateMarkers = /(तारीख|तारिख)/;

        const hasRealDateRef =
          monthNames.test(cleanTranscript)
          || hindiMonthNames.test(cleanTranscript)
          || romanHindiMonths.test(cleanTranscript)
          || datePatterns.test(cleanTranscript)
          || relativeDays.test(cleanTranscript)
          || hindiDateMarkers.test(cleanTranscript);

        console.log(`[transactionParser] Date guardrail: LLM date=${llmDate}, todayWord=${hasTodayWord}, realDateRef=${hasRealDateRef}, transcript="${cleanTranscript.slice(0, 100)}"`);

        if (hasTodayWord) {
          // Merchant said "today" — use server date, not LLM date
          console.log(`[transactionParser] Transcript says "today" but LLM returned ${llmDate}. Using server date: ${todayDateStr}`);
          finalTxDate = currentTimestampStr;
          hasExplicitDate = false;
        } else if (!hasRealDateRef && llmDate !== todayDateStr) {
          // LLM returned a date but transcript has no date-like words — likely hallucinated from amount
          console.log(`[transactionParser] No date reference in transcript but LLM returned ${llmDate}. Discarding hallucinated date, using server date: ${todayDateStr}`);
          finalTxDate = currentTimestampStr;
          hasExplicitDate = false;
        } else {
          // Transcript has a real date reference — trust the LLM
          finalTxDate = `${llmDate} 12:00:00`;
          hasExplicitDate = true;
        }
      }
    }

    validatedTransactions.push({
      customer_name: customerName,
      amount: numAmount,
      transaction_type: type,
      is_cash_loan: isCashLoan,
      description: item.description ? String(item.description).slice(0, 500) : (isCashLoan ? 'Cash loan given' : 'Voice recorded transaction'),
      timestamp: isoTimestamp,
      transaction_date: finalTxDate,
      has_explicit_date: hasExplicitDate,
      source: 'VOICE'
    });
  }

  if (validatedTransactions.length === 0) {
    throw Object.assign(new Error('No financial transaction could be detected from the voice transcript.'), {
      code: 'NO_TRANSACTION_DETECTED',
      statusCode: 422
    });
  }

  return {
    success: true,
    transcript: cleanTranscript,
    transactions: validatedTransactions,
    is_ambiguous: isAmbiguous || validatedTransactions.some(t => !t.transaction_type),
    possible_types: possibleTypes.length > 0 ? possibleTypes : ['CREDIT_SALE', 'KHATA_REPAYMENT', 'CASH_SALE', 'EXPENSE'],
    clarification_question: clarificationQuestion || (isAmbiguous ? 'Please specify the exact transaction type:' : null)
  };
}
