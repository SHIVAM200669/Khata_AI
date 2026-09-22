import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';

async function runModule7TestSuite() {
  console.log('====================================================');
  console.log('    KIRANAPILOT MODULE 7: CUSTOMER & KHATA SUITE   ');
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

  const BASE_URL = 'http://localhost:5000';
  const MERCHANT_ID = 1;

  // Cleanup any old test customer records before starting
  await pool.query('DELETE FROM transactions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE "TestCust_%")');
  await pool.query('DELETE FROM customers WHERE name LIKE "TestCust_%"');

  try {
    // --- TEST 1: New Customer -> ₹0 Outstanding ---
    console.log('--- Test 1: New Customer Creation & Initial Balance ---');
    const cust1Res = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCust_Alpha', phone: '9999900001', merchant_id: MERCHANT_ID })
    });
    const cust1Data = await cust1Res.json();
    assert(cust1Data.success === true, 'Created new customer TestCust_Alpha');
    const cust1Id = cust1Data.customer.id;

    // Check balance
    const check1Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check1Data = await check1Res.json();
    assert(check1Data.success === true, 'Fetched new customer details');
    assert(check1Data.metrics.outstanding_amount === 0, `New customer outstanding is ₹0 (actual: ${check1Data.metrics.outstanding_amount})`);
    assert(check1Data.metrics.total_credit === 0, 'Total credit is ₹0');
    assert(check1Data.metrics.total_repaid === 0, 'Total repaid is ₹0');

    // --- TEST 2: One CREDIT_SALE ₹500 -> ₹500 Outstanding ---
    console.log('\n--- Test 2: One CREDIT_SALE ₹500 ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 500,
        transaction_type: 'CREDIT_SALE',
        description: 'Rice 5kg',
        source: 'VOICE'
      })
    });

    const check2Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check2Data = await check2Res.json();
    assert(check2Data.metrics.outstanding_amount === 500, `Outstanding balance is ₹500 (actual: ${check2Data.metrics.outstanding_amount})`);
    assert(check2Data.metrics.total_credit === 500, 'Total credit is ₹500');

    // --- TEST 3: Another CREDIT_SALE ₹1,000 -> ₹1,500 Outstanding ---
    console.log('\n--- Test 3: Second CREDIT_SALE ₹1,000 ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 1000,
        transaction_type: 'CREDIT_SALE',
        description: 'Oil & Spices',
        source: 'OCR'
      })
    });

    const check3Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check3Data = await check3Res.json();
    assert(check3Data.metrics.outstanding_amount === 1500, `Outstanding balance is ₹1,500 (actual: ${check3Data.metrics.outstanding_amount})`);
    assert(check3Data.metrics.total_credit === 1500, 'Total credit is ₹1,500');

    // --- TEST 4: KHATA_REPAYMENT ₹500 -> ₹1,000 Outstanding ---
    console.log('\n--- Test 4: KHATA_REPAYMENT ₹500 ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 500,
        transaction_type: 'KHATA_REPAYMENT',
        description: 'Partial cash repayment',
        source: 'VOICE'
      })
    });

    const check4Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check4Data = await check4Res.json();
    assert(check4Data.metrics.outstanding_amount === 1000, `Outstanding balance is ₹1,000 (actual: ${check4Data.metrics.outstanding_amount})`);
    assert(check4Data.metrics.total_repaid === 500, 'Total repaid is ₹500');

    // --- TEST 5: Full Repayment (Remaining ₹1,000) -> ₹0 Outstanding ("Fully Paid") ---
    console.log('\n--- Test 5: Full Repayment ₹1,000 ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 1000,
        transaction_type: 'KHATA_REPAYMENT',
        description: 'Final khata settlement',
        source: 'MANUAL'
      })
    });

    const check5Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check5Data = await check5Res.json();
    assert(check5Data.metrics.outstanding_amount === 0, `Outstanding balance settled to ₹0 (actual: ${check5Data.metrics.outstanding_amount})`);
    assert(check5Data.metrics.total_repaid === 1500, 'Total repaid matches total credit of ₹1,500');

    // --- TEST 6: CASH_SALE -> No Change to Customer Khata ---
    console.log('\n--- Test 6: CASH_SALE Isolation ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 800,
        transaction_type: 'CASH_SALE',
        description: 'Direct counter cash sale',
        source: 'MANUAL'
      })
    });

    const check6Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check6Data = await check6Res.json();
    assert(check6Data.metrics.outstanding_amount === 0, 'CASH_SALE did not affect outstanding balance (still ₹0)');
    assert(check6Data.metrics.total_credit === 1500, 'CASH_SALE did not affect total credit (still ₹1,500)');

    // --- TEST 7: EXPENSE -> No Change to Customer Khata ---
    console.log('\n--- Test 7: EXPENSE Isolation ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Alpha',
        amount: 300,
        transaction_type: 'EXPENSE',
        description: 'Shop tea expense',
        source: 'MANUAL'
      })
    });

    const check7Res = await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`);
    const check7Data = await check7Res.json();
    assert(check7Data.metrics.outstanding_amount === 0, 'EXPENSE did not affect customer outstanding (still ₹0)');

    // --- TEST 8 & 9: Source Preservation in Customer History (VOICE & OCR) ---
    console.log('\n--- Test 8 & 9: Source Tag Preservation (VOICE, OCR, MANUAL) ---');
    const history = check7Data.transactions;
    const voiceTx = history.find(t => t.source === 'VOICE');
    const ocrTx = history.find(t => t.source === 'OCR');
    const manualTx = history.find(t => t.source === 'MANUAL');
    assert(Boolean(voiceTx), 'Voice transaction appears with source = VOICE');
    assert(Boolean(ocrTx), 'OCR transaction appears with source = OCR');
    assert(Boolean(manualTx), 'Manual transaction appears with source = MANUAL');

    // --- TEST 10: Multiple Customers Independence ---
    console.log('\n--- Test 10: Multi-Customer Balance Independence ---');
    // Create second customer
    const cust2Res = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCust_Beta', phone: '9999900002', merchant_id: MERCHANT_ID })
    });
    const cust2Data = await cust2Res.json();
    const cust2Id = cust2Data.customer.id;

    // Credit sale for Beta
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Beta',
        amount: 2500,
        transaction_type: 'CREDIT_SALE',
        description: 'Flour sack',
        source: 'VOICE'
      })
    });

    const checkBeta = await (await fetch(`${BASE_URL}/api/customers/${cust2Id}?merchant_id=${MERCHANT_ID}`)).json();
    const checkAlpha = await (await fetch(`${BASE_URL}/api/customers/${cust1Id}?merchant_id=${MERCHANT_ID}`)).json();

    assert(checkBeta.metrics.outstanding_amount === 2500, 'TestCust_Beta has independent outstanding ₹2,500');
    assert(checkAlpha.metrics.outstanding_amount === 0, 'TestCust_Alpha remains unchanged at ₹0');

    // --- TEST 11: Historical Transactions Contribution ---
    console.log('\n--- Test 11: Historical Transactions Khata Contribution ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Beta',
        amount: 1200,
        transaction_type: 'CREDIT_SALE',
        description: 'September 2024 ledger credit',
        transaction_date: '2024-09-02',
        source: 'OCR'
      })
    });

    const checkBetaHist = await (await fetch(`${BASE_URL}/api/customers/${cust2Id}?merchant_id=${MERCHANT_ID}`)).json();
    assert(checkBetaHist.metrics.outstanding_amount === 3700, `Historical credit contributed to customer outstanding (₹2500 + ₹1200 = ₹3700, actual: ${checkBetaHist.metrics.outstanding_amount})`);

    // --- TEST 12: Cash Loan Receivable & No Double Counting ---
    console.log('\n--- Test 12: Cash Loan Receivable & Double-Counting Check ---');
    const [cashBefore] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [MERCHANT_ID]);
    const balanceBefore = parseFloat(cashBefore[0].current_cash_balance);

    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Gamma',
        amount: 2000,
        transaction_type: 'CREDIT_SALE',
        is_cash_loan: true,
        description: 'Cash loan given',
        source: 'VOICE'
      })
    });

    const [cashAfter] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [MERCHANT_ID]);
    const balanceAfter = parseFloat(cashAfter[0].current_cash_balance);

    const gammaCust = await (await fetch(`${BASE_URL}/api/customers?search=TestCust_Gamma&merchant_id=${MERCHANT_ID}`)).json();
    const gamma = gammaCust.customers[0];

    assert(gamma.outstanding_amount === 2000, `Cash loan created customer receivable of ₹2,000 (actual: ${gamma.outstanding_amount})`);
    assert(Math.abs(balanceBefore - balanceAfter - 2000) < 0.01, `Merchant cash decreased by ₹2,000 (before: ${balanceBefore}, after: ${balanceAfter})`);

    // --- TEST 13: Over-Repayment Inconsistency Flag (No Silent Negative) ---
    console.log('\n--- Test 13: Over-Repayment Inconsistency Handling ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Gamma',
        amount: 3000, // Exceeds 2000
        transaction_type: 'KHATA_REPAYMENT',
        description: 'Excess repayment check',
        source: 'MANUAL'
      })
    });

    const gammaDetail = await (await fetch(`${BASE_URL}/api/customers/${gamma.id}?merchant_id=${MERCHANT_ID}`)).json();
    assert(gammaDetail.metrics.outstanding_amount === 0, 'Outstanding does not show negative balance (shows ₹0)');
    assert(gammaDetail.metrics.is_overpaid === true, 'is_overpaid flagged as true');
    assert(gammaDetail.metrics.inconsistency_amount === 1000, `Inconsistency amount flagged as ₹1,000 (actual: ${gammaDetail.metrics.inconsistency_amount})`);

    // --- TEST 14: Search API ---
    console.log('\n--- Test 14: Customer Search API ---');
    const searchRes = await (await fetch(`${BASE_URL}/api/customers?search=Alpha&merchant_id=${MERCHANT_ID}`)).json();
    assert(searchRes.success === true, 'Search endpoint returned 200');
    assert(searchRes.customers.some(c => c.name === 'TestCust_Alpha'), 'Found TestCust_Alpha in search results');
    assert(!searchRes.customers.some(c => c.name === 'TestCust_Beta'), 'Did not return TestCust_Beta for "Alpha" search');

    // --- TEST 15: Merchant Isolation ---
    console.log('\n--- Test 15: Merchant Data Isolation ---');
    const isoRes = await fetch(`${BASE_URL}/api/customers/${gamma.id}?merchant_id=999`);
    assert(isoRes.status === 404, 'Accessing customer from merchant 999 returned 404 Not Found');

    // --- TEST 16: UI / Khata Refresh on Confirmed Transaction ---
    console.log('\n--- Test 16: Khata Summary API Real-Time Update ---');
    const summaryBefore = await (await fetch(`${BASE_URL}/api/customers?merchant_id=${MERCHANT_ID}`)).json();
    const oldOutstanding = summaryBefore.summary.total_outstanding_khata;

    // Add 400 credit to Beta
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestCust_Beta',
        amount: 400,
        transaction_type: 'CREDIT_SALE',
        description: 'Extra goods',
        source: 'VOICE'
      })
    });

    const summaryAfter = await (await fetch(`${BASE_URL}/api/customers?merchant_id=${MERCHANT_ID}`)).json();
    assert(summaryAfter.summary.total_outstanding_khata === oldOutstanding + 400, `Grand total outstanding increased by ₹400 in MySQL (before: ₹${oldOutstanding}, after: ₹${summaryAfter.summary.total_outstanding_khata})`);

    // --- TEST 17: Modules 1–6 Regression Verification ---
    console.log('\n--- Test 17: Modules 1–6 Regression Check ---');
    // Voice transcription & parsing check
    const voiceRes = await parseTransactionTranscript('Ramesh ko 500 ka maal udhaar diya');
    assert(voiceRes.success === true && voiceRes.transactions[0].transaction_type === 'CREDIT_SALE', 'Voice Module 4 parsing works');

    // OCR parsing check
    const ocrRes = await parseOcrText('01-09-24 Suresh Atta 300 Cash');
    assert(ocrRes.success === true && ocrRes.transactions.length >= 1, 'OCR Module 6 parsing works');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    // Clean up test data
    await pool.query('DELETE FROM transactions WHERE customer_id IN (SELECT id FROM customers WHERE name LIKE "TestCust_%")');
    await pool.query('DELETE FROM customers WHERE name LIKE "TestCust_%"');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runModule7TestSuite();
