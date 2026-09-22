import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env vars are loaded before pool creation (module-level)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback

/**
 * Reusable MySQL connection pool.
 * Reads all credentials from environment variables — never hardcoded.
 */
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'kirana_pilot',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // Return dates as strings to avoid timezone quirks
  dateStrings: true,
});

/**
 * Ping the database to verify the connection is alive.
 * Returns { success, message } — never exposes credentials.
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { success: true, message: 'MySQL connection successful' };
  } catch (err) {
    // Log full error server-side; return a safe message to the client
    console.error('[DB] Connection test failed:', err.message);
    return {
      success: false,
      message: 'MySQL connection failed',
      error: err.code || 'UNKNOWN_ERROR',
    };
  }
}

export default pool;
