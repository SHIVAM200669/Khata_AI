import pool from '../config/db.js';
import { generateCashFlowForecast } from './cashFlowForecastService.js';
import { getCustomerRepaymentIntelligence } from './customerRepaymentIntelligenceService.js';

const DEFAULT_MIN_CASH_THRESHOLD = 5000;

/**
 * Formats a Date object or string to YYYY-MM-DD string
 */
function toDateStr(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats date to display format e.g. "23 Sept"
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Calculates days between two date strings (target - today)
 */
function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generates all dynamic, prioritized financial alerts and recommended actions
 * for a merchant using live MySQL data and existing financial engines.
 *
 * @param {number} merchantId Merchant ID (defaults to 1)
 * @param {object} options Optional config overrides (e.g. min_threshold)
 * @returns {Promise<{
 *   success: boolean,
 *   merchant_id: number,
 *   generated_at: string,
 *   summary: {
 *     critical: number,
 *     warning: number,
 *     info: number,
 *     total: number
 *   },
 *   alerts: Array<{
 *     id: string,
 *     type: 'CASH_DEFICIT' | 'CASH_SHORTAGE' | 'UPCOMING_PAYMENT' | 'REPAYMENT_ATTENTION' | 'SIGNIFICANT_KHATA' | 'LIQUIDITY_HEALTH',
 *     priority: 'CRITICAL' | 'WARNING' | 'INFO',
 *     title: string,
 *     message: string,
 *     reason: string,
 *     data: object,
 *     actions: Array<{
 *       label: string,
 *       description: string,
 *       action_type: string,
 *       link?: string
 *     }>
 *   }>
 * }>}
 */
export async function getFinancialAlerts(merchantId = 1, options = {}) {
  const minThreshold = parseFloat(options.min_threshold || DEFAULT_MIN_CASH_THRESHOLD);

  // 1. Fetch current cash balance
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
  const todayStr = toDateStr(new Date());

  // 2. Fetch 7-day cash flow forecast (Module 8 single source of truth)
  const forecastData = await generateCashFlowForecast(merchantId, { min_threshold: minThreshold });

  // 3. Fetch Customer Repayment Intelligence (Module 8.2 single source of truth)
  const repaymentData = await getCustomerRepaymentIntelligence(merchantId);

  // 4. Fetch pending/unpaid scheduled expenses from expenses table
  const [pendingExpenses] = await pool.query(
    `SELECT id, description, amount, due_date, status
     FROM expenses
     WHERE merchant_id = ? AND status = 'PENDING'
     ORDER BY due_date ASC`,
    [merchantId]
  );

  // 5. Fetch future-dated EXPENSE transactions from transactions table
  const [futureExpenses] = await pool.query(
    `SELECT id, description, amount, transaction_date, source
     FROM transactions
     WHERE merchant_id = ? AND transaction_type = 'EXPENSE' AND transaction_date > ?
     ORDER BY transaction_date ASC`,
    [merchantId, todayStr]
  );

  const alerts = [];
  const processedKeys = new Set(); // Prevent duplicate alerts

  // =========================================================================
  // ALERT TYPE 1 & 2: CASH DEFICIT (CRITICAL) & CASH SHORTAGE (WARNING)
  // =========================================================================
  // Analyze forecast daily trajectory
  for (const day of forecastData.forecast) {
    const displayDate = formatDisplayDate(day.date);
    const dayName = day.day_name;

    if (day.status === 'DEFICIT') {
      const alertKey = `DEFICIT_${day.date}`;
      if (!processedKeys.has(alertKey)) {
        processedKeys.add(alertKey);
        const deficitAmount = Math.abs(day.closing_cash);

        const scheduledDescriptions = (day.breakdown.scheduled_expenses || [])
          .map(s => `${s.description} (₹${Number(s.amount).toLocaleString('en-IN')})`)
          .join(', ');

        alerts.push({
          id: `alert-deficit-${day.date}`,
          type: 'CASH_DEFICIT',
          priority: 'CRITICAL',
          title: 'Projected Cash Deficit',
          message: `Projected cash may become negative by approximately ₹${Number(deficitAmount).toLocaleString('en-IN')} on ${displayDate} (${dayName}).`,
          reason: `Projected closing cash reaches -₹${Number(deficitAmount).toLocaleString('en-IN')} due to scheduled outflows of ₹${Number(day.expected_outflow).toLocaleString('en-IN')} exceeding expected inflows of ₹${Number(day.expected_inflow).toLocaleString('en-IN')}.${scheduledDescriptions ? ` Scheduled items: ${scheduledDescriptions}.` : ''}`,
          data: {
            date: day.date,
            day_name: dayName,
            display_date: displayDate,
            projected_cash: day.closing_cash,
            deficit_amount: deficitAmount,
            current_cash: currentCash,
            expected_inflow: day.expected_inflow,
            expected_outflow: day.expected_outflow,
            scheduled_items: day.breakdown.scheduled_expenses || [],
            confidence: forecastData.confidence
          },
          actions: [
            {
              label: 'Review Outstanding Khata Collections',
              description: 'Focus collection follow-ups on customers with overdue unsettled balances to accelerate cash inflows.',
              action_type: 'VIEW_KHATA',
              link: '/customers'
            },
            {
              label: 'Review Upcoming Expenses',
              description: 'Check if non-urgent supplier payments or scheduled bills on this date can be split or adjusted.',
              action_type: 'VIEW_FORECAST',
              link: '/forecast'
            },
            {
              label: 'Alternative Liquidity Planning',
              description: 'A projected cash gap remains. Plan vendor payment timelines and trade credit carefully.',
              action_type: 'VIEW_FORECAST',
              link: '/forecast'
            }
          ]
        });
      }
    } else if (day.status === 'SHORTAGE') {
      const alertKey = `SHORTAGE_${day.date}`;
      if (!processedKeys.has(alertKey)) {
        processedKeys.add(alertKey);
        const shortfall = Math.max(0, minThreshold - day.closing_cash);

        const scheduledDescriptions = (day.breakdown.scheduled_expenses || [])
          .map(s => `${s.description} (₹${Number(s.amount).toLocaleString('en-IN')})`)
          .join(', ');

        alerts.push({
          id: `alert-shortage-${day.date}`,
          type: 'CASH_SHORTAGE',
          priority: 'WARNING',
          title: 'Projected Cash Shortage',
          message: `Projected cash may fall below your ₹${Number(minThreshold).toLocaleString('en-IN')} safety buffer on ${displayDate} (${dayName}).`,
          reason: `Projected closing cash of ₹${Number(day.closing_cash).toLocaleString('en-IN')} is ₹${Number(shortfall).toLocaleString('en-IN')} below your safety threshold of ₹${Number(minThreshold).toLocaleString('en-IN')}.${scheduledDescriptions ? ` Scheduled items: ${scheduledDescriptions}.` : ''}`,
          data: {
            date: day.date,
            day_name: dayName,
            display_date: displayDate,
            projected_cash: day.closing_cash,
            safety_threshold: minThreshold,
            shortfall_amount: shortfall,
            current_cash: currentCash,
            expected_inflow: day.expected_inflow,
            expected_outflow: day.expected_outflow,
            confidence: forecastData.confidence
          },
          actions: [
            {
              label: 'Review Pending Khata Collections',
              description: 'Follow up with active credit customers to maintain comfortable register liquidity.',
              action_type: 'VIEW_KHATA',
              link: '/customers'
            },
            {
              label: 'Check Payment Timing',
              description: 'Check whether scheduled supplier payments can be aligned with incoming customer repayments.',
              action_type: 'VIEW_FORECAST',
              link: '/forecast'
            }
          ]
        });
      }
    }
  }

  // =========================================================================
  // ALERT TYPE 3: UPCOMING PAYMENTS (WARNING / INFO)
  // =========================================================================
  // Merge upcoming expenses from both tables, excluding already paid items
  const combinedUpcoming = [];

  for (const exp of pendingExpenses) {
    if (exp.due_date) {
      const dStr = toDateStr(exp.due_date);
      combinedUpcoming.push({
        id: `exp-${exp.id}`,
        description: exp.description,
        amount: parseFloat(exp.amount),
        due_date: dStr,
        source: 'EXPENSES_TABLE'
      });
    }
  }

  for (const ftx of futureExpenses) {
    const dStr = toDateStr(ftx.transaction_date);
    combinedUpcoming.push({
      id: `tx-${ftx.id}`,
      description: ftx.description || 'Scheduled Expense',
      amount: parseFloat(ftx.amount),
      due_date: dStr,
      source: 'TRANSACTIONS_TABLE'
    });
  }

  // Sort upcoming payments chronologically
  combinedUpcoming.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  for (const item of combinedUpcoming) {
    const daysUntil = getDaysUntil(item.due_date);
    const displayDate = formatDisplayDate(item.due_date);
    const alertKey = `UPCOMING_${item.id}_${item.due_date}`;

    if (processedKeys.has(alertKey)) continue;
    processedKeys.add(alertKey);

    let timingText = '';
    let priority = 'WARNING';

    if (daysUntil < 0) {
      timingText = `was due ${Math.abs(daysUntil)} day(s) ago (${displayDate})`;
      priority = 'CRITICAL';
    } else if (daysUntil === 0) {
      timingText = `is due today (${displayDate})`;
      priority = 'WARNING';
    } else if (daysUntil === 1) {
      timingText = `is due tomorrow (${displayDate})`;
      priority = 'WARNING';
    } else if (daysUntil <= 3) {
      timingText = `is due in ${daysUntil} days (${displayDate})`;
      priority = 'WARNING';
    } else {
      timingText = `is scheduled on ${displayDate}`;
      priority = 'INFO';
    }

    alerts.push({
      id: `alert-upcoming-${item.id}`,
      type: 'UPCOMING_PAYMENT',
      priority,
      title: 'Upcoming Scheduled Payment',
      message: `₹${Number(item.amount).toLocaleString('en-IN')} ${item.description} ${timingText}.`,
      reason: `Unpaid scheduled payable of ₹${Number(item.amount).toLocaleString('en-IN')} due on ${displayDate}.`,
      data: {
        payment_id: item.id,
        description: item.description,
        amount: item.amount,
        due_date: item.due_date,
        display_date: displayDate,
        days_until: daysUntil,
        current_cash: currentCash
      },
      actions: [
        {
          label: 'Check Current Cash & Inflows',
          description: `Verify register balance (₹${Number(currentCash).toLocaleString('en-IN')}) against this ₹${Number(item.amount).toLocaleString('en-IN')} payment.`,
          action_type: 'VIEW_DASHBOARD',
          link: '/dashboard'
        },
        {
          label: 'Open Cash Forecast',
          description: 'Check projected daily cash flow before and after this bill.',
          action_type: 'VIEW_FORECAST',
          link: '/forecast'
        }
      ]
    });
  }

  // =========================================================================
  // ALERT TYPE 4: REPAYMENT ATTENTION (WARNING)
  // =========================================================================
  // Inspect customers requiring attention from Module 8.2
  const attentionCustomers = (repaymentData.customers || []).filter(c => c.attention_flag && c.outstanding > 0);

  for (const cust of attentionCustomers) {
    const alertKey = `ATTENTION_CUST_${cust.customer_id}`;
    if (processedKeys.has(alertKey)) continue;
    processedKeys.add(alertKey);

    alerts.push({
      id: `alert-repayment-${cust.customer_id}`,
      type: 'REPAYMENT_ATTENTION',
      priority: 'WARNING',
      title: `Repayment Attention: ${cust.name}`,
      message: `${cust.name}: ${cust.attention_reason || `₹${Number(cust.outstanding).toLocaleString('en-IN')} outstanding`}`,
      reason: cust.attention_reason || `₹${Number(cust.outstanding).toLocaleString('en-IN')} outstanding across ${cust.credit_transactions} credit transaction(s).`,
      data: {
        customer_id: cust.customer_id,
        customer_name: cust.name,
        phone: cust.phone,
        outstanding: cust.outstanding,
        repayment_rate: cust.repayment_rate,
        recent_unrepaid_count: cust.recent_unrepaid_count,
        recent_credit_count: cust.recent_credit_count,
        unsettled_credit_count: cust.unsettled_credit_count,
        last_repayment_date: cust.last_repayment_date,
        days_since_last_repayment: cust.days_since_last_repayment
      },
      actions: [
        {
          label: 'Review Customer Ledger',
          description: `Examine chronological FIFO credit and repayment history for ${cust.name}.`,
          action_type: 'VIEW_CUSTOMER',
          link: '/customers'
        },
        {
          label: 'Check Pre-Credit Advisory',
          description: 'Review repayment pattern before granting additional credit on future purchases.',
          action_type: 'PRE_CREDIT_CHECK',
          link: '/customers'
        }
      ]
    });
  }

  // =========================================================================
  // ALERT TYPE 5: SIGNIFICANT OUTSTANDING KHATA (INFO / WARNING)
  // =========================================================================
  const totalKhataOutstanding = repaymentData.summary?.total_outstanding || 0;
  const customersWithDue = repaymentData.summary?.customers_with_outstanding || 0;
  const attentionCount = repaymentData.summary?.attention_count || 0;

  if (totalKhataOutstanding > 0) {
    const khataKey = `KHATA_TOTAL_SUMMARY`;
    if (!processedKeys.has(khataKey)) {
      processedKeys.add(khataKey);
      const isLargeKhata = totalKhataOutstanding > 15000 || attentionCount > 0;

      alerts.push({
        id: 'alert-khata-summary',
        type: 'SIGNIFICANT_KHATA',
        priority: isLargeKhata ? 'WARNING' : 'INFO',
        title: 'Outstanding Khata Summary',
        message: `₹${Number(totalKhataOutstanding).toLocaleString('en-IN')} total Khata outstanding across ${customersWithDue} customer(s).${attentionCount > 0 ? ` ${attentionCount} require repayment attention.` : ''}`,
        reason: `Total store receivables currently stand at ₹${Number(totalKhataOutstanding).toLocaleString('en-IN')}.${attentionCount > 0 ? ` ${attentionCount} customer(s) have unsettled credit patterns requiring attention.` : ''}`,
        data: {
          total_outstanding: totalKhataOutstanding,
          customers_with_due: customersWithDue,
          attention_count: attentionCount
        },
        actions: [
          {
            label: 'Open Khata Directory',
            description: 'View individual customer ledger cards and record incoming repayments.',
            action_type: 'VIEW_CUSTOMERS',
            link: '/customers'
          }
        ]
      });
    }
  }

  // =========================================================================
  // ALERT TYPE 6: LIQUIDITY HEALTH OBSERVATION (INFO - if healthy and no critical alerts)
  // =========================================================================
  if (alerts.filter(a => a.priority === 'CRITICAL').length === 0 && alerts.filter(a => a.priority === 'WARNING').length === 0) {
    alerts.push({
      id: 'alert-health-positive',
      type: 'LIQUIDITY_HEALTH',
      priority: 'INFO',
      title: 'Healthy Working Capital',
      message: `Your projected cash balance remains above the ₹${Number(minThreshold).toLocaleString('en-IN')} safety buffer for all 7 projected days.`,
      reason: `Current register balance is ₹${Number(currentCash).toLocaleString('en-IN')}, and projected daily collections adequately cover anticipated expenses.`,
      data: {
        current_cash: currentCash,
        lowest_projected_cash: forecastData.lowest_projected_cash,
        safety_threshold: minThreshold
      },
      actions: [
        {
          label: 'View 7-Day Forecast',
          description: 'Explore the daily cash projection trend and breakdown.',
          action_type: 'VIEW_FORECAST',
          link: '/forecast'
        }
      ]
    });
  }

  // Sort alerts: CRITICAL first, then WARNING, then INFO
  const PRIORITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  alerts.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Compute summary count
  const summary = {
    critical: alerts.filter(a => a.priority === 'CRITICAL').length,
    warning: alerts.filter(a => a.priority === 'WARNING').length,
    info: alerts.filter(a => a.priority === 'INFO').length,
    total: alerts.length
  };

  return {
    success: true,
    merchant_id: merchantId,
    generated_at: new Date().toISOString(),
    summary,
    alerts
  };
}
