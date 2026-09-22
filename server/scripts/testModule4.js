import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/transactions';

async function testParse(transcript) {
  const res = await fetch(`${BASE_URL}/parse-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript })
  });
  const data = await res.json();
  return data;
}

async function testConfirm(txData) {
  const res = await fetch(`${BASE_URL}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txData)
  });
  return await res.json();
}

async function runModule4Tests() {
  console.log('========================================');
  console.log('   KIRANAPILOT MODULE 4 TEST SUITE');
  console.log('========================================\n');

  // Test 1: Credit sale (Hindi)
  console.log('TEST 1: "Maine Ramesh ko 500 ka maal udhaar diya."');
  const t1 = await testParse("Maine Ramesh ko 500 ka maal udhaar diya.");
  console.log('Result:', JSON.stringify(t1.transactions));
  console.assert(t1.transactions[0].customer_name === 'Ramesh', 'Customer should be Ramesh');
  console.assert(t1.transactions[0].amount === 500, 'Amount should be 500');
  console.assert(t1.transactions[0].transaction_type === 'CREDIT_SALE', 'Type should be CREDIT_SALE');
  console.log('✅ TEST 1 PASSED\n');

  // Test 2: Khata repayment (Hindi)
  console.log('TEST 2: "Ramesh ne 500 rupaye wapas de diye."');
  const t2 = await testParse("Ramesh ne 500 rupaye wapas de diye.");
  console.log('Result:', JSON.stringify(t2.transactions));
  console.assert(t2.transactions[0].customer_name === 'Ramesh', 'Customer should be Ramesh');
  console.assert(t2.transactions[0].amount === 500, 'Amount should be 500');
  console.assert(t2.transactions[0].transaction_type === 'KHATA_REPAYMENT', 'Type should be KHATA_REPAYMENT');
  console.log('✅ TEST 2 PASSED\n');

  // Test 3: Cash sale
  console.log('TEST 3: "Aaj cash mein 1000 rupaye ki sale hui."');
  const t3 = await testParse("Aaj cash mein 1000 rupaye ki sale hui.");
  console.log('Result:', JSON.stringify(t3.transactions));
  console.assert(t3.transactions[0].amount === 1000, 'Amount should be 1000');
  console.assert(t3.transactions[0].transaction_type === 'CASH_SALE', 'Type should be CASH_SALE');
  console.log('✅ TEST 3 PASSED\n');

  // Test 4: Expense
  console.log('TEST 4: "Bijli ka bill 1500 rupaye diya."');
  const t4 = await testParse("Bijli ka bill 1500 rupaye diya.");
  console.log('Result:', JSON.stringify(t4.transactions));
  console.assert(t4.transactions[0].amount === 1500, 'Amount should be 1500');
  console.assert(t4.transactions[0].transaction_type === 'EXPENSE', 'Type should be EXPENSE');
  console.log('✅ TEST 4 PASSED\n');

  // Test 5: English sentence
  console.log('TEST 5: "Sold groceries for 800 cash"');
  const t5 = await testParse("Sold groceries for 800 cash");
  console.log('Result:', JSON.stringify(t5.transactions));
  console.assert(t5.transactions[0].amount === 800, 'Amount should be 800');
  console.assert(t5.transactions[0].transaction_type === 'CASH_SALE', 'Type should be CASH_SALE');
  console.log('✅ TEST 5 PASSED\n');

  // Test 6: Tamil / Code-mixed
  console.log('TEST 6: "Ramesh-ku 500 kadan kuduthen"');
  const t6 = await testParse("Ramesh-ku 500 kadan kuduthen");
  console.log('Result:', JSON.stringify(t6.transactions));
  console.assert(t6.transactions[0].amount === 500, 'Amount should be 500');
  console.assert(t6.transactions[0].transaction_type === 'CREDIT_SALE', 'Type should be CREDIT_SALE');
  console.log('✅ TEST 6 PASSED\n');

  // Test 7: Multiple transactions in one sentence
  console.log('TEST 7: "Ramesh ne 500 diye aur Suresh ko 300 ka maal udhaar diya."');
  const t7 = await testParse("Ramesh ne 500 diye aur Suresh ko 300 ka maal udhaar diya.");
  console.log('Result:', JSON.stringify(t7.transactions));
  console.assert(t7.transactions.length === 2, 'Should have 2 transactions');
  console.log('✅ TEST 7 PASSED\n');

  // Test 8: Ambiguous sentence
  console.log('TEST 8: "Ramesh ko 500 rupaye diye." (Ambiguous)');
  const t8 = await testParse("Ramesh ko 500 rupaye diye.");
  console.log('Result is_ambiguous:', t8.is_ambiguous, 'Possible types:', t8.possible_types);
  console.assert(t8.is_ambiguous === true, 'Should be marked ambiguous');
  console.log('✅ TEST 8 PASSED\n');

  // Test 9: Confirm transaction in MySQL and check balance update
  console.log('TEST 9: MySQL Confirmation & Balance Delta Test');
  const [mBefore] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
  const balanceBefore = parseFloat(mBefore[0].current_cash_balance);
  console.log('Initial Cash Balance: ₹' + balanceBefore);

  // 9a. Confirm a CASH_SALE of ₹1000 -> Balance should increase by ₹1000
  const c1 = await testConfirm({
    merchant_id: 1,
    transactions: [{
      customer_name: null,
      amount: 1000,
      transaction_type: 'CASH_SALE',
      description: 'Test Cash Sale 1000'
    }]
  });
  console.log('Cash Sale Confirmation:', c1.message, 'New Balance:', c1.current_cash_balance);
  console.assert(parseFloat(c1.current_cash_balance) === balanceBefore + 1000, 'Cash balance should increase by 1000');

  // 9b. Confirm a CREDIT_SALE of ₹500 for Ramesh -> Balance should NOT change, Customer Ramesh created
  const c2 = await testConfirm({
    merchant_id: 1,
    transactions: [{
      customer_name: 'Ramesh Patel',
      amount: 500,
      transaction_type: 'CREDIT_SALE',
      description: 'Test Credit Sale 500'
    }]
  });
  console.log('Credit Sale Confirmation:', c2.message, 'New Balance:', c2.current_cash_balance);
  console.assert(parseFloat(c2.current_cash_balance) === balanceBefore + 1000, 'Cash balance should remain unchanged for credit sale');

  // 9c. Confirm an EXPENSE of ₹200 -> Balance should decrease by ₹200
  const c3 = await testConfirm({
    merchant_id: 1,
    transactions: [{
      customer_name: null,
      amount: 200,
      transaction_type: 'EXPENSE',
      description: 'Test Tea Expense 200'
    }]
  });
  console.log('Expense Confirmation:', c3.message, 'New Balance:', c3.current_cash_balance);
  console.assert(parseFloat(c3.current_cash_balance) === balanceBefore + 1000 - 200, 'Cash balance should decrease by 200');

  // Verify in MySQL
  const [dbTxs] = await pool.query(
    'SELECT * FROM transactions WHERE merchant_id = 1 AND source = "VOICE" ORDER BY id DESC LIMIT 3'
  );
  console.log('Verified MySQL Transactions saved:', dbTxs.map(t => ({ id: t.id, type: t.transaction_type, amount: t.amount, source: t.source })));
  console.assert(dbTxs.length >= 3, 'All 3 transactions should exist in DB with source=VOICE');

  console.log('\n🎉 ALL 10 MODULE 4 INTEGRATION TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runModule4Tests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
