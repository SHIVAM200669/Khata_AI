import dotenv from 'dotenv';
dotenv.config();

import { parseTransactionTranscript } from '../services/transactionParserService.js';

const API_BASE = 'http://localhost:5000/api';

async function testDateRuleAndReset() {
  console.log('====================================================');
  console.log('  TESTING DATE RULES & CLEAN RESET VERIFICATION     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- Step 1: Verify API Endpoints with Clean Database State ---
  console.log('--- Step 1: Verifying Dashboard Summary with Clean DB ---');
  try {
    const dashRes = await fetch(`${API_BASE}/dashboard/summary?merchant_id=1`);
    const data = await dashRes.json();
    assert(data.success === true, 'Dashboard summary returns success');
    assert(parseFloat(data.current_cash) === 15000, `Current cash is ₹15,000 (actual: ${data.current_cash})`);
    assert(parseFloat(data.total_outstanding_khata) === 0, `Total outstanding Khata is ₹0 (actual: ${data.total_outstanding_khata})`);
    assert(parseFloat(data.today_sales) === 0, `Today's sales is ₹0 (actual: ${data.today_sales})`);
    assert(parseFloat(data.today_expenses) === 0, `Today's expenses is ₹0 (actual: ${data.today_expenses})`);
    assert(parseInt(data.customer_count, 10) === 0, `Customer count is 0 (actual: ${data.customer_count})`);
    assert(Array.isArray(data.recent_transactions) && data.recent_transactions.length === 0, 'Recent transactions list is empty');
  } catch (err) {
    assert(false, 'Dashboard summary API call', err.message);
  }

  console.log('\n--- Step 2: Verifying Customers Endpoint with Clean DB ---');
  try {
    const custRes = await fetch(`${API_BASE}/customers?merchant_id=1`);
    const data = await custRes.json();
    assert(data.success === true, 'Customers endpoint returns success');
    assert(Array.isArray(data.customers) && data.customers.length === 0, `Customers list has 0 items (actual: ${data.customers.length})`);
    assert(parseFloat(data.summary?.total_outstanding || 0) === 0, `Summary total outstanding is ₹0 (actual: ${data.summary?.total_outstanding})`);
    assert(parseFloat(data.summary?.total_credit || 0) === 0, `Summary total credit is ₹0 (actual: ${data.summary?.total_credit})`);
    assert(parseFloat(data.summary?.total_repayments || 0) === 0, `Summary total repayments is ₹0 (actual: ${data.summary?.total_repayments})`);
  } catch (err) {
    assert(false, 'Customers API call', err.message);
  }

  console.log('\n--- Step 3: Verifying Transactions Endpoint with Clean DB ---');
  try {
    const txRes = await fetch(`${API_BASE}/transactions?merchant_id=1`);
    const data = await txRes.json();
    assert(data.success === true, 'Transactions endpoint returns success');
    assert(Array.isArray(data.transactions) && data.transactions.length === 0, `Transactions list has 0 items (actual: ${data.transactions.length})`);
    assert(parseFloat(data.merchant?.current_cash_balance) === 15000, `Merchant cash balance is ₹15,000 (actual: ${data.merchant?.current_cash_balance})`);
  } catch (err) {
    assert(false, 'Transactions API call', err.message);
  }

  console.log('\n--- Step 4: Verifying Forecast with Clean DB ---');
  try {
    const fcRes = await fetch(`${API_BASE}/forecast?merchant_id=1`);
    const data = await fcRes.json();
    assert(data.success === true, 'Forecast endpoint returns success');
    assert(parseFloat(data.current_cash) === 15000, `Forecast current cash is ₹15,000 (actual: ${data.current_cash})`);
    assert(Array.isArray(data.forecast) && data.forecast.length === 7, `Forecast has 7 daily projections (actual: ${data.forecast.length})`);
    assert(data.confidence === 'LOW', `Confidence is LOW on fresh database (actual: ${data.confidence})`);
  } catch (err) {
    assert(false, 'Forecast API call', err.message);
  }

  // --- Step 5: Test Voice Parsing Date Rules ---
  console.log('\n--- Step 5: Voice Parsing Date Rule (Implicit Date -> Today\'s Actual Date) ---');
  const todayDateStr = new Date().toISOString().slice(0, 10);
  try {
    const implicitRes = await parseTransactionTranscript('Maine Abhijit ko 5000 rupaye udhaar diye');
    assert(implicitRes.success === true, 'Transcript parsed successfully');
    const tx = implicitRes.transactions[0];
    assert(tx.customer_name?.toLowerCase().includes('abhijit'), `Customer is Abhijit (actual: ${tx.customer_name})`);
    assert(tx.amount === 5000, `Amount is 5000 (actual: ${tx.amount})`);
    assert(tx.has_explicit_date === false, 'has_explicit_date is false');
    assert(tx.transaction_date.startsWith(todayDateStr), `transaction_date uses today's actual date: ${todayDateStr} (actual: ${tx.transaction_date})`);
  } catch (err) {
    assert(false, 'Implicit date parsing', err.message);
  }

  console.log('\n--- Step 6: Voice Parsing Date Rule (Explicit Date -> Spoken Date) ---');
  try {
    const explicitRes = await parseTransactionTranscript('20 September ko maine Abhijit ko 5000 rupaye udhaar diye');
    assert(explicitRes.success === true, 'Explicit date transcript parsed successfully');
    const tx = explicitRes.transactions[0];
    assert(tx.customer_name?.toLowerCase().includes('abhijit'), `Customer is Abhijit (actual: ${tx.customer_name})`);
    assert(tx.amount === 5000, `Amount is 5000 (actual: ${tx.amount})`);
    assert(tx.has_explicit_date === true, 'has_explicit_date is true');
    assert(tx.transaction_date.startsWith('2026-09-20'), `transaction_date uses spoken date 2026-09-20 (actual: ${tx.transaction_date})`);
  } catch (err) {
    assert(false, 'Explicit date parsing', err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testDateRuleAndReset().catch(console.error);
