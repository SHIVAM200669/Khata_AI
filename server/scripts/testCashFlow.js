import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;

const SYSTEM_PROMPT = `You are an expert financial transaction semantic parser for Indian Kirana (grocery/retail) stores.
Your job is to convert spoken transcripts (in Hindi, English, Tamil, Telugu, Hinglish, Tanglish, or any code-mixed Indic language) into structured financial transactions.

CRITICAL CASH-FLOW DISTINCTIONS:
Do NOT treat every "diya" / "gave" sentence as CREDIT_SALE. You must distinguish:

1. Credit sale of goods (CREDIT_SALE, is_cash_loan=false):
   - Merchant gave goods/items/groceries on credit/udhar/kadan to a customer.
   - Examples: "Ramesh ko 2000 ka maal udhaar diya", "Suresh ko ration udhar diya", "Ramesh-ku 500 kadan kuduthen (goods)".
   - Cash register: NO CHANGE. Customer khata receivable: +amount.

2. Money/Payment given to supplier/vendor/bills/expense (EXPENSE):
   - Merchant paid money to a supplier, distributor, utility bill, rent, staff, tea/snacks.
   - Examples: "Supplier ko 2000 rupaye diye", "Vendor ko payment diya", "Bijli ka bill 1500 diya", "Chai biscuit ka 50 diya".
   - Cash register: -amount.

3. Cash/Money lent to a person (CREDIT_SALE with is_cash_loan=true):
   - Merchant lent physical cash/money to a person as a loan/udhar.
   - Examples: "Maine Mohan ko 2000 rupaye udhaar diye", "Mohan ko 2000 cash udhar diya", "Gave 2000 cash loan to Mohan".
   - Cash register: -amount. Customer khata receivable: +amount.

4. Khata Repayment (KHATA_REPAYMENT):
   - Customer paid back previous debt/udhar/khata.
   - Examples: "Ramesh ne 2000 rupaye wapas diye", "Ramesh gave back 2000 khata", "Mohan paid back 500".
   - Cash register: +amount. Outstanding khata: -amount.

5. Cash Sale (CASH_SALE):
   - Cash received for a sale at the counter.
   - Examples: "Aaj 2000 rupaye ki cash sale hui", "1000 cash mila".
   - Cash register: +amount.

Ambiguity:
- If a sentence is genuinely ambiguous (e.g., "Ramesh ko 500 rupaye diye" -> could be cash loan, repayment to supplier, or gift), set is_ambiguous=true, possible_types=["CREDIT_SALE", "EXPENSE", "KHATA_REPAYMENT"], and ask clarification.

Output format (Raw JSON only, no markdown):
{
  "transactions": [
    {
      "customer_name": "string or null",
      "amount": number,
      "transaction_type": "CASH_SALE" | "CREDIT_SALE" | "KHATA_REPAYMENT" | "EXPENSE" | null,
      "is_cash_loan": boolean,
      "description": "short description"
    }
  ],
  "is_ambiguous": boolean,
  "possible_types": ["CREDIT_SALE", "EXPENSE", "KHATA_REPAYMENT"],
  "clarification_question": "string or null"
}`;

async function test(text) {
  const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      model: 'sarvam-105b-conversations',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcript: "${text}"` }
      ],
      temperature: 0.1,
    })
  });
  const data = await res.json();
  console.log('\n=== TRANSCRIPT:', text);
  console.log('OUTPUT:', data.choices?.[0]?.message?.content);
}

async function run() {
  await test("Ramesh ko 2000 ka maal udhaar diya");
  await test("Supplier ko 2000 rupaye diye");
  await test("Maine Mohan ko 2000 rupaye udhaar diye");
  await test("Ramesh ne 2000 rupaye wapas diye");
  await test("Aaj 2000 rupaye ki cash sale hui");
}

run();
