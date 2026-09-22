import { Router } from 'express';
import pool from '../config/db.js';
import { parseTransactionTranscript } from '../services/transactionParserService.js';
import { parseOcrText } from '../services/ocrTransactionParserService.js';
import { standardizeCustomerName, isCustomerNameMatch } from '../utils/indicTransliterator.js';
import { resolveCustomerEntity } from '../services/customerEntityResolutionService.js';

const router = Router();

const ALLOWED_TYPES = ['CASH_SALE', 'CREDIT_SALE', 'KHATA_REPAYMENT', 'EXPENSE'];

/**
 * POST /api/transactions/parse-voice
 *
 * Receives { transcript: string }, runs AI semantic parsing,
 * and returns structured transaction draft(s) with backend timestamp.
 * DOES NOT save anything to database.
 */
router.post('/parse-voice', async (req, res) => {
  const { transcript } = req.body;

  try {
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid non-empty transcript string.'
      });
    }

    const result = await parseTransactionTranscript(transcript);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[transactions/parse-voice] Error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Could not parse transaction from transcript.'
    });
  }
});

/**
 * POST /api/transactions/parse-ocr
 *
 * Receives { text: string, merchant_id?: number }, runs AI semantic parsing on
 * raw handwritten/printed ledger OCR text, normalizes dates & numbers,
 * checks for potential duplicate warnings, and returns transaction drafts.
 * DOES NOT save anything to database.
 */
router.post('/parse-ocr', async (req, res) => {
  const rawText = req.body.text || req.body.ocr_text || req.body.ocrText;
  const merchantId = req.user.merchantId;

  console.log(`[transactions/parse-ocr] Received request. Text present: ${Boolean(rawText)}, Text length: ${rawText ? String(rawText).length : 0}`);
  if (rawText) {
    console.log(`[transactions/parse-ocr] First 200 chars: "${String(rawText).slice(0, 200).replace(/\n/g, ' ')}"`);
  }

  try {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid non-empty OCR extracted text.'
      });
    }

    const result = await parseOcrText(rawText);

    // Duplicate detection check: Warning only, not rejection
    // Check if any draft matches existing records in MySQL (merchant_id, date, amount)
    try {
      const [existingRows] = await pool.query(
        `SELECT id, customer_id, amount, transaction_date, description, source
         FROM transactions
         WHERE merchant_id = ?
         ORDER BY id DESC LIMIT 200`,
        [merchantId]
      );

      for (const item of result.transactions) {
        if (!item.amount || !item.transaction_date) continue;
        const itemDate = item.transaction_date.slice(0, 10);
        const itemAmount = parseFloat(item.amount);

        const dup = existingRows.find(r => {
          const rDate = String(r.transaction_date || '').slice(0, 10);
          const rAmount = parseFloat(r.amount);
          return rDate === itemDate && Math.abs(rAmount - itemAmount) < 0.01;
        });

        if (dup) {
          item.is_duplicate = true;
          item.duplicate_warning = `Possible duplicate of TX-${String(dup.id).padStart(4, '0')} (₹${itemAmount} on ${itemDate})`;
        }
      }
    } catch (dbCheckErr) {
      console.warn('[transactions/parse-ocr] Duplicate check warning:', dbCheckErr.message);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[transactions/parse-ocr] Parser Error:', err.message, err.code);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'OCR_PARSER_ERROR',
      message: err.message || 'Could not parse transactions from OCR text.',
      details: err.raw_content_preview || undefined
    });
  }
});

/**
 * POST /api/transactions/confirm
 *
 * Saves confirmed transaction(s) to MySQL inside an ACID transaction.
 * Creates customer if not existing, inserts into transactions table with source ('VOICE' | 'OCR' | 'MANUAL'),
 * and updates merchant cash balance (with historical balance protection for past OCR imports).
 */
