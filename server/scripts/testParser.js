import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;

const SYSTEM_PROMPT = `You are an AI financial transaction parser for Indian Kirana (grocery) stores.
Convert spoken store transcripts (in Hindi, English, Tamil, Hinglish, Tanglish, code-mixed) into structured JSON.

Supported transaction types (STRICTLY ONE OF THESE 4):
1. CASH_SALE: Cash received from a walk-in sale or customer paying cash for groceries (e.g. "Aaj cash me 1000 ki sale hui", "800 cash mila", "sold 500 cash").
2. CREDIT_SALE: Goods/items given on credit/udhar/kadan/baaki to a customer (e.g. "Maine Ramesh ko 500 ka maal udhaar diya", "Suresh ko 300 ka samaan diya baaki me"). Customer name MUST be extracted.
3. KHATA_REPAYMENT: Customer paid back past debt/credit/udhar/khata (e.g. "Ramesh ne 500 rupaye wapas diye", "Khata chukaya 400"). Customer name MUST be extracted if mentioned.
4. EXPENSE: Shop expense, bills, distributor payout, rent, electricity, maintenance, tea (e.g. "Bijli ka bill 1500 diya", "chai ka 50 diya"). Customer name is null.

Ambiguity rules:
- If transcript is unclear (e.g. "Ramesh ko 500 diye" - gave Ramesh 500: could be udhar or repayment or supplier payment), set is_ambiguous=true and possible_types=["CREDIT_SALE", "KHATA_REPAYMENT"].
- If transcript mentions multiple transactions, return each in the transactions array.

Respond ONLY with a JSON object. No explanation, no markdown ticks.
Format:
{
  "transactions": [
    {
      "customer_name": "string or null",
      "amount": number,
      "transaction_type": "CASH_SALE" | "CREDIT_SALE" | "KHATA_REPAYMENT" | "EXPENSE",
      "description": "short description"
    }
  ],
  "is_ambiguous": boolean,
  "possible_types": ["CREDIT_SALE", "KHATA_REPAYMENT"],
  "clarification_question": "string or null"
}`;

async function testPrompt(transcript) {
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
        { role: 'user', content: `Transcript: "${transcript}"` }
      ],
      temperature: 0.1,
    })
  });

  const data = await res.json();
  console.log('\n=== TRANSCRIPT:', transcript);
  const content = data.choices?.[0]?.message?.content;
  console.log('CONTENT:', content);
}

async function run() {
  const cases = [
    "Maine Ramesh ko 500 ka maal udhaar diya.",
    "Ramesh ne 500 rupaye wapas de diye.",
    "Aaj cash mein 1000 rupaye ki sale hui.",
    "Bijli ka bill 1500 rupaye diya.",
    "Sold groceries for 800 cash",
    "Ramesh-ku 500 kadan kuduthen",
    "Ramesh ne 500 diye aur Suresh ko 300 ka maal udhaar diya.",
    "Ramesh ko 500 rupaye diye."
  ];

  for (const c of cases) {
    await testPrompt(c);
  }
}

run();
