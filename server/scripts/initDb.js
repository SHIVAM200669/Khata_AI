/**
 * initDb.js — Run this script to create the kirana_pilot database
 * and all tables from schema.sql.
 *
 * Usage:  node scripts/initDb.js
 *
 * Reads DB credentials from .env (via dotenv).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function initDatabase() {
  // 1. Connect WITHOUT specifying a database (so we can CREATE it)
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('[initDb] Connected to MySQL server.');

  // 2. Read the schema file
  const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
  const schemaSql  = fs.readFileSync(schemaPath, 'utf-8');

  console.log('[initDb] Running schema.sql …');

  // 3. Execute all statements
  await connection.query(schemaSql);

  console.log('[initDb] Database and tables created successfully.');

  // 4. Verify — list tables
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
    [process.env.DB_NAME || 'kirana_pilot']
  );

  console.log('[initDb] Tables found in kirana_pilot:');
  rows.forEach((r) => console.log(`  - ${r.TABLE_NAME}`));

  await connection.end();
  console.log('[initDb] Done.');
}

initDatabase().catch((err) => {
  console.error('[initDb] FATAL:', err.message);
  process.exit(1);
});
