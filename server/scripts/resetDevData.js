import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/db.js';

async function resetDemoData() {
  console.log('====================================================');
  console.log('      KIRANAPILOT: RESETTING DEMO/DEV DATA          ');
  console.log('====================================================\n');

  const merchantId = 1;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Delete transactions
    const [delTx] = await connection.query('DELETE FROM transactions WHERE merchant_id = ?', [merchantId]);
    console.log(`- Cleared transactions: ${delTx.affectedRows} row(s) deleted.`);

    // 2. Delete customer payments
    const [delPay] = await connection.query('DELETE FROM customer_payments WHERE merchant_id = ?', [merchantId]);
    console.log(`- Cleared customer payments: ${delPay.affectedRows} row(s) deleted.`);

    // 3. Delete expenses
    const [delExp] = await connection.query('DELETE FROM expenses WHERE merchant_id = ?', [merchantId]);
    console.log(`- Cleared expenses: ${delExp.affectedRows} row(s) deleted.`);

    // 4. Delete customers
    const [delCust] = await connection.query('DELETE FROM customers WHERE merchant_id = ?', [merchantId]);
    console.log(`- Cleared customers: ${delCust.affectedRows} row(s) deleted.`);

    // 5. Reset merchant starting cash balance to original starting value ₹15,000.00
    await connection.query('UPDATE merchants SET current_cash_balance = 15000.00 WHERE id = ?', [merchantId]);
    console.log(`- Reset merchant ${merchantId} current_cash_balance to ₹15,000.00.`);

    await connection.commit();
    console.log('\n[SUCCESS] Transaction committed.');

    // Verification queries
    console.log('\n--- VERIFICATION OF DATABASE STATE ---');
    const [[txCount]] = await connection.query('SELECT COUNT(*) as count FROM transactions WHERE merchant_id = ?', [merchantId]);
    const [[custCount]] = await connection.query('SELECT COUNT(*) as count FROM customers WHERE merchant_id = ?', [merchantId]);
    const [[payCount]] = await connection.query('SELECT COUNT(*) as count FROM customer_payments WHERE merchant_id = ?', [merchantId]);
    const [[expCount]] = await connection.query('SELECT COUNT(*) as count FROM expenses WHERE merchant_id = ?', [merchantId]);
    const [[merchantRow]] = await connection.query('SELECT id, name, shop_name, current_cash_balance FROM merchants WHERE id = ?', [merchantId]);

    console.log(`Transactions remaining:   ${txCount.count}`);
    console.log(`Customers remaining:      ${custCount.count}`);
    console.log(`Customer payments:        ${payCount.count}`);
    console.log(`Expenses remaining:       ${expCount.count}`);
    console.log(`Merchant Name:            ${merchantRow.name} (${merchantRow.shop_name})`);
    console.log(`Merchant Cash Balance:    ₹${parseFloat(merchantRow.current_cash_balance).toLocaleString('en-IN')}`);

  } catch (err) {
    await connection.rollback();
    console.error('[ERROR] Failed to reset demo data:', err);
  } finally {
    connection.release();
    await pool.end();
  }
}

resetDemoData();
