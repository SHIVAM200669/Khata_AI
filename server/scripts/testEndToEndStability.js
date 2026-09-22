import fetch from 'node-fetch';
import pool from '../config/db.js';

const API_BASE = 'http://localhost:5000/api';

async function runE2EVerification() {
  console.log('================================================================');
  console.log('   KiranaPilot — End-to-End Stability & Full Lifecycle Test     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Health check
  console.log('--- 1. Health Check ---');
  const healthRes = await (await fetch(`${API_BASE}/health`)).json();
  assert(healthRes.status === 'ok' || healthRes.success === true, 'GET /api/health returned healthy status');

  // 2. Fetch Merchant 1 Baseline Cash
  const [initialRows] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
  const initialCash = parseFloat(initialRows[0].current_cash_balance);
  console.log(`\n--- Initial Merchant 1 Cash Balance: ₹${initialCash} ---`);

  // 3. Dashboard Summary API
  console.log('\n--- 2. Dashboard Summary API ---');
  const dashRes = await (await fetch(`${API_BASE}/dashboard/summary?merchant_id=1`)).json();
  assert(dashRes.success === true, 'Dashboard summary returns success: true');
  assert(dashRes.today_sales !== undefined, `Today's sales loaded from MySQL: ₹${dashRes.today_sales}`);
  assert(dashRes.current_cash !== undefined, `Current cash loaded from MySQL: ₹${dashRes.current_cash}`);
  assert(dashRes.total_outstanding_khata !== undefined, `Khata outstanding loaded from MySQL: ₹${dashRes.total_outstanding_khata}`);
  assert(dashRes.forecast_summary?.lowest_projected_cash !== undefined, `Lowest projected cash loaded from MySQL: ₹${dashRes.forecast_summary?.lowest_projected_cash}`);
  assert(Array.isArray(dashRes.recent_transactions), 'Recent transactions is an array from MySQL');

  // 4. Voice Transaction Confirmation: "आज 15,000 का सेल हुआ"
  console.log('\n--- 3. Voice Transaction Confirmation (₹15,000 CASH_SALE) ---');
  const voiceTxPayload = {
    merchant_id: 1,
    transaction_type: 'CASH_SALE',
    amount: 15000,
    customer_id: null,
    customer_name: null,
    description: 'Cash sale of 15,000 (आज 15,000 का सेल हुआ)',
    source: 'VOICE',
    transaction_date: new Date().toISOString()
  };

  const [txCountBefore] = await pool.query('SELECT COUNT(*) as cnt FROM transactions WHERE merchant_id = 1');
  
  const txConfirmRes = await (await fetch(`${API_BASE}/transactions/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(voiceTxPayload)
  })).json();

  assert(txConfirmRes.success === true, 'POST /api/transactions/confirm succeeded');
  const insertedId = txConfirmRes.saved_transactions?.[0]?.id;
  assert(insertedId !== undefined, `Transaction inserted with ID: ${insertedId}`);

  // 5. Verify MySQL State & Non-Duplication
  console.log('\n--- 4. Verify Single Insertion & Exact Cash Balance Update ---');
  const [txCountAfter] = await pool.query('SELECT COUNT(*) as cnt FROM transactions WHERE merchant_id = 1');
  assert(txCountAfter[0].cnt === txCountBefore[0].cnt + 1, 'Exactly ONE transaction recorded in MySQL (No double submission)');

  const [updatedMerchant] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
  const updatedCash = parseFloat(updatedMerchant[0].current_cash_balance);
  assert(updatedCash === initialCash + 15000, `Merchant cash balance updated by exactly +₹15,000 (New Cash: ₹${updatedCash})`);

  // 6. Verify Updated Dashboard Summary
  console.log('\n--- 5. Verify Dashboard Reflects New Transaction ---');
  const updatedDashRes = await (await fetch(`${API_BASE}/dashboard/summary?merchant_id=1`)).json();
  assert(updatedDashRes.current_cash === updatedCash, `Dashboard current cash matches MySQL: ₹${updatedDashRes.current_cash}`);
  assert(updatedDashRes.recent_transactions[0].amount == 15000, 'Recent transactions top item is the ₹15,000 voice sale');

  // 7. Verify Forecast API
  console.log('\n--- 6. Verify Cash Forecast API ---');
  const forecastRes = await (await fetch(`${API_BASE}/forecast?merchant_id=1`)).json();
  assert(forecastRes.success === true, 'GET /api/forecast returned success: true');
  assert(Array.isArray(forecastRes.forecast) && forecastRes.forecast.length === 7, '7-Day daily forecast window present');
  assert(forecastRes.current_cash === updatedCash, `Forecast current cash matches updated live cash: ₹${forecastRes.current_cash}`);

  // 8. Verify Customer Intelligence & Repayment Intelligence
  console.log('\n--- 7. Verify Customer Intelligence & Khata APIs ---');
  const custRes = await (await fetch(`${API_BASE}/customers?merchant_id=1`)).json();
  assert(custRes.success === true, 'GET /api/customers returned success: true');
  assert(Array.isArray(custRes.customers), `Loaded ${custRes.customers?.length || 0} customers for Merchant 1`);

  const intelRes = await (await fetch(`${API_BASE}/customers/intelligence?merchant_id=1`)).json();
  assert(intelRes.success === true, 'GET /api/customers/intelligence returned success: true');

  // 9. Verify Alerts API
  console.log('\n--- 8. Verify Financial Alerts API ---');
  const alertsRes = await (await fetch(`${API_BASE}/alerts?merchant_id=1`)).json();
  assert(alertsRes.success === true, 'GET /api/alerts returned success: true');
  assert(alertsRes.summary !== undefined, 'Alert priority summary is present');

  // 10. Verify Expenses API
  console.log('\n--- 9. Verify Expenses API ---');
  const expRes = await (await fetch(`${API_BASE}/expenses?merchant_id=1`)).json();
  assert(expRes.success === true, 'GET /api/expenses returned success: true');
  assert(Array.isArray(expRes.expenses), `Loaded ${expRes.expenses?.length || 0} expenses`);

  // 11. Verify AI Copilot Chat API
  console.log('\n--- 10. Verify AI Financial Copilot Chat API ---');
  const chatRes = await (await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How much cash do I have right now?', merchant_id: 1 })
  })).json();
  assert(chatRes.success === true, 'POST /api/agent/chat returned success: true');
  assert(chatRes.intent === 'CASH_BALANCE', 'Copilot classified intent as CASH_BALANCE');
  assert(typeof chatRes.answer === 'string' && chatRes.answer.length > 0, 'Copilot returned factual non-empty answer');

  // 12. Cleanup test voice transaction
  console.log('\n--- 11. Cleanup Test Voice Transaction ---');
  if (insertedId) {
    await pool.query('DELETE FROM transactions WHERE id = ?', [insertedId]);
  }
  await pool.query('UPDATE merchants SET current_cash_balance = ? WHERE id = 1', [initialCash]);
  const [finalCheck] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = 1');
  assert(parseFloat(finalCheck[0].current_cash_balance) === initialCash, 'Merchant 1 cash balance safely reset to initial state');

  console.log('\n================================================================');
  console.log(`   E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2EVerification().catch(err => {
  console.error('Fatal E2E Error:', err);
  process.exit(1);
});
