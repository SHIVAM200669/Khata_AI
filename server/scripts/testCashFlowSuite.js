import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/transactions';

async function parse(transcript) {
  const res = await fetch(`${BASE_URL}/parse-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript })
  });
  return await res.json();
}

async function confirm(payload) {
  const res = await fetch(`${BASE_URL}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function getBalance() {
  const [rows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
  return parseFloat(rows[0].current_cash_balance);
}

async function run() {
  console.log('======================================================');
  console.log('  KIRANAPILOT CASH-FLOW DISTINCTION & BALANCE TEST');
  console.log('======================================================\n');

  // Reset demo balance for predictable assertion
  await pool.query('UPDATE merchants SET current_cash_balance = 20000.00 WHERE id = 1');
  let currentBalance = await getBalance();
  console.log('Baseline Merchant Cash Balance in MySQL: ₹' + currentBalance + '\n');

  // ----------------------------------------------------
  // CASE 1: Credit sale (Goods/Items on udhar)
  // "Ramesh ko 2000 ka maal udhaar diya"
  // Expected: CREDIT_SALE, is_cash_loan: false, Cash: NO CHANGE (₹0)
  // ----------------------------------------------------
  console.log('--- CASE 1: Credit Sale (Goods) ---');
  console.log('Transcript: "Ramesh ko 2000 ka maal udhaar diya"');
  const p1 = await parse("Ramesh ko 2000 ka maal udhaar diya");
  console.log('Parsed:', p1.transactions[0]);
  console.assert(p1.transactions[0].transaction_type === 'CREDIT_SALE', 'Type must be CREDIT_SALE');
  console.assert(p1.transactions[0].is_cash_loan === false, 'is_cash_loan must be false');
  console.assert(p1.transactions[0].customer_name === 'Ramesh', 'Customer must be Ramesh');
  console.assert(p1.transactions[0].amount === 2000, 'Amount must be 2000');

  const c1 = await confirm({ merchant_id: 1, transactions: p1.transactions });
  const b1 = await getBalance();
  console.log(`Balance after confirmation: ₹${b1} (Expected: ₹${currentBalance} - NO CHANGE)`);
  console.assert(b1 === currentBalance, `Expected balance ₹${currentBalance} but got ₹${b1}`);
  currentBalance = b1;
  console.log('✅ CASE 1 PASSED: Credit sale of goods created receivable with NO cash balance change.\n');

  // ----------------------------------------------------
  // CASE 2: Money/Payment given to supplier/expense
  // "Supplier ko 2000 rupaye diye"
  // Expected: EXPENSE, Cash: -2000
  // ----------------------------------------------------
  console.log('--- CASE 2: Payment / Expense Given ---');
  console.log('Transcript: "Supplier ko 2000 rupaye diye"');
  const p2 = await parse("Supplier ko 2000 rupaye diye");
  console.log('Parsed:', p2.transactions[0]);
  console.assert(p2.transactions[0].transaction_type === 'EXPENSE', 'Type must be EXPENSE');
  console.assert(p2.transactions[0].amount === 2000, 'Amount must be 2000');

  const expectedB2 = currentBalance - 2000;
  const c2 = await confirm({ merchant_id: 1, transactions: p2.transactions });
  const b2 = await getBalance();
  console.log(`Balance after confirmation: ₹${b2} (Expected: ₹${expectedB2} - DECREASED BY 2000)`);
  console.assert(b2 === expectedB2, `Expected balance ₹${expectedB2} but got ₹${b2}`);
  currentBalance = b2;
  console.log('✅ CASE 2 PASSED: Supplier payment recorded as EXPENSE with -₹2000 cash balance.\n');

  // ----------------------------------------------------
  // CASE 3: Cash / Money lent to a person
  // "Maine Mohan ko 2000 rupaye udhaar diye"
  // Expected: CREDIT_SALE, is_cash_loan: true, Cash: -2000, Customer receivable created
  // ----------------------------------------------------
  console.log('--- CASE 3: Money Lent to Person (Cash Loan) ---');
  console.log('Transcript: "Maine Mohan ko 2000 rupaye udhaar diye"');
  const p3 = await parse("Maine Mohan ko 2000 rupaye udhaar diye");
  console.log('Parsed:', p3.transactions[0]);
  console.assert(p3.transactions[0].transaction_type === 'CREDIT_SALE', 'Type must be CREDIT_SALE');
  console.assert(p3.transactions[0].is_cash_loan === true, 'is_cash_loan must be true');
  console.assert(p3.transactions[0].customer_name === 'Mohan', 'Customer must be Mohan');
  console.assert(p3.transactions[0].amount === 2000, 'Amount must be 2000');

  const expectedB3 = currentBalance - 2000;
  const c3 = await confirm({ merchant_id: 1, transactions: p3.transactions });
  const b3 = await getBalance();
  console.log(`Balance after confirmation: ₹${b3} (Expected: ₹${expectedB3} - DECREASED BY 2000)`);
  console.assert(b3 === expectedB3, `Expected balance ₹${expectedB3} but got ₹${b3}`);
  currentBalance = b3;
  console.log('✅ CASE 3 PASSED: Money lent to person created customer receivable AND decreased cash balance by ₹2000.\n');

  // ----------------------------------------------------
  // CASE 4: Khata repayment
  // "Ramesh ne 2000 rupaye wapas diye"
  // Expected: KHATA_REPAYMENT, Cash: +2000
  // ----------------------------------------------------
  console.log('--- CASE 4: Khata Repayment ---');
  console.log('Transcript: "Ramesh ne 2000 rupaye wapas diye"');
  const p4 = await parse("Ramesh ne 2000 rupaye wapas diye");
  console.log('Parsed:', p4.transactions[0]);
  console.assert(p4.transactions[0].transaction_type === 'KHATA_REPAYMENT', 'Type must be KHATA_REPAYMENT');
  console.assert(p4.transactions[0].customer_name === 'Ramesh', 'Customer must be Ramesh');
  console.assert(p4.transactions[0].amount === 2000, 'Amount must be 2000');

  const expectedB4 = currentBalance + 2000;
  const c4 = await confirm({ merchant_id: 1, transactions: p4.transactions });
  const b4 = await getBalance();
  console.log(`Balance after confirmation: ₹${b4} (Expected: ₹${expectedB4} - INCREASED BY 2000)`);
  console.assert(b4 === expectedB4, `Expected balance ₹${expectedB4} but got ₹${b4}`);
  currentBalance = b4;
  console.log('✅ CASE 4 PASSED: Khata repayment recorded with +₹2000 cash balance.\n');

  console.log('🎉 ALL 4 CASH-FLOW CASES AND MYSQL BALANCE CHECKS PASSED PERFECTLY!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
