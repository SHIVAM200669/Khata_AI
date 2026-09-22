import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;

const sampleOcrText = `01-09-24 Ramesh Sugar 2kg, Tea 1pkt 500 Udhaar
02-09-24 Suresh Atta 5kg 300 Cash
03-09-24 Mohan Dal 2kg 400 Udhaar
05-09-24 Ramesh 500 wapas diye 500 Received
12-09-24 Supplier Payment for stock 2,000 Expense
13-09-24 Electricity Bijli ka bill 1,500 Expense
14-09-24 Dinesh 500
15-09-24 Rajesh Rice 10kg 5OO Udhaar`;

const OCR_PARSER_SYSTEM_PROMPT = `You are an expert financial ledger OCR parser for Indian Kirana (grocery) stores.
Your job is to convert raw OCR extracted handwritten or printed ledger text into structured individual transaction drafts.

Supported transaction types (STRICTLY ONE OF THESE 4):
1. CASH_SALE: Cash received for a sale (e.g. "Cash", "Cash sale", "Nagad").
2. CREDIT_SALE: Goods/items given on credit/udhar/kadan/baaki to a customer (e.g. "Udhaar", "Baaki", "Kadan"). Customer name must be extracted.
3. KHATA_REPAYMENT: Customer paid back past debt/khata/credit (e.g. "wapas diye", "Received", "jama", "chukaya"). Customer name must be extracted.
4. EXPENSE: Shop expenses, supplier payouts, distributor stock payment, utility bills, rent, electricity (e.g. "Supplier Payment", "Bijli ka bill", "Expense", "Kharcha"). Customer name is null or supplier name.

Rules:
1. Parse EVERY identifiable row/entry as an individual item in the transactions array. Preserve original order.
2. Customer Name: Extract the customer or party name if present (e.g. "Suresh Atta 5kg 300 Cash" -> customer_name: "Suresh", description: "Atta 5kg").
3. Amount: Extract the exact numerical amount in rupees (e.g. 500, 300, 2000).
   - Normalize OCR character confusions (e.g., "5OO" -> 500, "2,000" -> 2000, "1O00" -> 1000).
   - If amount is completely missing or illegible, set amount = 0, needs_review = true, review_reason = "Amount missing or unreadable".
4. Date: Convert any ledger date (e.g., "01-09-24", "01/09/2024", "1 Sep 24") to standard ISO format "YYYY-MM-DD" (e.g. "2024-09-01").
   - If date is missing from a line, set transaction_date = null and needs_review = true.
5. Ambiguity: If an entry has a customer and amount but unclear type (e.g. "14-09-24 Dinesh 500" without specifying udhar/cash/received), set is_ambiguous = true, transaction_type = null, possible_types = ["CREDIT_SALE", "KHATA_REPAYMENT"], amount = 500, needs_review = false.
6. Respond ONLY with a valid JSON object matching this schema:
{
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD or null",
      "customer_name": "string or null",
      "amount": number,
      "transaction_type": "CASH_SALE" | "CREDIT_SALE" | "KHATA_REPAYMENT" | "EXPENSE" | null,
      "description": "item details or note",
      "is_ambiguous": boolean,
      "possible_types": ["CREDIT_SALE", "KHATA_REPAYMENT"],
      "needs_review": boolean,
      "review_reason": "string or null",
      "source": "OCR"
    }
  ]
}`;

async function testOcrParser() {
  console.log('Sending sample OCR text to Sarvam LLM for semantic parsing...');
  const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model: 'sarvam-105b-conversations',
      messages: [
        { role: 'system', content: OCR_PARSER_SYSTEM_PROMPT },
        { role: 'user', content: `Extract transactions from OCR text:\n\n${sampleOcrText}` }
      ],
      temperature: 0.1,
    })
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  console.log('OUTPUT:\n', content);
}

testOcrParser();
