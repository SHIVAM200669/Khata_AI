import pool from '../config/db.js';

async function check() {
  const [e] = await pool.query('DESCRIBE expenses');
  console.log('expenses columns:', JSON.stringify(e, null, 2));
  await pool.end();
}

check();
