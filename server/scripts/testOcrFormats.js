import dotenv from 'dotenv';
dotenv.config();

import { parseOcrText } from '../services/ocrTransactionParserService.js';

async function testVariousOcrFormats() {
  console.log('Testing Markdown Table OCR Format:');
  const markdownTable = `
| Date | Customer | Details | Amount | Type |
|---|---|---|---|---|
| 01-09-24 | Ramesh | Sugar 2kg | 500 | Udhaar |
| 02-09-24 | Suresh | Atta 5kg | 300 | Cash |
| 05-09-24 | Ramesh | Jama kiya | 500 | Wapas |
| 12-09-24 | Distributor | Milk crate | 2000 | Expense |
`;

  try {
    const res = await parseOcrText(markdownTable);
    console.log('Markdown table result: SUCCESS', res.transactions.length, 'transactions');
  } catch (err) {
    console.error('Markdown table result: FAILED', err.message);
  }

  console.log('\nTesting Pure Hindi Devanagari OCR Text:');
  const hindiText = `
०१/०९/२४ रमेश चीनी २ किलो ५०० उधार
०२/०९/२४ सुरेश आटा ३०० नकद
०५/०९/२४ रमेश ५०० वापस दिया
१२/०९/२४ सप्लायर पेमेंट २००० खर्चा
`;

  try {
    const res = await parseOcrText(hindiText);
    console.log('Hindi result: SUCCESS', res.transactions.length, 'transactions');
  } catch (err) {
    console.error('Hindi result: FAILED', err.message);
  }

  console.log('\nTesting Messy Unstructured OCR Text:');
  const messyText = `
Page 1
Khatabook Register
01-09-2024
Ramesh
Sugar 2kg - 500 udhar
Suresh cash 300
Total 800
`;

  try {
    const res = await parseOcrText(messyText);
    console.log('Messy result: SUCCESS', res.transactions.length, 'transactions');
  } catch (err) {
    console.error('Messy result: FAILED', err.message);
  }
}

testVariousOcrFormats();
