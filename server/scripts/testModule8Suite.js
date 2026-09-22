import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db.js';
import { generateCashFlowForecast } from '../services/cashFlowForecastService.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';

async function runModule8TestSuite() {
  console.log('====================================================');
  console.log('    KIRANAPILOT MODULE 8: FORECAST & SYNC SUITE    ');
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

  try {
    // 0. Clean reset test environment for Merchant 1
    await pool.query('DELETE FROM transactions WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('DELETE FROM customer_payments WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('DELETE FROM expenses WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('DELETE FROM customers WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('UPDATE merchants SET current_cash_balance = 18000.00 WHERE id = ?', [MERCHANT_ID]);

    // --- TEST 1: Current Cash Baseline ---
    console.log('--- Test 1: Initial Current Cash Baseline ---');
    const d1Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d1Res.current_cash === 18000, `Current cash starts at ₹18,000 (actual: ₹${d1Res.current_cash})`);

    // --- TEST 2: CASH_SALE Increases Cash ---
    console.log('\n--- Test 2: CASH_SALE Increases Cash ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 2000,
        transaction_type: 'CASH_SALE',
        description: 'Counter sale',
        source: 'MANUAL'
      })
    });
    const d2Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d2Res.current_cash === 20000, `Cash increased by ₹2,000 to ₹20,000 (actual: ₹${d2Res.current_cash})`);
    assert(d2Res.today_sales === 2000, `Today sales reflects ₹2,000 (actual: ₹${d2Res.today_sales})`);

    // --- TEST 3: KHATA_REPAYMENT Increases Cash ---
    console.log('\n--- Test 3: KHATA_REPAYMENT Increases Cash ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestRamesh',
        amount: 500,
        transaction_type: 'KHATA_REPAYMENT',
        description: 'Old debt settlement',
        source: 'VOICE'
      })
    });
    const d3Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d3Res.current_cash === 20500, `Cash increased by ₹500 to ₹20,500 (actual: ₹${d3Res.current_cash})`);

    // --- TEST 4: CREDIT_SALE Does Not Change Cash ---
    console.log('\n--- Test 4: CREDIT_SALE Preserves Cash Balance ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestRamesh',
        amount: 1500,
        transaction_type: 'CREDIT_SALE',
        description: 'Goods on credit',
        source: 'VOICE'
      })
    });
    const d4Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d4Res.current_cash === 20500, `Cash unchanged at ₹20,500 after credit sale (actual: ₹${d4Res.current_cash})`);

    // --- TEST 5: EXPENSE Decreases Cash ---
    console.log('\n--- Test 5: EXPENSE Decreases Cash ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 1200,
        transaction_type: 'EXPENSE',
        description: 'Electricity bill paid today',
        source: 'MANUAL'
      })
    });
    const d5Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d5Res.current_cash === 19300, `Cash decreased by ₹1,200 to ₹19,300 (actual: ₹${d5Res.current_cash})`);
    assert(d5Res.today_expenses === 1200, `Today expenses reflects ₹1,200 (actual: ₹${d5Res.today_expenses})`);

    // --- TEST 6: Historical OCR Transaction Does Not Alter Today Cash ---
    console.log('\n--- Test 6: Historical OCR Balance Protection ---');
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        customer_name: 'TestSuresh',
        amount: 5000,
        transaction_type: 'CASH_SALE',
        description: 'September 2024 historical register sale',
        transaction_date: '2024-09-01',
        source: 'OCR'
      })
    });
    const d6Res = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(d6Res.current_cash === 19300, `Historical cash sale preserved today's cash at ₹19,300 (actual: ₹${d6Res.current_cash})`);

    // --- TEST 7: Customer Khata Remains Accurate ---
    console.log('\n--- Test 7: Customer Khata Calculation ---');
    // TestRamesh had 500 repayment and 1500 credit = 1000 outstanding
    const cRes = await (await fetch(`${BASE_URL}/api/customers?search=TestRamesh&merchant_id=${MERCHANT_ID}`)).json();
    const ramesh = cRes.customers[0];
    assert(ramesh.outstanding_amount === 1000, `TestRamesh outstanding is ₹1,000 (actual: ₹${ramesh.outstanding_amount})`);
    assert(d6Res.total_outstanding_khata === 1000, `Dashboard total outstanding is ₹1,000 (actual: ₹${d6Res.total_outstanding_khata})`);

    // --- TEST 8 & 9: Seven-Day Forecast Generation ---
    console.log('\n--- Test 8 & 9: 7-Day Forecast Window & Projections ---');
    const fRes = await (await fetch(`${BASE_URL}/api/forecast?merchant_id=${MERCHANT_ID}`)).json();
    assert(fRes.success === true, 'GET /api/forecast returned 200 OK');
    assert(fRes.forecast?.length === 7, `Forecast generated 7 daily projections (actual: ${fRes.forecast?.length})`);
    assert(fRes.forecast[0].opening_cash === 19300, `Day 1 opening cash matches current cash ₹19,300 (actual: ₹${fRes.forecast[0].opening_cash})`);

    // --- TEST 10: Expected Inflows Use Historical Velocity ---
    console.log('\n--- Test 10: Expected Inflows Calculated from History ---');
    const day1 = fRes.forecast[0];
    assert(day1.expected_inflow > 0, `Day 1 expected inflow is positive based on past sales (actual: ₹${day1.expected_inflow})`);

    // --- TEST 11: Upcoming Pending Expenses Affect Forecast Outflow ---
    console.log('\n--- Test 11: Scheduled Pending Expenses Integration ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        description: 'Amul Dairy Milk Crate Payable',
        amount: 8000,
        due_date: tomorrowStr,
        status: 'PENDING'
      })
    });

    const fPostExp = await (await fetch(`${BASE_URL}/api/forecast?merchant_id=${MERCHANT_ID}`)).json();
    const day1Post = fPostExp.forecast[0];
    assert(day1Post.expected_outflow >= 8000, `Day 1 expected outflow included scheduled ₹8,000 bill (actual: ₹${day1Post.expected_outflow})`);
    assert(day1Post.breakdown.scheduled_expenses.some(e => e.description.includes('Amul Dairy')), 'Amul Dairy bill itemized in day 1 breakdown');

    // --- TEST 12: Low Projected Cash Generates Warning (SHORTAGE) ---
    console.log('\n--- Test 12: Shortage Warning Generation ---');
    // Set safety threshold to 16,000 (since cash is ~15,050 after 8,000 expense, it falls below safety buffer)
    const fShortage = await (await fetch(`${BASE_URL}/api/forecast?merchant_id=${MERCHANT_ID}&min_threshold=16000`)).json();
    assert(fShortage.overall_status === 'SHORTAGE' || fShortage.forecast.some(d => d.status === 'SHORTAGE'), 'Status flagged as SHORTAGE when cash falls below safety threshold');
    assert(fShortage.warnings.length > 0, `Shortage warning message generated (actual count: ${fShortage.warnings.length})`);

    // --- TEST 13: Negative Projected Cash Generates DEFICIT Warning ---
    console.log('\n--- Test 13: Deficit Warning on Negative Cash ---');
    const day3 = new Date();
    day3.setDate(day3.getDate() + 3);
    const day3Str = day3.toISOString().slice(0, 10);

    await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        description: 'Heavy FMCG Wholesale Inventory Restock',
        amount: 30000, // Exceeds all cash
        due_date: day3Str,
        status: 'PENDING'
      })
    });

    const fDeficit = await (await fetch(`${BASE_URL}/api/forecast?merchant_id=${MERCHANT_ID}`)).json();
    assert(fDeficit.overall_status === 'DEFICIT', `Status flagged as DEFICIT (actual: ${fDeficit.overall_status})`);
    assert(fDeficit.lowest_projected_cash < 0, `Lowest projected cash is negative (actual: ₹${fDeficit.lowest_projected_cash})`);
    assert(fDeficit.warnings.some(w => w.type === 'DEFICIT'), 'Deficit warning contains factual explanation');

    // --- TEST 14: Confidence Assessment ---
    console.log('\n--- Test 14: Confidence Assessment ---');
    assert(['LOW', 'MEDIUM', 'HIGH'].includes(fDeficit.confidence), `Confidence is valid tier (${fDeficit.confidence})`);
    assert(Boolean(fDeficit.confidence_reason), 'Confidence reason is provided');

    // --- TEST 15, 16, 17, 18: Dynamic Recalculation & UI Sync ---
    console.log('\n--- Test 15-18: Real-Time Dynamic Sync Across All Modules ---');
    const cashPrior = (await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json()).current_cash;

    // Confirm new cash sale of 5000
    await fetch(`${BASE_URL}/api/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: 5000,
        transaction_type: 'CASH_SALE',
        description: 'Fresh counter revenue',
        source: 'VOICE'
      })
    });

    const dSync = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    const fSync = await (await fetch(`${BASE_URL}/api/forecast?merchant_id=${MERCHANT_ID}`)).json();
    const tSync = await (await fetch(`${BASE_URL}/api/transactions?merchant_id=${MERCHANT_ID}`)).json();

    assert(dSync.current_cash === cashPrior + 5000, `Dashboard cash updated to ₹${dSync.current_cash}`);
    assert(fSync.current_cash === cashPrior + 5000, `Forecast opening cash updated to ₹${fSync.current_cash}`);
    assert(tSync.transactions[0].amount === '5000.00', 'Transaction ledger reflects newest transaction at top');

    // --- TEST 19: Idempotent Database Source of Truth (Browser Refresh) ---
    console.log('\n--- Test 19: Browser Refresh Idempotency ---');
    const dRefresh = await (await fetch(`${BASE_URL}/api/dashboard/summary?merchant_id=${MERCHANT_ID}`)).json();
    assert(dRefresh.current_cash === dSync.current_cash, 'Subsequent fetch returns identical database-derived values');

    // --- TEST 20: Regression on Modules 1–7 ---
    console.log('\n--- Test 20: Regression on Modules 1–7 ---');
    const voiceRes = await parseTransactionTranscript('Mohan ko 2000 rupaye udhaar diye');
    assert(voiceRes.success === true && voiceRes.transactions.length > 0, 'Voice parser works');

    const ocrRes = await parseOcrText('01-09-24 Ramesh Sugar 500 Udhaar');
    assert(ocrRes.success === true && ocrRes.transactions.length > 0, 'OCR parser works');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    // Clean up test environment
    await pool.query('DELETE FROM transactions WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('DELETE FROM expenses WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('DELETE FROM customers WHERE merchant_id = ?', [MERCHANT_ID]);
    await pool.query('UPDATE merchants SET current_cash_balance = 15000.00 WHERE id = ?', [MERCHANT_ID]);

  } catch (err) {
    console.error('Fatal Test Error:', err);
    failed++;
  } finally {
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runModule8TestSuite();
