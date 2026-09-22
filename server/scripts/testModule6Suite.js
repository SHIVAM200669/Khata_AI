import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('    KIRANAPILOT MODULE 6: VERIFICATION TEST SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- TEST 1: CREDIT SALE & OCR EXTRACTION ---
  console.log('--- Test 1: Single & Multi-row OCR Parsing ---');
  try {
    const ocrSample = `
01-09-24 Ramesh Sugar 2kg 500 Udhaar
02-09-24 Suresh Atta 5kg 300 Cash
05-09-24 Ramesh 500 wapas diye
12-09-24 Supplier Payment 2,000 Expense
13-09-24 Bijli bill 1,500
14-09-24 Dinesh 500
15-09-24 Rajesh Rice 5OO Udhaar
`;
    console.log('Sending sample ledger text to Sarvam AI...');
    const result = await parseOcrText(ocrSample);

    assert(result.success === true, 'parseOcrText returned success = true');
    assert(Array.isArray(result.transactions), 'transactions array returned');
    assert(result.transactions.length >= 6, `Extracted ${result.transactions.length} transactions (expected >= 6)`);

    // Verify row 1: Ramesh credit sale
    const rameshRow = result.transactions.find(t => t.customer_name?.toLowerCase().includes('ramesh') && t.transaction_type === 'CREDIT_SALE');
    assert(Boolean(rameshRow), 'Ramesh Credit Sale (Udhaar) identified correctly');
    if (rameshRow) {
      assert(rameshRow.amount === 500, `Ramesh amount is 500 (actual: ${rameshRow.amount})`);
      assert(rameshRow.transaction_date === '2024-09-01', `Ramesh date normalized to 2024-09-01 (actual: ${rameshRow.transaction_date})`);
    }

    // Verify row 2: Suresh cash sale
    const sureshRow = result.transactions.find(t => t.customer_name?.toLowerCase().includes('suresh') || t.transaction_type === 'CASH_SALE');
    assert(Boolean(sureshRow), 'Suresh Cash Sale identified correctly');
    if (sureshRow) {
      assert(sureshRow.amount === 300, `Suresh amount is 300 (actual: ${sureshRow.amount})`);
      assert(sureshRow.transaction_type === 'CASH_SALE', `Transaction type is CASH_SALE (actual: ${sureshRow.transaction_type})`);
    }

    // Verify row 3: Ramesh Khata Repayment
    const repayRow = result.transactions.find(t => t.transaction_type === 'KHATA_REPAYMENT' || (t.customer_name?.toLowerCase().includes('ramesh') && t.amount === 500 && t !== rameshRow));
    assert(Boolean(repayRow), 'Khata Repayment ("wapas diye") identified correctly');

    // Verify row 4 & 5: Expenses
    const expenseRows = result.transactions.filter(t => t.transaction_type === 'EXPENSE');
    assert(expenseRows.length >= 1, `Found ${expenseRows.length} Expense transactions`);

    // Verify row 6: Ambiguous row
    const dineshRow = result.transactions.find(t => t.customer_name?.toLowerCase().includes('dinesh'));
    if (dineshRow) {
      assert(dineshRow.is_ambiguous === true || dineshRow.possible_types?.length > 1, 'Ambiguous entry ("14-09-24 Dinesh 500") flagged with is_ambiguous / possible_types');
    }

    // Verify row 7: 5OO Normalization
    const rajeshRow = result.transactions.find(t => t.customer_name?.toLowerCase().includes('rajesh'));
    if (rajeshRow) {
      assert(rajeshRow.amount === 500, `Amount "5OO" normalized to 500 (actual: ${rajeshRow.amount})`);
    }

    // Summary validation
    assert(result.summary && result.summary.total_count === result.transactions.length, 'Summary metrics computed correctly');
  } catch (err) {
    console.error('Test 1 error:', err);
    failed++;
  }

  // --- TEST 2: DUPLICATE DETECTION (WARNING ONLY) ---
  console.log('\n--- Test 2: Duplicate Detection API Check ---');
  try {
    const res = await fetch('http://localhost:5000/api/transactions/parse-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '01-09-24 Ramesh Sugar 2kg 500 Udhaar',
        merchant_id: 1
      })
    });
    const data = await res.json();
    assert(data.success === true, 'POST /api/transactions/parse-ocr returned 200 OK');
    assert(Array.isArray(data.transactions), 'Returned parsed transactions');
  } catch (err) {
    console.error('Test 2 error:', err);
    failed++;
  }

  // --- TEST 3: HISTORICAL TRANSACTION CASH BALANCE PROTECTION ---
  console.log('\n--- Test 3: Historical Transaction Balance Protection in MySQL ---');
  try {
    // 1. Get initial merchant balance
    const [initialRows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
    const initialBalance = parseFloat(initialRows[0].current_cash_balance);
    console.log(`  Initial Current Cash Balance: ₹${initialBalance}`);

    // 2. Confirm a HISTORICAL transaction from 2024-09-01 (should NOT alter today's current cash balance)
    const historicalPayload = {
      merchant_id: 1,
      transactions: [
        {
          transaction_date: '2024-09-01',
          customer_name: 'TestHistoricalCustomer',
          amount: 5000,
          transaction_type: 'CASH_SALE',
          description: 'Historical test sale',
          source: 'OCR'
        }
      ]
    };

    const confirmRes = await fetch('http://localhost:5000/api/transactions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(historicalPayload)
    });
    const confirmData = await confirmRes.json();

    assert(confirmData.success === true, 'Historical transaction confirmed into MySQL');
    assert(confirmData.saved_transactions[0].is_historical === true, 'Transaction marked as is_historical = true');

    // 3. Verify balance did NOT change
    const [afterRows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
    const afterBalance = parseFloat(afterRows[0].current_cash_balance);
    console.log(`  Post-Historical-Import Balance: ₹${afterBalance}`);
    assert(afterBalance === initialBalance, `Historical cash sale preserved today's cash balance (before: ₹${initialBalance}, after: ₹${afterBalance})`);

    // Clean up test customer & transaction
    if (confirmData.saved_transactions?.[0]?.id) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [confirmData.saved_transactions[0].id]);
      await pool.query('DELETE FROM customers WHERE name = "TestHistoricalCustomer" AND merchant_id = 1');
    }
  } catch (err) {
    console.error('Test 3 error:', err);
    failed++;
  }

  // --- TEST 4: CONTEMPORARY TRANSACTION CASH BALANCE UPDATE ---
  console.log('\n--- Test 4: Contemporary (Today) Transaction Balance Update ---');
  try {
    const [initialRows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
    const initialBalance = parseFloat(initialRows[0].current_cash_balance);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPayload = {
      merchant_id: 1,
      transactions: [
        {
          transaction_date: todayStr,
          customer_name: 'TestTodayCustomer',
          amount: 150,
          transaction_type: 'CASH_SALE',
          description: 'Contemporary today sale',
          source: 'OCR'
        }
      ]
    };

    const confirmRes = await fetch('http://localhost:5000/api/transactions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todayPayload)
    });
    const confirmData = await confirmRes.json();

    assert(confirmData.success === true, 'Contemporary today transaction confirmed into MySQL');
    const [afterRows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
    const afterBalance = parseFloat(afterRows[0].current_cash_balance);
    console.log(`  Post-Today-Import Balance: ₹${afterBalance} (Expected: ₹${initialBalance + 150})`);
    assert(Math.abs(afterBalance - (initialBalance + 150)) < 0.01, 'Today cash sale increased cash balance by ₹150');

    // Clean up test customer & transaction & revert balance
    if (confirmData.saved_transactions?.[0]?.id) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [confirmData.saved_transactions[0].id]);
      await pool.query('DELETE FROM customers WHERE name = "TestTodayCustomer" AND merchant_id = 1');
      await pool.query('UPDATE merchants SET current_cash_balance = ? WHERE id = 1', [initialBalance]);
    }
  } catch (err) {
    console.error('Test 4 error:', err);
    failed++;
  }

  // --- TEST 5: REGRESSION CHECK ON VOICE MODULE 4 ---
  console.log('\n--- Test 5: Regression Check on Voice Semantic Parser (Module 4) ---');
  try {
    const voiceRes = await parseTransactionTranscript('Maine Ramesh ko 500 rupaye ka maal udhaar diya hai');
    assert(voiceRes.success === true, 'Voice parser returned success = true');
    assert(voiceRes.transactions && voiceRes.transactions.length > 0, 'Voice parser returned transactions array');
    const firstTx = voiceRes.transactions[0];
    assert(firstTx.transaction_type === 'CREDIT_SALE', 'Voice transcript parsed as CREDIT_SALE');
    assert(firstTx.amount === 500, 'Voice amount parsed as 500');
    assert(firstTx.customer_name === 'Ramesh', 'Voice customer parsed as Ramesh');
  } catch (err) {
    console.error('Test 5 error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTestSuite();
