import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db.js';
import {
  getCustomerRepaymentIntelligence,
  getCustomerPreCreditCheck,
  performFifoSettlement
} from '../services/customerRepaymentIntelligenceService.js';
import { generateCashFlowForecast } from '../services/cashFlowForecastService.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';

const API_BASE = 'http://localhost:5000/api';

async function runModule8Part2Suite() {
  console.log('====================================================');
  console.log(' KIRANAPILOT MODULE 8 PART 2: FIFO & PRE-CREDIT TEST');
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

  const merchantId = 1;
  const otherMerchantId = 2;
  const connection = await pool.getConnection();

  try {
    // Ensure secondary merchant exists for isolation testing
    await connection.query(
      `INSERT INTO merchants (id, name, shop_name, phone, current_cash_balance)
       VALUES (2, 'Test Other Merchant', 'Other Shop', '9999999999', 10000.00)
       ON DUPLICATE KEY UPDATE name=name`
    );

    // SETUP: Clean existing test data for clean test run
    await connection.beginTransaction();
    await connection.query('DELETE FROM transactions WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM customer_payments WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM expenses WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM customers WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('UPDATE merchants SET current_cash_balance = 15000.00 WHERE id = ?', [merchantId]);
    await connection.commit();

    console.log('--- Section 1: Pure Mathematical FIFO Settlement Unit Tests ---');
    // Test FIFO example from user prompt:
    // Credits: ₹2000, ₹1500, ₹800 (Total: 4300)
    // Repayment: ₹1000
    const dummyCredits = [
      { id: 1, amount: 2000, transaction_date: '2026-09-01' },
      { id: 2, amount: 1500, transaction_date: '2026-09-05' },
      { id: 3, amount: 800, transaction_date: '2026-09-10' }
    ];
    const dummyRepay1 = [
      { id: 101, amount: 1000, transaction_date: '2026-09-12' }
    ];

    const fifo1 = performFifoSettlement(dummyCredits, dummyRepay1);
    assert(fifo1.total_credit === 4300, `Total credit is ₹4,300 (actual: ${fifo1.total_credit})`);
    assert(fifo1.total_repaid === 1000, `Total repaid is ₹1,000 (actual: ${fifo1.total_repaid})`);
    assert(fifo1.outstanding === 3300, `Outstanding is ₹3,300 (actual: ${fifo1.outstanding})`);
    assert(fifo1.unsettled_credit_count === 3, `All 3 credits remain unsettled after partial repayment of C1 (actual: ${fifo1.unsettled_credit_count})`);
    assert(fifo1.credits_with_settlement[0].unsettled_amount === 1000, `Credit 1 has ₹1,000 remaining (actual: ${fifo1.credits_with_settlement[0].unsettled_amount})`);
    assert(fifo1.credits_with_settlement[1].unsettled_amount === 1500, `Credit 2 has ₹1,500 remaining (actual: ${fifo1.credits_with_settlement[1].unsettled_amount})`);

    // Additional repayment ₹1500 (total repaid: 2500)
    const dummyRepay2 = [
      { id: 101, amount: 1000, transaction_date: '2026-09-12' },
      { id: 102, amount: 1500, transaction_date: '2026-09-14' }
    ];
    const fifo2 = performFifoSettlement(dummyCredits, dummyRepay2);
    assert(fifo2.total_repaid === 2500, `Total repaid is ₹2,500 (actual: ${fifo2.total_repaid})`);
    assert(fifo2.outstanding === 1800, `Outstanding is ₹1,800 (actual: ${fifo2.outstanding})`);
    assert(fifo2.credits_with_settlement[0].is_settled === true, 'Credit 1 (₹2000) is now fully settled');
    assert(fifo2.credits_with_settlement[1].unsettled_amount === 1000, `Credit 2 has ₹1,000 remaining (actual: ${fifo2.credits_with_settlement[1].unsettled_amount})`);
    assert(fifo2.unsettled_credit_count === 2, `2 unsettled credits remain (actual: ${fifo2.unsettled_credit_count})`);

    // Additional repayment ₹1000 (total repaid: 3500)
    const dummyRepay3 = [
      { id: 101, amount: 1000, transaction_date: '2026-09-12' },
      { id: 102, amount: 1500, transaction_date: '2026-09-14' },
      { id: 103, amount: 1000, transaction_date: '2026-09-16' }
    ];
    const fifo3 = performFifoSettlement(dummyCredits, dummyRepay3);
    assert(fifo3.total_repaid === 3500, `Total repaid is ₹3,500 (actual: ${fifo3.total_repaid})`);
    assert(fifo3.outstanding === 800, `Outstanding is ₹800 (actual: ${fifo3.outstanding})`);
    assert(fifo3.credits_with_settlement[0].is_settled === true, 'Credit 1 is fully settled');
    assert(fifo3.credits_with_settlement[1].is_settled === true, 'Credit 2 is fully settled');
    assert(fifo3.credits_with_settlement[2].unsettled_amount === 800, 'Credit 3 has ₹800 remaining');
    assert(fifo3.unsettled_credit_count === 1, `Exactly 1 unsettled credit remains (actual: ${fifo3.unsettled_credit_count})`);

    console.log('\n--- Section 2: Database End-to-End Test Setup ---');

    // Customer 1: Abhijit (Credits: ₹2000, ₹1500, ₹800. Repayment: ₹1000)
    const [c1Res] = await connection.query('INSERT INTO customers (merchant_id, name, phone) VALUES (?, ?, ?)', [merchantId, 'Abhijit', '9876543210']);
    const c1Id = c1Res.insertId;
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c1Id, 'CREDIT_SALE', 2000.00, '2026-09-01 10:00:00', 'OCR']
    );
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c1Id, 'CREDIT_SALE', 1500.00, '2026-09-05 11:00:00', 'OCR']
    );
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c1Id, 'CREDIT_SALE', 800.00, '2026-09-10 12:00:00', 'VOICE']
    );
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c1Id, 'KHATA_REPAYMENT', 1000.00, '2026-09-12 14:00:00', 'VOICE']
    );

    // Customer 2: Fully Repaid Customer (₹1200 credit, ₹1200 repaid)
    const [c2Res] = await connection.query('INSERT INTO customers (merchant_id, name) VALUES (?, ?)', [merchantId, 'Suresh']);
    const c2Id = c2Res.insertId;
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c2Id, 'CREDIT_SALE', 1200.00, '2026-09-02 10:00:00', 'OCR']
    );
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [merchantId, c2Id, 'KHATA_REPAYMENT', 1200.00, '2026-09-06 10:00:00', 'VOICE']
    );

    // Customer 3: Other merchant customer
    const [c3Res] = await connection.query('INSERT INTO customers (merchant_id, name) VALUES (?, ?)', [otherMerchantId, 'OtherMerchantCust']);
    const c3Id = c3Res.insertId;
    await connection.query(
      'INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, transaction_date, source) VALUES (?, ?, ?, ?, ?, ?)',
      [otherMerchantId, c3Id, 'CREDIT_SALE', 5000.00, '2026-09-10 10:00:00', 'MANUAL']
    );

    console.log('\n--- Section 3: Testing Repayment Intelligence FIFO from Database ---');
    const intel = await getCustomerRepaymentIntelligence(merchantId);
    const abhijitIntel = intel.customers.find(c => c.customer_id === c1Id);
    assert(abhijitIntel !== undefined, 'Abhijit found in intelligence');
    assert(abhijitIntel.total_credit === 4300, `Total credit is ₹4,300 (actual: ${abhijitIntel.total_credit})`);
    assert(abhijitIntel.total_repaid === 1000, `Total repaid is ₹1,000 (actual: ${abhijitIntel.total_repaid})`);
    assert(abhijitIntel.outstanding === 3300, `Outstanding is ₹3,300 (actual: ${abhijitIntel.outstanding})`);
    assert(abhijitIntel.unsettled_credit_count === 3, `Unsettled credit count is 3 (actual: ${abhijitIntel.unsettled_credit_count})`);
    assert(abhijitIntel.recent_unrepaid_count === 3, `Recent unrepaid count is 3 (actual: ${abhijitIntel.recent_unrepaid_count})`);
    assert(abhijitIntel.repayment_rate === 23, `Repayment rate is 23% (actual: ${abhijitIntel.repayment_rate}%)`);

    console.log('\n--- Section 4: Testing Pre-Credit Warning Logic ---');
    // Test 4A: Pre-credit check for customer with outstanding (Abhijit + ₹2000 new credit)
    const preCheckRes1 = await fetch(`${API_BASE}/customers/pre-credit-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        customer_name: 'Abhijit',
        amount: 2000
      })
    });
    const preCheck1 = await preCheckRes1.json();
    assert(preCheck1.success === true, 'Pre-credit check returned 200 OK');
    assert(preCheck1.customer_exists === true, 'Customer exists in DB');
    assert(preCheck1.current_outstanding === 3300, `Current outstanding is ₹3,300 (actual: ${preCheck1.current_outstanding})`);
    assert(preCheck1.new_credit_amount === 2000, `New credit amount is ₹2,000 (actual: ${preCheck1.new_credit_amount})`);
    assert(preCheck1.projected_outstanding === 5300, `Projected outstanding is ₹5,300 (actual: ${preCheck1.projected_outstanding})`);
    assert(preCheck1.show_warning === true, 'show_warning is true for customer with outstanding');
    assert(typeof preCheck1.warning_reason === 'string' && preCheck1.warning_reason.length > 0, `Factual warning reason generated: "${preCheck1.warning_reason}"`);

    // Test 4B: Pre-credit check does NOT create or alter transactions
    const [txCountBefore] = await connection.query('SELECT COUNT(*) as count FROM transactions WHERE merchant_id = ?', [merchantId]);
    assert(txCountBefore[0].count === 6, `Transaction count in MySQL unchanged at 6 (actual: ${txCountBefore[0].count})`);

    // Test 4C: Pre-credit check for fully repaid customer (Suresh + ₹500 new credit)
    const preCheckRes2 = await fetch(`${API_BASE}/customers/pre-credit-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        customer_name: 'Suresh',
        amount: 500
      })
    });
    const preCheck2 = await preCheckRes2.json();
    assert(preCheck2.customer_exists === true, 'Suresh found in DB');
    assert(preCheck2.current_outstanding === 0, `Current outstanding is ₹0 (actual: ${preCheck2.current_outstanding})`);
    assert(preCheck2.projected_outstanding === 500, `Projected outstanding is ₹500 (actual: ${preCheck2.projected_outstanding})`);
    assert(preCheck2.show_warning === false, 'show_warning is false for fully paid customer');

    // Test 4D: Pre-credit check for new unknown customer
    const preCheckRes3 = await fetch(`${API_BASE}/customers/pre-credit-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        customer_name: 'BrandNewCustomer',
        amount: 1000
      })
    });
    const preCheck3 = await preCheckRes3.json();
    assert(preCheck3.customer_exists === false, 'Customer does not exist yet');
    assert(preCheck3.show_warning === false, 'show_warning is false for brand new customer');
    assert(preCheck3.projected_outstanding === 1000, `Projected outstanding is ₹1,000 (actual: ${preCheck3.projected_outstanding})`);

    console.log('\n--- Section 5: Confirming Credit After Warning ---');
    // Confirm Abhijit + ₹2000 credit
    const confirmRes = await fetch(`${API_BASE}/transactions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        transactions: [{
          customer_name: 'Abhijit',
          amount: 2000.00,
          transaction_type: 'CREDIT_SALE',
          description: 'Groceries on credit'
        }]
      })
    });
    const confirmData = await confirmRes.json();
    assert(confirmData.success === true, 'Credit transaction confirmed to MySQL');
    assert(confirmData.saved_transactions.length === 1, 'Exactly one transaction was recorded');

    // Verify transaction count in MySQL incremented by exactly 1
    const [txCountAfter] = await connection.query('SELECT COUNT(*) as count FROM transactions WHERE merchant_id = ?', [merchantId]);
    assert(txCountAfter[0].count === 7, `Transaction count is now exactly 7 (actual: ${txCountAfter[0].count})`);

    // Verify updated intelligence reflects new credit
    const intelAfter = await getCustomerRepaymentIntelligence(merchantId);
    const abhijitAfter = intelAfter.customers.find(c => c.customer_id === c1Id);
    assert(abhijitAfter.total_credit === 6300, `Total credit updated to ₹6,300 (actual: ${abhijitAfter.total_credit})`);
    assert(abhijitAfter.outstanding === 5300, `Outstanding updated to ₹5,300 (actual: ${abhijitAfter.outstanding})`);
    assert(abhijitAfter.credit_transactions === 4, `Credit transaction count is 4 (actual: ${abhijitAfter.credit_transactions})`);

    console.log('\n--- Section 6: Regression Verification ---');
    // Forecast check
    const fc = await generateCashFlowForecast(merchantId);
    assert(fc.success === true, 'Forecast generated successfully');
    assert(fc.forecast.length === 7, '7-day projection window maintained');

    // Voice parser check
    const vp = await parseTransactionTranscript('Maine Abhijit ko 2000 rupaye udhaar diye');
    assert(vp.success === true, 'Voice parser functional');
    assert(vp.transactions[0].customer_name.toLowerCase().includes('abhijit'), 'Customer parsed correctly');

    // OCR parser check
    const ocrp = await parseOcrText('01-09-24 Abhijit Sugar 500 Udhaar');
    assert(ocrp.success === true, 'OCR parser functional');

    // CLEANUP TEST DATA & RESET
    await connection.query('DELETE FROM transactions WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM customer_payments WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM expenses WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('DELETE FROM customers WHERE merchant_id IN (?, ?)', [merchantId, otherMerchantId]);
    await connection.query('UPDATE merchants SET current_cash_balance = 15000.00 WHERE id = ?', [merchantId]);

    console.log('\n--- Test Data Cleaned Up & Database Reset to Baseline ---');

  } catch (err) {
    console.error('Test Suite Error:', err);
    assert(false, 'Test suite execution error', err.message);
  } finally {
    connection.release();
    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runModule8Part2Suite()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
