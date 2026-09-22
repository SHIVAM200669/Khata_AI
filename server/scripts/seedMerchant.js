import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

export async function ensureDbReady() {
  try {
    // 1. Alter customers table so phone can be NULL
    try {
      await pool.query('ALTER TABLE customers MODIFY phone VARCHAR(20) NULL');
    } catch (e) {
      // Ignore if already modified or index exists
    }

    // 2. Add firebase_uid column to merchants table (Module 11 — Firebase Auth)
    try {
      await pool.query('ALTER TABLE merchants ADD COLUMN firebase_uid VARCHAR(128) NULL AFTER preferred_language');
      console.log('[DB] Added firebase_uid column to merchants table.');
    } catch (e) {
      // Column already exists — ignore
    }

    // 3. Add unique index on firebase_uid (if not exists)
    try {
      await pool.query('ALTER TABLE merchants ADD UNIQUE INDEX uk_merchants_firebase_uid (firebase_uid)');
      console.log('[DB] Added unique index on firebase_uid.');
    } catch (e) {
      // Index already exists — ignore
    }

    // 4. Add email column to merchants table
    try {
      await pool.query('ALTER TABLE merchants ADD COLUMN email VARCHAR(255) NULL AFTER phone');
      console.log('[DB] Added email column to merchants table.');
    } catch (e) {
      // Column already exists — ignore
    }

    // 5. Add unique index on email (if not exists)
    try {
      await pool.query('ALTER TABLE merchants ADD UNIQUE INDEX uk_merchants_email (email)');
      console.log('[DB] Added unique index on email.');
    } catch (e) {
      // Index already exists — ignore
    }

    // 6. Add gstin column
    try {
      await pool.query('ALTER TABLE merchants ADD COLUMN gstin VARCHAR(20) NULL AFTER email');
      console.log('[DB] Added gstin column to merchants table.');
    } catch (e) {
      // Column already exists
    }

    // 7. Add last_login_at column
    try {
      await pool.query('ALTER TABLE merchants ADD COLUMN last_login_at TIMESTAMP NULL');
      console.log('[DB] Added last_login_at column to merchants table.');
    } catch (e) {
      // Column already exists
    }

    // 8. Ensure default demo merchant exists (preserves existing data)
    const [rows] = await pool.query('SELECT * FROM merchants WHERE id = 1');
    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO merchants (id, name, shop_name, phone, preferred_language, current_cash_balance)
        VALUES (1, 'Ramesh Kumar', 'Shree Ganesh Kirana', '9876543210', 'hi', 15000.00)
        ON DUPLICATE KEY UPDATE id=id
      `);
      console.log('[DB] Seeded default merchant with ID 1.');
    } else {
      console.log('[DB] Merchant 1 active. Cash Balance: ₹' + rows[0].current_cash_balance);
    }
  } catch (err) {
    console.error('[DB] ensureDbReady error:', err.message);
  }
}

// If run directly
if (process.argv[1].includes('seedMerchant.js')) {
  ensureDbReady().then(() => process.exit(0));
}
