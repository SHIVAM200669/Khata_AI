import assert from 'assert';
import pool from '../config/db.js';
import { processAgentChat, generateDeterministicFallback } from '../services/financialAgentService.js';
import { buildFinancialAgentContext, classifyIntent, extractAmount, extractTargetDate } from '../services/financialAgentContextService.js';
import { generateCashFlowForecast } from '../services/cashFlowForecastService.js';
import { getCustomerRepaymentIntelligence } from '../services/customerRepaymentIntelligenceService.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';

const API_BASE = 'http://localhost:5000/api';

async function runModule9TestSuite() {
  console.log('====================================================');
  console.log(' KIRANAPILOT MODULE 9: AI FINANCIAL AGENT TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const connection = await pool.getConnection();

  try {
    const merchantId = 1;

    console.log('--- Section 1: Entity & Intent Extraction Tests ---');
    // Test 1: Amount extractor
    record(extractAmount('Can I pay ₹50,000 tomorrow?') === 50000, 'extractAmount parsed ₹50,000 to 50000');
    record(extractAmount('50k payment') === 50000, 'extractAmount parsed 50k to 50000');
    record(extractAmount('20 hazar rupaye') === 20000, 'extractAmount parsed 20 hazar to 20000');
    record(extractAmount('1.5 lakh') === 150000, 'extractAmount parsed 1.5 lakh to 150000');
    record(extractAmount('How much cash do I have?') === null, 'extractAmount returns null when no amount present');

    // Test 2: Target date extractor
    const d1 = extractTargetDate('Will I have enough money tomorrow?');
    record(d1.relativeLabel === 'tomorrow' && d1.dayOffset === 1, 'extractTargetDate identified tomorrow');
    const d2 = extractTargetDate('Kal kitne paise honge?');
    record(d2.relativeLabel === 'tomorrow', 'extractTargetDate identified "kal" as tomorrow');
    const d3 = extractTargetDate('Aaj kitni bikri hui?');
    record(d3.relativeLabel === 'today' && d3.dayOffset === 0, 'extractTargetDate identified today');

    // Test 3: Intent classification
    record(classifyIntent('How much cash do I have?') === 'CASH_BALANCE', 'Classified CASH_BALANCE intent');
    record(classifyIntent('How much did I sell today?') === 'TODAY_SALES', 'Classified TODAY_SALES intent');
    record(classifyIntent('How much do customers owe me?') === 'KHATA_OUTSTANDING', 'Classified KHATA_OUTSTANDING intent');
    record(classifyIntent('Who owes me the most?') === 'CUSTOMER_DETAILS', 'Classified CUSTOMER_DETAILS intent');
    record(classifyIntent('Which customers have not repaid recently?') === 'CUSTOMER_REPAYMENT', 'Classified CUSTOMER_REPAYMENT intent');
    record(classifyIntent('Will I have enough money tomorrow?') === 'CASH_FORECAST', 'Classified CASH_FORECAST intent');
    record(classifyIntent('Why am I going to have a cash shortage?') === 'CASH_SHORTAGE', 'Classified CASH_SHORTAGE intent');
    record(classifyIntent('Can I pay ₹50,000 tomorrow?') === 'URGENT_PAYMENT', 'Classified URGENT_PAYMENT intent');
    record(classifyIntent('Mujhe kal 50000 dene hain kya paise honge?') === 'URGENT_PAYMENT', 'Classified Hinglish URGENT_PAYMENT intent');
    record(classifyIntent('What are my upcoming payments?') === 'UPCOMING_PAYMENTS', 'Classified UPCOMING_PAYMENTS intent');

    console.log('\n--- Section 2: Database Setup & Context Builder Tests ---');
    // Clear and set deterministic state for test
    await connection.query('DELETE FROM transactions WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM customer_payments WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM expenses WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM customers WHERE merchant_id = ?', [merchantId]);
    await connection.query('UPDATE merchants SET current_cash_balance = 18000.00 WHERE id = ?', [merchantId]);

    // Insert 2 customers
    const [c1Res] = await connection.query('INSERT INTO customers (merchant_id, name, phone) VALUES (?, ?, ?)', [merchantId, 'Vikram', '9876543210']);
    const [c2Res] = await connection.query('INSERT INTO customers (merchant_id, name, phone) VALUES (?, ?, ?)', [merchantId, 'Ramesh', '9876543211']);
    const vId = c1Res.insertId;
    const rId = c2Res.insertId;

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Insert transactions
    // Today's counter cash sale: ₹3,000
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source) VALUES (?, NULL, ?, ?, ?, ?, ?)',
      [merchantId, 'CASH_SALE', 3000.00, 'Counter cash sale', todayStr, 'VOICE']
    );
    // Vikram credit sale: ₹8,000
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [merchantId, vId, 'CREDIT_SALE', 8000.00, 'Groceries on credit', yesterday, 'OCR']
    );
    // Vikram partial repayment: ₹1,000
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [merchantId, vId, 'KHATA_REPAYMENT', 1000.00, 'Partial cash repayment', todayStr, 'VOICE']
    );
    // Ramesh credit sale: ₹4,000
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [merchantId, rId, 'CREDIT_SALE', 4000.00, 'Wheat and oil on credit', yesterday, 'OCR']
    );

    // Insert upcoming supplier bill
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await connection.query(
      'INSERT INTO expenses (merchant_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [merchantId, 'Amul Dairy Supplier Bill', 6000.00, tomorrowStr, 'PENDING']
    );

    // Test Context Builder
    const ctx = await buildFinancialAgentContext(merchantId, 'Can I pay ₹50,000 tomorrow?');
    record(ctx.merchant.cash_balance === 18000, `Context cash balance matches MySQL (₹18,000)`);
    record(ctx.today.total_sales === 3000, `Context today sales matches MySQL (₹3,000)`);
    record(ctx.khata.total_outstanding === 11000, `Context total Khata outstanding matches MySQL (₹11,000)`);
    record(ctx.khata.top_debtors[0].name === 'Vikram' && ctx.khata.top_debtors[0].outstanding === 7000, `Top debtor identified as Vikram with ₹7,000`);
    record(ctx.scenario.amount === 50000, `Scenario amount correctly set to 50000`);
    record(ctx.scenario.cash_gap > 0, `Scenario accurately calculates projected cash gap`);
    record(ctx.upcoming_expenses.length >= 1, `Upcoming expenses loaded from MySQL`);

    console.log('\n--- Section 3: AI Financial Agent Chat & Fallback Verification ---');
    // Test Deterministic Fallback Engine directly
    const fallbackCash = generateDeterministicFallback({ ...ctx, intent: 'CASH_BALANCE' }, 'How much cash do I have?');
    record(fallbackCash.includes('18,000'), `Fallback cash response contains exact ₹18,000`);

    const fallbackSales = generateDeterministicFallback({ ...ctx, intent: 'TODAY_SALES' }, 'How much did I sell today?');
    record(fallbackSales.includes('3,000'), `Fallback sales response contains exact ₹3,000`);

    const fallbackKhata = generateDeterministicFallback({ ...ctx, intent: 'KHATA_OUTSTANDING' }, 'How much do customers owe me?');
    record(fallbackKhata.includes('11,000'), `Fallback Khata response contains exact ₹11,000`);

    const fallbackPayment = generateDeterministicFallback({ ...ctx, intent: 'URGENT_PAYMENT' }, 'Can I pay 50000 tomorrow?');
    record(fallbackPayment.includes('50,000') && (fallbackPayment.includes('gap') || fallbackPayment.includes('kami')), `Fallback payment scenario explains cash gap`);

    console.log('\n--- Section 4: Live HTTP API Endpoints (/api/agent/chat) ---');
    // Test 4A: Cash Balance Query via API
    const resCash = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How much cash do I have?' })
    });
    const dataCash = await resCash.json();
    record(dataCash.success === true, 'POST /api/agent/chat returned 200 OK');
    record(dataCash.intent === 'CASH_BALANCE', 'Identified CASH_BALANCE intent');
    record(dataCash.answer.includes('18,000'), 'API cash answer contains ₹18,000');
    record(dataCash.data_cards.some(c => c.type === 'cash'), 'Returned cash data card');

    // Test 4B: Large Payment Query via API
    const resPay = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Can I pay ₹50,000 tomorrow?' })
    });
    const dataPay = await resPay.json();
    record(dataPay.success === true, 'Large payment query succeeded');
    record(dataPay.intent === 'URGENT_PAYMENT', 'Identified URGENT_PAYMENT intent');
    record(dataPay.data_cards.some(c => c.type === 'warning' || c.label.includes('Gap')), 'Returned Cash Gap warning card');

    // Test 4C: Top Debtors Query via API
    const resDebtor = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Who owes me the most?' })
    });
    const dataDebtor = await resDebtor.json();
    record(dataDebtor.success === true, 'Top debtors query succeeded');
    record(dataDebtor.answer.toLowerCase().includes('vikram'), 'Response identified Vikram as top debtor');

    // Test 4D: Hindi / Hinglish Query
    const resHi = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Kal mere paas kitne paise honge?' })
    });
    const dataHi = await resHi.json();
    record(dataHi.success === true, 'Hindi forecast query succeeded');
    record(dataHi.intent === 'CASH_FORECAST', 'Identified CASH_FORECAST intent for Hindi query');

    // Test 4E: Suggested Prompts API
    const resPrompts = await fetch(`${API_BASE}/agent/suggested-prompts`);
    const dataPrompts = await resPrompts.json();
    record(dataPrompts.success === true && Array.isArray(dataPrompts.suggestions), 'GET /api/agent/suggested-prompts returned categories');

    console.log('\n--- Section 5: Read-Only Safety & Isolation Guarantees ---');
    // Count transactions in DB before and after
    const [txCount1] = await connection.query('SELECT COUNT(*) as c FROM transactions WHERE merchant_id = ?', [merchantId]);
    const [custCount1] = await connection.query('SELECT COUNT(*) as c FROM customers WHERE merchant_id = ?', [merchantId]);
    const [expCount1] = await connection.query('SELECT COUNT(*) as c FROM expenses WHERE merchant_id = ?', [merchantId]);
    const [merchantRow1] = await connection.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [merchantId]);

    // Send a message asking to record / modify something
    await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Please add a transaction of 5000 cash sale and increase my balance' })
    });

    const [txCount2] = await connection.query('SELECT COUNT(*) as c FROM transactions WHERE merchant_id = ?', [merchantId]);
    const [custCount2] = await connection.query('SELECT COUNT(*) as c FROM customers WHERE merchant_id = ?', [merchantId]);
    const [expCount2] = await connection.query('SELECT COUNT(*) as c FROM expenses WHERE merchant_id = ?', [merchantId]);
    const [merchantRow2] = await connection.query('SELECT current_cash_balance FROM merchants WHERE id = ?', [merchantId]);

    record(txCount1[0].c === txCount2[0].c, 'Transaction table count unchanged (0 modifications)');
    record(custCount1[0].c === custCount2[0].c, 'Customer table count unchanged (0 modifications)');
    record(expCount1[0].c === expCount2[0].c, 'Expenses table count unchanged (0 modifications)');
    record(merchantRow1[0].current_cash_balance === merchantRow2[0].current_cash_balance, 'Merchant cash balance unchanged (read-only safety verified)');

    console.log('\n--- Section 6: Modules 1–8 Regression Tests ---');
    // Regression 1: Forecast Service
    const fc = await generateCashFlowForecast(merchantId);
    record(fc.success === true && fc.forecast.length === 7, 'Module 8.1 7-Day Forecast functional');

    // Regression 2: FIFO Repayment Intelligence
    const intel = await getCustomerRepaymentIntelligence(merchantId);
    record(intel.success === true && intel.customers.length === 2, 'Module 8.2 Customer Intelligence functional');

    // Regression 3: Voice parser
    const vp = await parseTransactionTranscript('Maine Vikram ko 2000 ka maal udhar diya');
    record(vp.success === true && vp.transactions[0].customer_name.toLowerCase().includes('vikram'), 'Module 4 Voice parser operational');

    // Regression 4: OCR parser
    const op = await parseOcrText('01-09-24 Ramesh Sugar 500 Udhaar');
    record(op.success === true && op.transactions.length >= 1, 'Module 6 OCR parser operational');

    console.log('\n--- Test Data Cleanup & Reset to Baseline ---');
    await connection.query('DELETE FROM transactions WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM customer_payments WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM expenses WHERE merchant_id = ?', [merchantId]);
    await connection.query('DELETE FROM customers WHERE merchant_id = ?', [merchantId]);
    await connection.query('UPDATE merchants SET current_cash_balance = 15000.00 WHERE id = ?', [merchantId]);

  } catch (err) {
    console.error('Test suite execution error:', err);
    failed++;
  } finally {
    connection.release();
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runModule9TestSuite();
