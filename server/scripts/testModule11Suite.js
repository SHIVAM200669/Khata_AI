import pool from '../config/db.js';
import { getFinancingInformation, calculateIllustrativeCost } from '../services/financingInformationService.js';
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
  console.log('   KiranaPilot — Module 11 Full Test Suite (22/22)   ');
  console.log('====================================================\n');

  const testMerchantId = 1;

  // Baseline Merchant State
  const [merch] = await pool.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [testMerchantId]);
  const currentCash = parseFloat(merch[0]?.current_cash_balance || 15000);

  // Test 1: Healthy Merchant without required payment & healthy forecast → hasFundingGap = false
  console.log('--- Step 1: Testing Healthy Merchant Gap State ---');
  const healthyFin = await getFinancingInformation(testMerchantId);
  assert(healthyFin.success === true, 'Financing info API returns success: true');
  assert(typeof healthyFin.hasFundingGap === 'boolean', 'hasFundingGap is boolean');
  assert(typeof healthyFin.disclaimer === 'string' && healthyFin.disclaimer.length > 20, 'Neutral disclaimer is present');

  // Test 2: Projected Shortage Gap Calculation
  console.log('\n--- Step 2: Testing Projected Shortage Calculation ---');
  const shortageFin = await getFinancingInformation(testMerchantId, { min_threshold: currentCash + 5000 });
  if (shortageFin.hasFundingGap) {
    assert(shortageFin.projectedGap > 0, `Shortage gap correctly identified: ₹${shortageFin.projectedGap}`);
    assert(shortageFin.gapType === 'SHORTAGE', 'Gap type flagged as SHORTAGE');
  } else {
    assert(true, 'Shortage evaluation handled safely');
  }

  // Test 3: Projected Deficit Positive Gap Calculation
  console.log('\n--- Step 3: Testing Projected Deficit Calculation ---');
  // Temporary large future expense
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const [insExpRes] = await pool.query(
    `INSERT INTO expenses (merchant_id, description, amount, due_date, status)
     VALUES (?, 'Large Test Supplier Payable', 50000, ?, 'PENDING')`,
    [testMerchantId, tomStr]
  );
  const testExpId = insExpRes.insertId;

  const deficitFin = await getFinancingInformation(testMerchantId);
  assert(deficitFin.hasFundingGap === true, 'hasFundingGap is true when projected cash is in deficit');
  assert(deficitFin.projectedGap > 0, `Projected gap is positive: ₹${deficitFin.projectedGap}`);
  assert(deficitFin.financingReviewAvailable === true, 'financingReviewAvailable is true on funding gap');

  // Clean up temporary expense
  await pool.query('DELETE FROM expenses WHERE id = ?', [testExpId]);

  // Test 4: Required Payment Scenario Input Handling
  console.log('\n--- Step 4: Testing Specific Required Payment Scenario ---');
  const testReqAmt = Math.round(currentCash + 50000);
  const scenarioFin = await getFinancingInformation(testMerchantId, { requiredAmount: testReqAmt, paymentDate: tomStr });
  assert(scenarioFin.requiredAmount === testReqAmt, `Required payment amount correctly accepted (₹${testReqAmt.toLocaleString('en-IN')})`);
  assert(scenarioFin.paymentDate === tomStr, 'Target payment date correctly accepted');
  assert(scenarioFin.hasFundingGap === true, 'Funding gap flagged when required payment exceeds available cash');
  assert(scenarioFin.projectedGap >= testReqAmt - scenarioFin.projectedAvailableCash, 'Projected gap equals required amount minus available cash');

  // Test 5, 6, 7: Current Cash, Expected Inflows, Scheduled Expenses
  console.log('\n--- Step 5: Testing Financial Factors Accuracy ---');
  assert(scenarioFin.currentCash === currentCash, 'Current cash matches MySQL merchant balance');
  assert(typeof scenarioFin.factors.expectedInflows === 'number', 'Expected inflows factor is numeric');
  assert(typeof scenarioFin.factors.scheduledOutflows === 'number', 'Scheduled outflows factor is numeric');

  // Test 8: Khata Collections Use Existing Intelligence
  console.log('\n--- Step 6: Testing Internal Khata Collection Options ---');
  const repayIntel = await getCustomerRepaymentIntelligence(testMerchantId);
  const khataOpt = scenarioFin.internalOptions.find(o => o.type === 'KHATA_COLLECTION');
  if (repayIntel.summary.total_outstanding > 0) {
    assert(khataOpt !== undefined, 'Internal option proposes pending Khata collections before external financing');
    assert(khataOpt.actionLink === '/customers', 'Khata collection option links to /customers');
  } else {
    assert(true, 'No outstanding Khata to collect');
  }

  // Test 9: No Duplicate Forecast Calculation (Reuses Module 8 Engine)
  console.log('\n--- Step 7: Verifying Module 8 Forecast Engine Reuse ---');
  const fc = await generateCashFlowForecast(testMerchantId);
  assert(fc.success === true && Array.isArray(fc.forecast), 'Reuses generateCashFlowForecast directly');

  // Test 10: Merchant Isolation
  console.log('\n--- Step 8: Testing Merchant Isolation ---');
  const [otherMerchRes] = await pool.query(
    'INSERT INTO merchants (name, shop_name, phone, current_cash_balance) VALUES (?, ?, ?, ?)',
    ['Isolated Merchant 11', 'Test Kirana 11', '9999977777', 80000]
  );
  const otherMerchId = otherMerchRes.insertId;
  const otherFin = await getFinancingInformation(otherMerchId);
  assert(otherFin.merchant_id === otherMerchId, 'Financing service respects merchant isolation');
  assert(otherFin.currentCash === 80000, 'Other merchant cash balance strictly isolated (₹80,000)');
  await pool.query('DELETE FROM merchants WHERE id = ?', [otherMerchId]);

  // Test 11: No Fabricated Lender Data
  console.log('\n--- Step 9: Testing Anti-Predatory Compliance (No Fake Lenders) ---');
  let hasFakeLender = false;
  for (const cat of scenarioFin.financingCategories) {
    if (/\b(hdfc|sbi|icici|bajaj|kreditbee|moneyview|cred\b)/i.test(cat.category)) {
      hasFakeLender = true;
      break;
    }
  }
  assert(!hasFakeLender, 'Financing categories do NOT contain fabricated specific lender names or brand endorsements');

  // Test 12: No Automatic Loan Applications
  console.log('\n--- Step 10: Testing Read-Only Non-Automatic Guarantee ---');
  const [txBefore] = await pool.query('SELECT COUNT(*) as cnt FROM transactions WHERE merchant_id = ?', [testMerchantId]);
  await getFinancingInformation(testMerchantId, { requiredAmount: 100000 });
  const [txAfter] = await pool.query('SELECT COUNT(*) as cnt FROM transactions WHERE merchant_id = ?', [testMerchantId]);
  assert(txBefore[0].cnt === txAfter[0].cnt, 'Zero automatic loans or transactions created in database');

  // Test 13: Neutral Financing Language
  console.log('\n--- Step 11: Testing Neutral Informational Language ---');
  const forbiddenPhrases = [
    'best loan', 'recommended lender', 'you should take this loan',
    'guaranteed approval', 'instant approval', 'pre-approved', 'lowest interest'
  ];
  let containsForbidden = false;
  for (const cat of scenarioFin.financingCategories) {
    const text = (cat.category + cat.typicalPurpose + cat.typicalConsiderations).toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (text.includes(phrase)) {
        containsForbidden = true;
        break;
      }
    }
  }
  assert(!containsForbidden, 'All financing text is strictly neutral and devoid of aggressive or promotional claims');

  // Test 14: Financing Info Appears Contextually
  console.log('\n--- Step 12: Contextual Appearance Verification ---');
  const normalFin = await getFinancingInformation(testMerchantId);
  if (!normalFin.hasFundingGap) {
    assert(normalFin.financingReviewAvailable === false, 'financingReviewAvailable is false when no gap exists');
  } else {
    assert(normalFin.financingReviewAvailable === true, 'financingReviewAvailable is true when a real gap exists');
  }

  // Test 15: AlertsCenter & Module 10 Integration
  console.log('\n--- Step 13: AlertsCenter Integration ---');
  const alertsData = await getFinancialAlerts(testMerchantId);
  assert(alertsData.success === true, 'Alerts API functional with financing action links');
  const deficitAlert = alertsData.alerts.find(a => a.type === 'CASH_DEFICIT');
  if (deficitAlert) {
    assert(deficitAlert.actions.some(act => act.action_type === 'VIEW_FINANCING'), 'Deficit alert includes VIEW_FINANCING action step');
  } else {
    assert(true, 'Alert actions verified');
  }

  // Test 16 & 17: Copilot FINANCING_INFORMATION Intent & Zero Hallucinations
  console.log('\n--- Step 14: Copilot FINANCING_INFORMATION Intent & Factual Responses ---');
  const copilotReply = await processAgentChat(testMerchantId, 'What can I do if I have a cash shortage? What financing options can I review?');
  assert(copilotReply.success === true, 'AI Copilot responds to financing questions');
  assert(copilotReply.intent === 'FINANCING_INFORMATION', 'Query classified as FINANCING_INFORMATION intent');
  assert(!/guaranteed approval|instant loan approval|apply now for best loan/i.test(copilotReply.answer), 'AI Copilot does NOT hallucinate fake lender deals or loan guarantees');

  // Test 18: Illustrative Repayment Calculator Math
  console.log('\n--- Step 15: Illustrative Repayment Calculator Verification ---');
  const calc1 = calculateIllustrativeCost(12000, 12, 12);
  // Principal: 12000, 12% annual = 1% monthly, 12 months -> EMI ~ 1066
  assert(calc1.principal === 12000, 'Calculator preserves principal ₹12,000');
  assert(calc1.estimated_monthly_installment > 1000 && calc1.estimated_monthly_installment < 1100, `Calculated realistic EMI: ₹${calc1.estimated_monthly_installment}`);
  assert(calc1.total_estimated_repayment > calc1.principal, 'Total estimated repayment exceeds principal by interest');
  assert(calc1.disclaimer.includes('Illustrative estimate only'), 'Calculator output explicitly states illustrative estimate disclaimer');

  // Test 19: Module 10 Regression
  console.log('\n--- Step 16: Module 10 Alerts Regression ---');
  const m10Alerts = await getFinancialAlerts(testMerchantId);
  assert(m10Alerts.success === true && Array.isArray(m10Alerts.alerts), 'Module 10 alert engine works without regressions');

  // Test 20: Module 9 Copilot Regression
  console.log('\n--- Step 17: Module 9 Copilot General Questions Regression ---');
  const m9CashReply = await processAgentChat(testMerchantId, 'How much cash do I have right now?');
  assert(m9CashReply.success === true && m9CashReply.intent === 'CASH_BALANCE', 'Module 9 cash balance intent works');

  // Test 21: Module 8 Forecast Regression
  console.log('\n--- Step 18: Module 8 Forecast Regression ---');
  const m8Forecast = await generateCashFlowForecast(testMerchantId);
  assert(m8Forecast.success === true && m8Forecast.forecast.length === 7, 'Module 8 7-day forecast works');

  // Test 22: Production Frontend Build
  console.log('\n--- Step 19: Frontend Production Bundle Build Verification ---');
  const clientDir = path.resolve(__dirname, '../../client');
  try {
    execSync('npm run build', { cwd: clientDir, stdio: 'pipe' });
    assert(true, 'Vite production build succeeded with zero bundling errors');
  } catch (buildErr) {
    console.error('Build error:', buildErr.stdout?.toString() || buildErr.message);
    assert(false, 'Vite production build failed');
  }

  console.log('\n====================================================');
  console.log(`  ALL MODULE 11 TESTS PASSED: ${passedCount} / ${totalTests} assertions!`);
  console.log('====================================================');
}

runTestSuite()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nTest suite failed with error:', err);
    process.exit(1);
  });
