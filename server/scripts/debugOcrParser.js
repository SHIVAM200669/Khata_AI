import dotenv from 'dotenv';
dotenv.config();

import { parseOcrText } from '../services/ocrTransactionParserService.js';

async function debug() {
  const sample = `01-09-24 Ramesh Sugar 2kg, Tea 1pkt 500 Udhaar
02-09-24 Suresh Atta 5kg 300 Cash
03-09-24 Mohan Rice 10kg 800 Udhaar
05-09-24 Ramesh Payment received 500 Repayment
12-09-24 Shop Expense Stock Payment 2000 Expense
13-09-24 Shop Expense Electricity Bill 1200 Expense`;

  console.log('Testing OCR Parser with sample:');
  console.log(sample);
  console.log('------------------------------------');

  try {
    const res = await parseOcrText(sample);
    console.log('Result Success!');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Parser Error:', err.message, err.code, err.statusCode);
  }
}

debug();