router.post('/confirm', async (req, res) => {
  // Backend controlled merchant_id
  const merchantId = req.user.merchantId;
  let items = req.body.transactions;

  // Support both single transaction object or array
  if (!items && req.body.amount && req.body.transaction_type) {
    items = [req.body];
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No transactions provided for confirmation.'
    });
  }

  // Pre-validate all transactions before opening DB transaction
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amount = parseFloat(item.amount);
    const type = item.transaction_type ? String(item.transaction_type).toUpperCase().trim() : '';

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: `Transaction #${i + 1} has an invalid amount: ${item.amount}`
      });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Transaction #${i + 1} has an unsupported type "${type}". Allowed: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    if ((type === 'CREDIT_SALE' || type === 'KHATA_REPAYMENT') && !item.customer_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: `Transaction #${i + 1} (${type}) requires a customer name.`
      });
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Verify merchant exists
    const [merchantRows] = await connection.query(
      'SELECT id, current_cash_balance FROM merchants WHERE id = ? FOR UPDATE',
      [merchantId]
    );

    if (merchantRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Merchant with ID ${merchantId} not found.`
      });
    }

    let runningCashBalance = parseFloat(merchantRows[0].current_cash_balance || 0);
    const savedTransactions = [];

    const nowD = new Date();
    const localTodayStr = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
    const utcTodayStr = nowD.toISOString().slice(0, 10);

    for (const item of items) {
      const amount = parseFloat(item.amount);
      const type = String(item.transaction_type).toUpperCase().trim();
      const rawCustomer = item.customer_name ? String(item.customer_name).trim() : null;
      const description = item.description ? String(item.description).slice(0, 500) : 'Recorded transaction';
      const source = item.source ? String(item.source).toUpperCase() : 'MANUAL';

      // Parse and format transaction date (preserve original historical ledger date if provided)
      let txDateSql = 'NOW()';
      let txDateVal = null;
      let isNonToday = false; // true for both past AND future dates

      if (item.transaction_date) {
        const cleanDate = String(item.transaction_date).trim();
        // Check if date is valid
        if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
          txDateVal = cleanDate.length === 10 ? `${cleanDate} 12:00:00` : cleanDate.slice(0, 19).replace('T', ' ');
          const dateOnly = cleanDate.slice(0, 10);
          if (item.has_explicit_date === false || item.is_historical === false) {
            isNonToday = false;
          } else if (dateOnly !== localTodayStr && dateOnly !== utcTodayStr) {
            isNonToday = true;
          }
        }
      }

      let customerId = null;

      // 1. Resolve Customer Entity (Exact Match, Ambiguous Match, or No Match)
      if (item.customer_id) {
        const [directCust] = await connection.query(
          'SELECT id FROM customers WHERE id = ? AND merchant_id = ?',
          [item.customer_id, merchantId]
        );
        if (directCust.length > 0) {
          customerId = directCust[0].id;
        }
      }

      if (!customerId && rawCustomer) {
        const resolution = await resolveCustomerEntity(merchantId, rawCustomer);

        if (resolution.status === 'AMBIGUOUS_MATCH') {
          await connection.rollback();
          return res.status(422).json({
            success: false,
            code: 'AMBIGUOUS_CUSTOMER',
            status: 'AMBIGUOUS_MATCH',
            query_name: rawCustomer,
            matches: resolution.matches,
            message: resolution.message
          });
        } else if (resolution.status === 'EXACT_MATCH') {
          customerId = resolution.customer.id;
        } else if (resolution.status === 'NO_MATCH') {
          // Auto-create new customer directly without blocking two-step verification
          const cleanCustName = resolution.standardized_name || standardizeCustomerName(rawCustomer) || rawCustomer;
          const [insertCust] = await connection.query(
            'INSERT INTO customers (merchant_id, name, phone) VALUES (?, ?, NULL)',
            [merchantId, cleanCustName]
          );
          customerId = insertCust.insertId;
        }
      }

      // 2. Insert into transactions table with actual historical or current date
      let txResult;
      if (txDateVal) {
        const [res] = await connection.query(
          `INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [merchantId, customerId, type, amount, description, txDateVal, source]
        );
        txResult = res;
      } else {
        const [res] = await connection.query(
          `INSERT INTO transactions (merchant_id, customer_id, transaction_type, amount, description, transaction_date, source)
           VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
          [merchantId, customerId, type, amount, description, source]
        );
        txResult = res;
      }

      // 3. Update cash balance logic:
      // ONLY today's transactions (or undated/real-time) alter the current cash balance.
      // Past (historical imports) and future (scheduled payments) are recorded but do NOT change today's balance.
      let balanceDelta = 0;
      const isCashLoan = Boolean(item.is_cash_loan) || /(cash loan|gave cash|nagad udhar|cash diya|paise diye|money given|gave money|gave \d+ to)/i.test(description);

      if (!isNonToday || item.force_update_balance) {
        if (type === 'CASH_SALE' || type === 'KHATA_REPAYMENT') {
          balanceDelta = amount;
        } else if (type === 'EXPENSE') {
          balanceDelta = -amount;
        } else if (type === 'CREDIT_SALE') {
          if (isCashLoan) {
            balanceDelta = -amount;
          } else {
            balanceDelta = 0;
          }
        }
      }

      if (balanceDelta !== 0) {
        await connection.query(
          'UPDATE merchants SET current_cash_balance = current_cash_balance + ? WHERE id = ?',
          [balanceDelta, merchantId]
        );
        runningCashBalance += balanceDelta;
      }

      savedTransactions.push({
        id: txResult.insertId,
        merchant_id: merchantId,
        customer_id: customerId,
        customer_name: rawCustomer,
        transaction_type: type,
        amount,
        description,
        transaction_date: txDateVal || new Date().toISOString().slice(0, 19).replace('T', ' '),
        source,
        is_historical: isNonToday,
        created_at: new Date().toISOString()
      });
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `Successfully confirmed and recorded ${savedTransactions.length} transaction(s).`,
      saved_transactions: savedTransactions,
      current_cash_balance: runningCashBalance
    });
  } catch (dbErr) {
    await connection.rollback();
    console.error('[transactions/confirm] DB error:', dbErr);
    return res.status(500).json({
      success: false,
      message: 'Failed to record transaction in database: ' + dbErr.message
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/transactions
 *
 * Returns list of recent transactions for the merchant.
 */
router.get('/', async (req, res) => {
  const merchantId = req.user.merchantId;

  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.merchant_id, t.customer_id, t.transaction_type, t.amount,
              t.description, t.transaction_date, t.source, t.created_at,
              c.name AS customer_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.merchant_id = ?
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 100`,
      [merchantId]
    );

    const [merchantRows] = await pool.query(
      'SELECT id, name, shop_name, current_cash_balance FROM merchants WHERE id = ?',
      [merchantId]
    );

    return res.status(200).json({
      success: true,
      transactions: rows,
      merchant: merchantRows[0] || null
    });
  } catch (err) {
    console.warn('[transactions/get] Database offline, providing demo transactions:', err.message);
    const todayStr = new Date().toISOString().slice(0, 10);
    const demoTxs = [
      {
        id: 101,
        merchant_id: merchantId,
        customer_name: 'Sharma Ji',
        transaction_type: 'CREDIT_SALE',
        amount: 650.00,
        description: 'Aashirvaad Atta 5kg + Fortune Oil',
        transaction_date: `${todayStr} 10:15:00`,
        source: 'VOICE'
      },
      {
        id: 102,
        merchant_id: merchantId,
        customer_name: 'Ramesh Patel',
        transaction_type: 'CASH_SALE',
        amount: 1200.00,
        description: 'Daily provisions & dairy',
        transaction_date: `${todayStr} 09:40:00`,
        source: 'VOICE'
      },
      {
        id: 103,
        merchant_id: merchantId,
        customer_name: 'Gupta Ji',
        transaction_type: 'KHATA_REPAYMENT',
        amount: 2000.00,
        description: 'Weekly Khata settlement',
        transaction_date: `${todayStr} 08:30:00`,
        source: 'OCR'
      },
      {
        id: 104,
        merchant_id: merchantId,
        customer_name: 'Anita Verma',
        transaction_type: 'CREDIT_SALE',
        amount: 350.00,
        description: 'Tea, Sugar, Biscuits',
        transaction_date: `2026-09-20 18:20:00`,
        source: 'VOICE'
      },
      {
        id: 105,
        merchant_id: merchantId,
        customer_name: null,
        transaction_type: 'EXPENSE',
        amount: 1200.00,
        description: 'Shop cleaning & packaging bags',
        transaction_date: `2026-09-20 14:10:00`,
        source: 'MANUAL'
      }
    ];

    return res.status(200).json({
      success: true,
      transactions: demoTxs,
      merchant: {
        id: merchantId || 1,
        name: req.user?.name || 'Shivam Chitlangia',
        shop_name: req.user?.shopName || 'Shree Kirana Store',
        current_cash_balance: 15450.00
      }
    });
  }
});

export default router;
