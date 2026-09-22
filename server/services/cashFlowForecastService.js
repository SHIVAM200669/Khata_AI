import pool from '../config/db.js';

const DEFAULT_MIN_CASH_THRESHOLD = 5000;

/**
 * Formats a Date object or string to YYYY-MM-DD string in local/merchant calendar
 */
function toDateStr(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    const match = date.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates a dynamic 7-day cash-flow forecast based on real MySQL data.
 *
 * @param {number} merchantId Merchant ID (default: 1)
 * @param {object} options Optional config overrides (e.g. min_threshold)
 * @returns {Promise<object>}
 */
export async function generateCashFlowForecast(merchantId = 1, options = {}) {
  const minThreshold = parseFloat(options.min_threshold || DEFAULT_MIN_CASH_THRESHOLD);

  // 1. Fetch current cash balance of the merchant
  const [merchantRows] = await pool.query(
    'SELECT id, name, shop_name, current_cash_balance FROM merchants WHERE id = ?',
    [merchantId]
  );

  if (merchantRows.length === 0) {
    throw Object.assign(new Error(`Merchant with ID ${merchantId} not found.`), {
      code: 'MERCHANT_NOT_FOUND',
      statusCode: 404
    });
  }

  const currentCash = parseFloat(merchantRows[0].current_cash_balance || 0);

  // 2. Fetch all historical transactions for this merchant
  const [transactions] = await pool.query(
    `SELECT id, customer_id, transaction_type, amount, description, transaction_date, source
     FROM transactions
     WHERE merchant_id = ?
     ORDER BY transaction_date ASC`,
    [merchantId]
  );

  // 3. Fetch all upcoming/pending expenses from expenses table
  const [pendingExpenses] = await pool.query(
    `SELECT id, description, amount, due_date, status
     FROM expenses
     WHERE merchant_id = ? AND status = 'PENDING'
     ORDER BY due_date ASC`,
    [merchantId]
  );

  // 4. Analyze historical cash sales, repayments, and expenses
  //    IMPORTANT: Future-dated transactions are NOT historical — they are scheduled.
  let totalCreditGiven = 0;
  let totalRepayments = 0;
  let totalCashSales = 0;
  let totalHistoricalExpenses = 0;

  const cashSalesByDate = {};
  const repaymentsByDate = {};
  const expensesByDate = {};
  const distinctDates = new Set();
  const todayStr = toDateStr(new Date());

  // Separate future-dated expenses from historical data
  const futureTxExpenses = [];

  for (const t of transactions) {
    const amt = parseFloat(t.amount || 0);
    const dateStr = toDateStr(t.transaction_date);

    // Future-dated EXPENSE transactions → scheduled, NOT historical
    if (t.transaction_type === 'EXPENSE' && dateStr > todayStr) {
      futureTxExpenses.push({
        id: t.id,
        description: t.description,
        amount: amt,
        due_date: dateStr
      });
      continue;
    }

    distinctDates.add(dateStr);

    if (t.transaction_type === 'CASH_SALE') {
      totalCashSales += amt;
      cashSalesByDate[dateStr] = (cashSalesByDate[dateStr] || 0) + amt;
    } else if (t.transaction_type === 'KHATA_REPAYMENT') {
      totalRepayments += amt;
      repaymentsByDate[dateStr] = (repaymentsByDate[dateStr] || 0) + amt;
    } else if (t.transaction_type === 'CREDIT_SALE') {
      totalCreditGiven += amt;
    } else if (t.transaction_type === 'EXPENSE') {
      totalHistoricalExpenses += amt;
      expensesByDate[dateStr] = (expensesByDate[dateStr] || 0) + amt;
    }
  }

  const outstandingKhata = Math.max(0, totalCreditGiven - totalRepayments);
  const distinctDaysCount = distinctDates.size;

  // 5. Determine baseline daily metrics based on real historical patterns
  let avgDailyCashSales = 0;
  let avgDailyRepayments = 0;
  let avgDailyExpense = 0;

  if (distinctDaysCount > 0) {
    const activeDays = Math.max(1, distinctDaysCount);
    avgDailyCashSales = Math.round(totalCashSales / activeDays);
    avgDailyRepayments = Math.round(totalRepayments / activeDays);
    avgDailyExpense = Math.round(totalHistoricalExpenses / activeDays);
  }

  // Conservative daily repayment velocity: cannot exceed total outstanding khata
  let remainingOutstanding = outstandingKhata;

  // 6. Assess Confidence Level (Factual basis)
  let confidence = 'LOW';
  let confidenceReason = 'Limited historical data available. Projections will become more accurate as daily counter and ledger transactions accumulate.';

  if (distinctDaysCount >= 14) {
    confidence = 'HIGH';
    confidenceReason = `Based on ${distinctDaysCount} days of recorded store history and observed customer payment cycles.`;
  } else if (distinctDaysCount >= 4 || transactions.length >= 10) {
    confidence = 'MEDIUM';
    confidenceReason = `Based on ${distinctDaysCount} days of transaction history. Pattern stability is moderate.`;
  }

  // 7. Group pending scheduled expenses by due_date
  //    Merge: expenses table (bills) + future-dated EXPENSE transactions
  const scheduledExpensesByDate = {};

  // From expenses table
  for (const exp of pendingExpenses) {
    if (exp.due_date) {
      const expDate = toDateStr(exp.due_date);
      if (!scheduledExpensesByDate[expDate]) {
        scheduledExpensesByDate[expDate] = [];
      }
      scheduledExpensesByDate[expDate].push({
        id: exp.id,
        description: exp.description,
        amount: parseFloat(exp.amount)
      });
    }
  }

  // From future-dated EXPENSE transactions (voice/OCR recorded)
  for (const ftx of futureTxExpenses) {
    if (!scheduledExpensesByDate[ftx.due_date]) {
      scheduledExpensesByDate[ftx.due_date] = [];
    }
    scheduledExpensesByDate[ftx.due_date].push({
      id: ftx.id,
      description: ftx.description,
      amount: ftx.amount
    });
  }

  // 8. Generate 7-Day Daily Forecast (Tomorrow D+1 to D+7)
  const forecast = [];
  const warnings = [];
  let runningCash = currentCash;
  let lowestCash = currentCash;
  let lowestDate = toDateStr(new Date());

  const today = new Date();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 1; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);

    const dateStr = toDateStr(targetDate);
    const dayName = DAY_NAMES[targetDate.getDay()];
    const formattedDate = `${targetDate.getDate()} ${MONTH_NAMES[targetDate.getMonth()]}`;

    const openingCash = runningCash;

    // Expected Inflows
    const expectedSales = avgDailyCashSales;
    // Expected Khata collection (conservative)
    let expectedCollection = 0;
    if (remainingOutstanding > 0) {
      expectedCollection = Math.min(avgDailyRepayments, remainingOutstanding);
      remainingOutstanding = Math.max(0, remainingOutstanding - expectedCollection);
    }
    const expectedInflow = expectedSales + expectedCollection;

    // Expected Outflows
    const scheduledList = scheduledExpensesByDate[dateStr] || [];
    const scheduledSum = scheduledList.reduce((sum, item) => sum + item.amount, 0);
    // Baseline recurring operational costs (if no specific scheduled expense)
    const baselineOutflow = scheduledList.length === 0 ? Math.min(avgDailyExpense, 500) : 0;
    const expectedOutflow = scheduledSum + baselineOutflow;

    const closingCash = openingCash + expectedInflow - expectedOutflow;
    runningCash = closingCash;

    // Determine status
    let status = 'HEALTHY';
    if (closingCash < 0) {
      status = 'DEFICIT';
    } else if (closingCash < minThreshold) {
      status = 'SHORTAGE';
    }

    if (closingCash < lowestCash) {
      lowestCash = closingCash;
      lowestDate = dateStr;
    }

    // Generate factual explanation for shortage/deficit
    if (status === 'DEFICIT') {
      const scheduledDetail = scheduledList.length > 0
        ? ` Scheduled bill(s): ${scheduledList.map(s => `${s.description} (₹${s.amount.toLocaleString('en-IN')})`).join(', ')}.`
        : '';
      warnings.push({
        date: dateStr,
        day_name: dayName,
        type: 'DEFICIT',
        projected_cash: closingCash,
        message: `Potential Cash Deficit on ${formattedDate} (${dayName}): Projected closing cash reaches -₹${Math.abs(closingCash).toLocaleString('en-IN')}.${scheduledDetail}`
      });
    } else if (status === 'SHORTAGE') {
      const scheduledDetail = scheduledList.length > 0
        ? ` Scheduled bill(s): ${scheduledList.map(s => `${s.description} (₹${s.amount.toLocaleString('en-IN')})`).join(', ')}.`
        : '';
      warnings.push({
        date: dateStr,
        day_name: dayName,
        type: 'SHORTAGE',
        projected_cash: closingCash,
        message: `Potential Cash Shortage on ${formattedDate} (${dayName}): Projected closing cash of ₹${closingCash.toLocaleString('en-IN')} falls below safety threshold of ₹${minThreshold.toLocaleString('en-IN')}.${scheduledDetail}`
      });
    }

    forecast.push({
      date: dateStr,
      day_name: dayName,
      formatted_date: formattedDate,
      opening_cash: openingCash,
      expected_inflow: expectedInflow,
      expected_outflow: expectedOutflow,
      closing_cash: closingCash,
      status,
      breakdown: {
        estimated_sales: expectedSales,
        estimated_khata_repayments: expectedCollection,
        scheduled_expenses: scheduledList,
        baseline_expenses: baselineOutflow
      }
    });
  }

  // Summary status for entire 7-day period
  let overallStatus = 'HEALTHY';
  if (forecast.some(d => d.status === 'DEFICIT')) {
    overallStatus = 'DEFICIT';
  } else if (forecast.some(d => d.status === 'SHORTAGE')) {
    overallStatus = 'SHORTAGE';
  }

  return {
    success: true,
    merchant_id: merchantId,
    current_cash: currentCash,
    minimum_cash_threshold: minThreshold,
    overall_status: overallStatus,
    forecast,
    lowest_projected_cash: lowestCash,
    lowest_cash_date: lowestDate,
    confidence,
    confidence_reason: confidenceReason,
    metrics: {
      total_transactions: transactions.length,
      historical_days: distinctDaysCount,
      avg_daily_cash_sales: avgDailyCashSales,
      avg_daily_repayments: avgDailyRepayments,
      total_outstanding_khata: outstandingKhata,
      pending_expenses_count: pendingExpenses.length
    },
    warnings
  };
}
