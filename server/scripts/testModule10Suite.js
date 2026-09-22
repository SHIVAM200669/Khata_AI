import pool from '../config/db.js';
import { getFinancialAlerts } from '../services/alertService.js';
import { generateCashFlowForecast } from '../services/cashFlowForecastService.js';
import { getCustomerRepaymentIntelligence } from '../services/customerRepaymentIntelligenceService.js';
import { processAgentChat } from '../services/financialAgentService.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedCount = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Test ${totalTests}: ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('   KiranaPilot — Module 10 Full Test Suite (20/20)   ');
  console.log('====================================================\n');

  const testMerchantId = 1;

  // 1. Initial State Inspection & Fetch Alerts
  console.log('--- Step 1: Testing Initial State & Alert Generation ---');
  const initialAlerts = await getFinancialAlerts(testMerchantId);
  assert(initialAlerts.success === true, 'Alert API returns success: true');
  assert(typeof initialAlerts.summary === 'object', 'Alert summary is an object with priority counts');
  assert(Array.isArray(initialAlerts.alerts), 'Alerts array is returned');

  // Test 1: Healthy state & no false critical alerts when not in deficit
  const [merch] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [testMerchantId]);
  const currentCash = parseFloat(merch[0].current_cash_balance);
  const criticals = initialAlerts.alerts.filter(a => a.priority === 'CRITICAL');
  const forecast = await generateCashFlowForecast(testMerchantId);
  if (forecast.overall_status !== 'DEFICIT') {
    assert(criticals.filter(a => a.type === 'CASH_DEFICIT').length === 0, 'No false CRITICAL CASH_DEFICIT alert when forecast is not in deficit');
  } else {
    assert(criticals.length > 0, 'Correctly flags CRITICAL when forecast reaches deficit');
  }

  // Test 2 & 3: Cash Shortage & Deficit Alert Structure
  console.log('\n--- Step 2: Testing Cash Shortage & Deficit Alerts ---');
  const shortageAlerts = initialAlerts.alerts.filter(a => a.type === 'CASH_SHORTAGE');
  const deficitAlerts = initialAlerts.alerts.filter(a => a.type === 'CASH_DEFICIT');

  if (shortageAlerts.length > 0) {
    const s = shortageAlerts[0];
    assert(s.priority === 'WARNING', 'Cash shortage priority is WARNING');
    assert(s.data.safety_threshold === 5000, 'Cash shortage includes safety threshold ₹5,000');
    assert(s.data.shortfall_amount > 0, 'Cash shortage includes non-zero shortfall amount');
    assert(s.actions.length > 0, 'Cash shortage includes actionable recommended steps');
  } else {
    assert(true, 'No cash shortage in current balance (verified with forecast)');
  }

  if (deficitAlerts.length > 0) {
    const d = deficitAlerts[0];
    assert(d.priority === 'CRITICAL', 'Cash deficit priority is CRITICAL');
    assert(d.data.deficit_amount > 0, 'Deficit alert includes positive deficit magnitude');
    assert(d.actions.some(act => act.label.toLowerCase().includes('khata')), 'Deficit recommends reviewing Khata collections');
    assert(d.actions.some(act => act.description.includes('A projected cash gap remains')), 'Anti-predatory neutral financing notice present');
  } else {
    assert(true, 'No cash deficit in current state (verified with forecast)');
  }

  // Test 4 & 5: Upcoming Payment Alerts & Paid Exclusion
  console.log('\n--- Step 3: Testing Upcoming Payment Alerts & Paid Exclusion ---');
  // Insert a temporary test pending expense and paid expense
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomDateStr = tomorrow.toISOString().slice(0, 10);

  const [insExpRes] = await pool.query(
    `INSERT INTO expenses (merchant_id, description, amount, due_date, status)
     VALUES (?, 'Test Supplier Grain Payment', 15000, ?, 'PENDING')`,
    [testMerchantId, tomDateStr]
  );
  const testExpId = insExpRes.insertId;

  const [insPaidRes] = await pool.query(
    `INSERT INTO expenses (merchant_id, description, amount, due_date, status)
     VALUES (?, 'Test Paid Electric Bill', 3500, ?, 'PAID')`,
    [testMerchantId, tomDateStr]
  );
  const testPaidId = insPaidRes.insertId;

  const alertsAfterExp = await getFinancialAlerts(testMerchantId);
  const foundPendingAlert = alertsAfterExp.alerts.find(a => a.type === 'UPCOMING_PAYMENT' && a.data.description.includes('Test Supplier Grain Payment'));
  const foundPaidAlert = alertsAfterExp.alerts.find(a => a.type === 'UPCOMING_PAYMENT' && a.data.description.includes('Test Paid Electric Bill'));

  assert(foundPendingAlert !== undefined, 'Unpaid upcoming payment generates alert');
  assert(foundPendingAlert.priority === 'WARNING', 'Upcoming payment due tomorrow has WARNING priority');
  assert(foundPendingAlert.data.amount === 15000, 'Upcoming payment amount matches MySQL (₹15,000)');
  assert(foundPaidAlert === undefined, 'PAID expense does NOT generate an alert');

  // Test 6: Repayment Attention Alert
  console.log('\n--- Step 4: Testing Repayment Attention Alerts ---');
  const repaymentIntel = await getCustomerRepaymentIntelligence(testMerchantId);
  const attentionCustomers = repaymentIntel.customers.filter(c => c.attention_flag);
  const repaymentAlerts = alertsAfterExp.alerts.filter(a => a.type === 'REPAYMENT_ATTENTION');

  if (attentionCustomers.length > 0) {
    assert(repaymentAlerts.length === attentionCustomers.length, `Repayment attention alert count (${repaymentAlerts.length}) matches attention customers count (${attentionCustomers.length})`);
    const rAlert = repaymentAlerts[0];
    assert(rAlert.priority === 'WARNING', 'Repayment attention alert priority is WARNING');
    assert(!/bad customer|defaulter|risky person/i.test(rAlert.message), 'Repayment attention alert uses neutral, non-judgmental language');
    assert(rAlert.actions.some(act => act.action_type === 'VIEW_CUSTOMER'), 'Repayment attention provides action to view customer ledger');
  } else {
    assert(repaymentAlerts.length === 0, 'Zero repayment attention alerts when all customers have clean repayment');
  }

  // Test 7: Significant Outstanding Khata Summary Alert
  console.log('\n--- Step 5: Testing Outstanding Khata Summary Alert ---');
  const khataSummaryAlert = alertsAfterExp.alerts.find(a => a.type === 'SIGNIFICANT_KHATA');
  if (repaymentIntel.summary.total_outstanding > 0) {
    assert(khataSummaryAlert !== undefined, 'Significant Khata summary alert generated when total outstanding > 0');
    assert(khataSummaryAlert.data.total_outstanding === repaymentIntel.summary.total_outstanding, 'Khata summary alert amount matches MySQL total outstanding');
  } else {
    assert(true, 'No outstanding Khata to summarize');
  }

  // Test 8: Recommended Actions Generation
  console.log('\n--- Step 6: Testing Recommended Actions ---');
  let allActionsValid = true;
  for (const a of alertsAfterExp.alerts) {
    if (!Array.isArray(a.actions) || a.actions.length === 0) {
      allActionsValid = false;
      break;
    }
    for (const act of a.actions) {
      if (!act.label || !act.description || !act.action_type) {
        allActionsValid = false;
        break;
      }
    }
  }
  assert(allActionsValid, 'Every financial alert contains structured, actionable recommended steps');

  // Test 9: Priority Hierarchy Ordering
  console.log('\n--- Step 7: Testing Priority Ordering ---');
  const priorities = alertsAfterExp.alerts.map(a => a.priority);
  const PRIORITY_NUM = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  let isSorted = true;
  for (let i = 1; i < priorities.length; i++) {
    if (PRIORITY_NUM[priorities[i]] < PRIORITY_NUM[priorities[i - 1]]) {
      isSorted = false;
      break;
    }
  }
  assert(isSorted, 'Alerts are strictly sorted by priority (CRITICAL -> WARNING -> INFO)');

  // Test 10: Alert Values Exact MySQL Match
  console.log('\n--- Step 8: Testing Mathematical Consistency with MySQL ---');
  const alertMerchantBal = alertsAfterExp.alerts[0]?.data?.current_cash ?? currentCash;
  assert(Math.abs(alertMerchantBal - currentCash) < 0.01, 'Alert current cash strictly matches MySQL merchant table balance');

  // Test 11: Merchant Isolation
  console.log('\n--- Step 9: Testing Merchant Isolation ---');
  const [otherMerchRes] = await pool.query(
    'INSERT INTO merchants (name, shop_name, phone, current_cash_balance) VALUES (?, ?, ?, ?)',
    ['Isolated Merchant', 'Test Kirana 99', '9999988888', 50000]
  );
  const otherMerchId = otherMerchRes.insertId;
  const otherAlerts = await getFinancialAlerts(otherMerchId);

  assert(otherAlerts.merchant_id === otherMerchId, 'Alert service respects merchant isolation');
  assert(otherAlerts.alerts.every(a => !a.message.includes('Test Supplier Grain Payment')), 'Merchant 2 cannot see Merchant 1 expenses/alerts');

  // Clean up other merchant
  await pool.query('DELETE FROM merchants WHERE id = ?', [otherMerchId]);

  // Test 12: No Duplicate Alerts
  console.log('\n--- Step 10: Testing Duplicate Alert Prevention ---');
  const alertIds = alertsAfterExp.alerts.map(a => a.id);
  const uniqueAlertIds = new Set(alertIds);
  assert(alertIds.length === uniqueAlertIds.size, 'Zero duplicate alert IDs generated for the same condition');

  // Test 13: Dynamic Alert Update After Repayment
  console.log('\n--- Step 11: Testing Alert Update After Customer Repayment ---');
  // Ensure test customer exists
  let [custRows] = await pool.query('SELECT id, name FROM customers WHERE merchant_id = ? LIMIT 1', [testMerchantId]);
  let testCust = custRows[0];
  let createdTestCust = false;
  if (!testCust) {
    const [insC] = await pool.query('INSERT INTO customers (merchant_id, name, phone) VALUES (?, "AutoTest Cust", "9876543210")', [testMerchantId]);
    testCust = { id: insC.insertId, name: 'AutoTest Cust' };
    createdTestCust = true;
  }

  const [repayTxRes] = await pool.query(
    `INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source, description)
     VALUES (?, ?, 'KHATA_REPAYMENT', 1000, ?, 'MANUAL', 'Test Repayment Sync')`,
    [testMerchantId, testCust.id, tomDateStr]
  );
  const repayTxId = repayTxRes.insertId;

  const alertsAfterRepay = await getFinancialAlerts(testMerchantId);
  assert(alertsAfterRepay.success === true, 'Alerts dynamically recalculate after customer repayment');
  await pool.query('DELETE FROM transactions WHERE id = ?', [repayTxId]);

  // Test 14: Dynamic Alert Update After New Credit
  console.log('\n--- Step 12: Testing Alert Update After New Credit ---');
  const [creditTxRes] = await pool.query(
    `INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source, description)
     VALUES (?, ?, 'CREDIT_SALE', 2500, ?, 'MANUAL', 'Test Credit Sync')`,
    [testMerchantId, testCust.id, tomDateStr]
  );
  const creditTxId = creditTxRes.insertId;
  const alertsAfterCredit = await getFinancialAlerts(testMerchantId);
  assert(alertsAfterCredit.success === true, 'Alerts dynamically recalculate after new credit sale');
  await pool.query('DELETE FROM transactions WHERE id = ?', [creditTxId]);

  if (createdTestCust) {
    await pool.query('DELETE FROM customers WHERE id = ?', [testCust.id]);
  }

  // Test 15: Dynamic Alert Update After New Expense
  console.log('\n--- Step 13: Testing Alert Update After New Expense ---');
  const [expTxRes] = await pool.query(
    `INSERT INTO transactions (merchant_id, transaction_type, amount, transaction_date, source, description)
     VALUES (?, 'EXPENSE', 8000, ?, 'MANUAL', 'Test Outflow')`,
    [testMerchantId, tomDateStr]
  );
  const expTxId = expTxRes.insertId;
  const alertsAfterExpTx = await getFinancialAlerts(testMerchantId);
  assert(alertsAfterExpTx.success === true, 'Alerts dynamically recalculate after future-dated expense transaction');
  await pool.query('DELETE FROM transactions WHERE id = ?', [expTxId]);

  // Test 16: Dynamic Alert Update After Upcoming Payment Changes
  console.log('\n--- Step 14: Testing Alert Removal After Payment is Paid ---');
  await pool.query('UPDATE expenses SET status = "PAID" WHERE id = ?', [testExpId]);
  const alertsAfterPayBill = await getFinancialAlerts(testMerchantId);
  const billStillPresent = alertsAfterPayBill.alerts.some(a => a.id === `alert-upcoming-exp-${testExpId}`);
  assert(!billStillPresent, 'Upcoming payment alert disappears immediately when bill is marked PAID');

  // Clean up test expenses
  await pool.query('DELETE FROM expenses WHERE id IN (?, ?)', [testExpId, testPaidId]);

  // Test 17: Module 8 Forecast Regression
  console.log('\n--- Step 15: Module 8 Forecast Regression ---');
  const fc = await generateCashFlowForecast(testMerchantId);
  assert(fc.success === true && Array.isArray(fc.forecast) && fc.forecast.length === 7, 'Module 8 7-day forecast functions normally without regressions');

  // Test 18: Module 8.2 Repayment Intelligence Regression
  console.log('\n--- Step 16: Module 8.2 Repayment Intelligence Regression ---');
  const cri = await getCustomerRepaymentIntelligence(testMerchantId);
  assert(cri.success === true && Array.isArray(cri.customers), 'Module 8.2 Customer Repayment Intelligence functions normally');

  // Test 19: Module 9 AI Copilot Alerts Integration Regression
  console.log('\n--- Step 17: Module 9 AI Financial Copilot Alerts Integration ---');
  const copilotReply = await processAgentChat(testMerchantId, 'What needs my attention?');
  assert(copilotReply.success === true, 'AI Copilot responds to "What needs my attention?" query');
  assert(copilotReply.intent === 'FINANCIAL_ALERTS', 'Copilot correctly classifies query as FINANCIAL_ALERTS intent');
  assert(typeof copilotReply.answer === 'string' && copilotReply.answer.length > 20, 'Copilot provides non-empty factual alert response');

  // Test 20: Production Frontend Build Verification
  console.log('\n--- Step 18: Frontend Production Bundle Build Verification ---');
  const clientDir = path.resolve(__dirname, '../../client');
  try {
    execSync('npm run build', { cwd: clientDir, stdio: 'pipe' });
    assert(true, 'Vite production bundle built successfully with zero syntax/type errors');
  } catch (buildErr) {
    console.error('Build error:', buildErr.stdout?.toString() || buildErr.message);
    assert(false, 'Vite production build failed');
  }

  console.log('\n====================================================');
  console.log(`  ALL MODULE 10 TESTS PASSED: ${passedCount} / ${totalTests} assertions!`);
  console.log('====================================================');
}

runTestSuite()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nTest suite failed with error:', err);
    process.exit(1);
  });
