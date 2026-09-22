import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'RecoverAI@2026',
  database: 'kirana_pilot'
});

const [tables] = await pool.query('SHOW TABLES');
console.log('Tables:', tables.map(t => Object.values(t)[0]));

try {
  const [cols] = await pool.query('SHOW COLUMNS FROM expenses');
  console.log('expenses columns:', cols.map(c => c.Field));
  const [exps] = await pool.query('SELECT * FROM expenses WHERE merchant_id = 1');
  console.log('expenses rows:', exps.length);
  if (exps.length > 0) console.log('Sample:', JSON.stringify(exps.slice(0, 3)));
} catch (e) {
  console.log('expenses table error:', e.message);
}

const [futTx] = await pool.query(
  `SELECT id, transaction_type, amount, description, transaction_date
   FROM transactions
   WHERE merchant_id = 1 AND transaction_type = 'EXPENSE' AND DATE(transaction_date) > CURDATE()
   ORDER BY transaction_date`
);
console.log('Future expense transactions:', JSON.stringify(futTx, null, 2));

pool.end();
