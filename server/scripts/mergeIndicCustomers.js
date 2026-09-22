import pool from '../config/db.js';
import { standardizeCustomerName, isCustomerNameMatch, hasDevanagari } from '../utils/indicTransliterator.js';

async function mergeIndicCustomers() {
  console.log('--- Starting Customer Name Standardization & Merge ---');
  const [merchants] = await pool.query('SELECT id FROM merchants');

  for (const m of merchants) {
    const mId = m.id;
    const [custs] = await pool.query('SELECT * FROM customers WHERE merchant_id = ?', [mId]);

    for (const c of custs) {
      if (hasDevanagari(c.name)) {
        const engName = standardizeCustomerName(c.name);
        console.log(`Found Devanagari customer #${c.id} "${c.name}" for Merchant #${mId} -> Target: "${engName}"`);

        // Check if an English customer with this name already exists
        const existing = custs.find(other => other.id !== c.id && isCustomerNameMatch(other.name, engName));
        if (existing) {
          console.log(`-> Merging customer #${c.id} ("${c.name}") into existing #${existing.id} ("${existing.name}")`);
          await pool.query('UPDATE transactions SET customer_id = ? WHERE customer_id = ?', [existing.id, c.id]);
          await pool.query('DELETE FROM customers WHERE id = ?', [c.id]);
        } else {
          console.log(`-> Renaming customer #${c.id} ("${c.name}") to "${engName}"`);
          await pool.query('UPDATE customers SET name = ? WHERE id = ?', [engName, c.id]);
        }
      }
    }
  }

  console.log('--- Customer Name Standardization & Merge Complete ---');
  process.exit(0);
}

mergeIndicCustomers().catch(err => {
  console.error('Merge Error:', err);
  process.exit(1);
});
