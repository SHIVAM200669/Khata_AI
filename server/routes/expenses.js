import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

/**
 * GET /api/expenses
 *
 * Query params:
 * - merchant_id: number (default: 1)
 * - status: 'PENDING' | 'PAID' | 'OVERDUE' | 'all'
 */
router.get('/', async (req, res) => {
  const merchantId = req.user.merchantId;
  const status = req.query.status ? String(req.query.status).toUpperCase() : 'ALL';

  try {
    let sql = 'SELECT * FROM expenses WHERE merchant_id = ?';
    const params = [merchantId];

    if (status !== 'ALL' && ['PENDING', 'PAID', 'OVERDUE'].includes(status)) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY due_date ASC, id DESC';

    const [rows] = await pool.query(sql, params);
    return res.status(200).json({
      success: true,
      expenses: rows
    });
  } catch (err) {
    console.error('[expenses/get] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses.'
    });
  }
});

/**
 * POST /api/expenses
 *
 * Creates a new scheduled or pending expense.
 */
router.post('/', async (req, res) => {
  const merchantId = req.user.merchantId;
  const { description, amount, due_date, status } = req.body;

  if (!description || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid description and positive amount for the expense.'
    });
  }

  const cleanDesc = String(description).trim();
  const numAmount = parseFloat(amount);
  const cleanDate = due_date ? String(due_date).trim() : new Date().toISOString().slice(0, 10);
  const cleanStatus = status && ['PENDING', 'PAID', 'OVERDUE'].includes(String(status).toUpperCase())
    ? String(status).toUpperCase()
    : 'PENDING';

  try {
    const [result] = await pool.query(
      'INSERT INTO expenses (merchant_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [merchantId, cleanDesc, numAmount, cleanDate, cleanStatus]
    );

    return res.status(201).json({
      success: true,
      message: 'Expense added successfully.',
      expense: {
        id: result.insertId,
        merchant_id: merchantId,
        description: cleanDesc,
        amount: numAmount,
        due_date: cleanDate,
        status: cleanStatus
      }
    });
  } catch (err) {
    console.error('[expenses/create] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save expense.'
    });
  }
});

export default router;
