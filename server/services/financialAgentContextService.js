import pool from '../config/db.js';
import { generateCashFlowForecast } from './cashFlowForecastService.js';
import { getCustomerRepaymentIntelligence } from './customerRepaymentIntelligenceService.js';
import { getFinancialAlerts } from './alertService.js';
import { resolveCustomerEntity } from './customerEntityResolutionService.js';
import { standardizeCustomerName, hasDevanagari, hasTamil } from '../utils/indicTransliterator.js';

/**
 * Extracts potential financial amounts from a natural language query.
 * e.g. "50000", "50k", "50,000", "50 hazar", "50 thousand"
 * @param {string} text
 * @returns {number|null}
 */
export function extractAmount(text) {
  if (!text) return null;
  const str = text.toLowerCase();

  // Match ₹50,000 or 50,000 or 50000
  const commaMatch = str.match(/₹?\s*(\d{1,3}(?:,\d{2,3})+)/);
  if (commaMatch) {
    const clean = commaMatch[1].replace(/,/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) return num;
  }

  // Match 50k / 50 k
  const kMatch = str.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000;
  }

  // Match 50 hazar / hazaar / thousand / lakh
  const hazarMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|thousand)\b/i);
  if (hazarMatch) {
    return parseFloat(hazarMatch[1]) * 1000;
  }
  const lakhMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)\b/i);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * 100000;
  }

  // Match plain digits e.g. 50000
  const digitMatch = str.match(/(?:₹\s*|\b)(\d{2,9})\b/);
  if (digitMatch) {
    const num = parseFloat(digitMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
}

/**
 * Extracts target date or relative day from query.
 * @param {string} text
 * @returns {{ dateStr: string|null, relativeLabel: string|null, dayOffset: number }}
 */
export function extractTargetDate(text) {
  if (!text) return { dateStr: null, relativeLabel: null, dayOffset: 0 };
  const str = text.toLowerCase();
  const now = new Date();

  // Tomorrow / Kal
  if (/\b(tomorrow|kal|aane wala kal)\b/.test(str)) {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return {
      dateStr: tom.toISOString().slice(0, 10),
      relativeLabel: 'tomorrow',
      dayOffset: 1
    };
  }

  // Day after tomorrow / Parson
  if (/\b(day after tomorrow|parson|tarson)\b/.test(str)) {
    const dat = new Date(now);
    dat.setDate(dat.getDate() + 2);
    return {
      dateStr: dat.toISOString().slice(0, 10),
      relativeLabel: 'day after tomorrow',
      dayOffset: 2
    };
  }

  // Today / Aaj
  if (/\b(today|aaj|current)\b/.test(str)) {
    return {
      dateStr: now.toISOString().slice(0, 10),
      relativeLabel: 'today',
      dayOffset: 0
    };
  }

  // Days of week (e.g. "on Friday", "shukrawar ko")
  const daysOfWeek = [
    { names: ['sunday', 'ravivar', 'itwar'], index: 0 },
    { names: ['monday', 'somvar'], index: 1 },
    { names: ['tuesday', 'mangalvar'], index: 2 },
    { names: ['wednesday', 'budhvar'], index: 3 },
    { names: ['thursday', 'guruvar', 'veervar'], index: 4 },
    { names: ['friday', 'shukravar', 'jumma'], index: 5 },
    { names: ['saturday', 'shanivar', 'hafta'], index: 6 }
  ];

  const currentDayIndex = now.getDay();
  for (const day of daysOfWeek) {
    for (const name of day.names) {
      if (new RegExp(`\\b${name}\\b`).test(str)) {
        let offset = day.index - currentDayIndex;
        if (offset <= 0) offset += 7; // next upcoming day
        const targetD = new Date(now);
        targetD.setDate(targetD.getDate() + offset);
        return {
          dateStr: targetD.toISOString().slice(0, 10),
          relativeLabel: name,
          dayOffset: offset
        };
      }
    }
  }

  // Default to tomorrow if asking about future capability without explicit date
  if (/\b(can i pay|paise honge|afford|dene hain)\b/.test(str)) {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return {
      dateStr: tom.toISOString().slice(0, 10),
      relativeLabel: 'tomorrow',
      dayOffset: 1
    };
  }

  return { dateStr: null, relativeLabel: null, dayOffset: 0 };
}

/**
 * Classifies the intent of the merchant question.
 *
 * @param {string} text
 * @returns {string} One of supported intents
 */
export function classifyIntent(text) {
  if (!text || typeof text !== 'string') return 'GENERAL_FINANCIAL_QUESTION';
  const q = text.toLowerCase().trim();

  // FINANCING_INFORMATION / FUNDING OPTIONS / CASH SHORTAGE OPTIONS
  if (
    /\b(financing|loan|loans|external fund|funding|kya options hain|options kya hain|paise kam pad rahe|paise ki kami.*options?|financing options|do i need.*funding|borrow)\b/i.test(q) ||
    /\b(how much.*short|what can i do.*shortage|shortage.*what to do|kami.*kya karein)\b/i.test(q)
  ) {
    return 'FINANCING_INFORMATION';
  }

  // FINANCIAL_ALERTS / ATTENTION / WARNINGS
  if (
    /\b(attention|alert|alerts|warning|warnings|action|actions|what needs|deserves attention|kya dhyan|dhyan dena|kya samasya|trouble|risk|urgent|pending bills|what to do)\b/i.test(q) ||
    /\b(what.*need.*attention|what.*should i do|kya karna chahiye|koi dikkat|koi samasya)\b/i.test(q)
  ) {
    return 'FINANCIAL_ALERTS';
  }

  // URGENT_PAYMENT / LARGE PAYMENT SCENARIO
  // e.g. "Can I pay 50000 tomorrow?", "I need to pay 50000", "50000 dene hain"
  if (
    (extractAmount(q) !== null && /\b(pay|give|afford|de sakta|dene hain|de paunga|kharcha|bhejna|transfer)\b/.test(q)) ||
    /\b(can i pay|afford|urgent payment|large payment|bada payment)\b/.test(q)
  ) {
    return 'URGENT_PAYMENT';
  }

  // CASH_SHORTAGE
  if (/\b(shortage|deficit|kam padenge|kami|paise kam|short on cash|why.*shortage|ghata|tangi)\b/.test(q)) {
    return 'CASH_SHORTAGE';
  }

  // CASH_FORECAST / FUTURE CASH
  if (
    /\b(tomorrow|forecast|kal|parson|friday|monday|tuesday|wednesday|thursday|saturday|sunday|next week|agle hafte|future cash|paise honge|kitne honge|will i have enough)\b/.test(q) &&
    /\b(money|cash|paise|balance|rokad|bachega|hoga)\b/.test(q)
  ) {
    return 'CASH_FORECAST';
  }

  // TODAY_SALES
  if (/\b(today('?s)?|aaj|daily)\b/i.test(q) && /\b(sale|sales|sell|sold|bikri|kamai|dhandha|collection)\b/i.test(q)) {
    return 'TODAY_SALES';
  }

  // CASH_BALANCE
  if (/\b(cash|balance|rokad|galla|drawer|how much money|kitne paise|mere paas|cash balance)\b/.test(q) &&
      !/\b(owe|udhar|khata|forecast|tomorrow|kal)\b/.test(q)) {
    return 'CASH_BALANCE';
  }

  // CUSTOMER_REPAYMENT / UNSETTLED INTELLIGENCE
  if (
    /\b(repay|repaying|repaid|wapas|nahi diya|not repaid|late|attention|default|settled|unsettled|unrepaid)\b/.test(q) ||
    /\b(who.*not.*repaid|kaun paise nahi de raha|kinse paise lene)\b/.test(q)
  ) {
    return 'CUSTOMER_REPAYMENT';
  }

  // CUSTOMER_DETAILS / TOP DEBTORS
  if (
    /\b(who owes|most|sabse zyada|highest|kispe|top customer|udhaar kiska|kitna baki|kis customer|debtors)\b/i.test(q) &&
    /\b(owe|owes|owing|udhar|udhaar|khata|baki|due|dues|debt)\b/i.test(q)
  ) {
    return 'CUSTOMER_DETAILS';
  }

  // KHATA_OUTSTANDING / TOTAL CREDIT
  if (/\b(owe|owes|owing|khata|udhar|udhaar|receivable|market|market balance|baki|customers owe|total credit)\b/i.test(q)) {
    return 'KHATA_OUTSTANDING';
  }

  // UPCOMING_PAYMENTS / BILLS / EXPENSES
  if (/\b(upcoming|bills|supplier|distributor|bill|bijli|rent|kiraya|pending payment|outflow|expenses|payment coming)\b/.test(q)) {
    return 'UPCOMING_PAYMENTS';
  }

  // SALES_SUMMARY
  if (/\b(sales|bikri|revenue|turnover|history|sales summary)\b/.test(q)) {
    return 'SALES_SUMMARY';
  }

  // EXPENSE_SUMMARY
  if (/\b(expense|expenses|kharcha|kharch)\b/.test(q)) {
    return 'EXPENSE_SUMMARY';
  }

  return 'GENERAL_FINANCIAL_QUESTION';
}

/**
 * Builds factual financial context from MySQL and financial services.
 *
 * @param {number} merchantId
 * @param {string} message User query
 * @returns {Promise<{
 *   merchant: { id: number, name: string, cash_balance: number },
 *   today: { date: string, total_sales: number, cash_sales: number, credit_sales: number, total_inflows: number, total_repayments: number, total_expenses: number, tx_count: number },
 *   khata: { total_outstanding: number, total_credit: number, total_repaid: number, customer_count: number, customers_with_due: number, top_debtors: Array<any>, attention_count: number, attention_customers: Array<any> },
 *   forecast: { confidence: string, min_threshold: number, lowest_projected_cash: number, has_shortage: boolean, daily: Array<any>, shortage_days: Array<any> },
 *   upcoming_expenses: Array<any>,
 *   scenario: { amount: number|null, target_date: string|null, relative_label: string|null, projected_remaining: number|null, cash_gap: number|null, is_affordable: boolean|null, day_opening?: number, day_inflows?: number, day_outflows?: number, projected_closing_before?: number },
 *   intent: string
 * }>}
 */
export async function buildFinancialAgentContext(merchantId = 1, message = '') {
  const intent = classifyIntent(message);
  const targetAmount = extractAmount(message);
  const targetDateInfo = extractTargetDate(message);

  // 1. Merchant live record
  const [merchants] = await pool.query(
    'SELECT id, name, current_cash_balance FROM merchants WHERE id = ? LIMIT 1',
    [merchantId]
  );
  const merchantRecord = merchants[0] || { id: merchantId, name: 'Merchant', current_cash_balance: 0 };
  const currentCash = parseFloat(merchantRecord.current_cash_balance || 0);

  // 2. Today's live sales & transactions
  const todayStr = new Date().toISOString().slice(0, 10);
  const [todayTxs] = await pool.query(
    `SELECT transaction_type, amount
     FROM transactions
     WHERE merchant_id = ? AND DATE(transaction_date) = ?`,
    [merchantId, todayStr]
  );

  let todayCashSales = 0;
  let todayCreditSales = 0;
  let todayRepayments = 0;
  let todayExpenses = 0;

  for (const t of todayTxs) {
    const amt = parseFloat(t.amount || 0);
    if (t.transaction_type === 'CASH_SALE') todayCashSales += amt;
    else if (t.transaction_type === 'CREDIT_SALE') todayCreditSales += amt;
    else if (t.transaction_type === 'KHATA_REPAYMENT') todayRepayments += amt;
    else if (t.transaction_type === 'EXPENSE') todayExpenses += amt;
  }
  const todayTotalSales = todayCashSales + todayCreditSales;
  const todayTotalInflows = todayCashSales + todayRepayments;

  // 3. Khata & Repayment Intelligence from MySQL
  const intelData = await getCustomerRepaymentIntelligence(merchantId);
  const allKhataCustomers = (intelData.customers || [])
    .filter(c => c.outstanding > 0 || c.total_credit > 0 || c.total_repaid > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .map(c => ({
      name: c.name,
      outstanding: c.outstanding,
      total_credit: c.total_credit,
      repayment_rate: c.repayment_rate,
      unsettled_count: c.unsettled_credit_count,
      last_repayment: c.last_repayment_date,
      recent_transactions: c.recent_transactions
    }));

  const attentionCustomers = (intelData.customers || [])
    .filter(c => c.attention_flag)
    .map(c => ({
      name: c.name,
      outstanding: c.outstanding,
      repayment_rate: c.repayment_rate,
      unsettled_count: c.unsettled_credit_count,
      reason: c.attention_reason,
      recent_transactions: c.recent_transactions
    }));

  // 4. 7-Day Forecast & Shortage Assessment
  const forecastRes = await generateCashFlowForecast(merchantId);
  const forecastDaily = forecastRes.forecast || [];
  const shortageDays = forecastDaily.filter(d => d.status === 'SHORTAGE' || d.status === 'DEFICIT');

  // 5. Upcoming Expenses / Invoices — combine BOTH sources:
  //    a) Dedicated expenses table (bills with due_date)
  //    b) Future-dated EXPENSE transactions from transactions table (voice/OCR recorded)
  const [upcomingExpenseRows] = await pool.query(
    `SELECT id, description, amount, due_date, status
     FROM expenses
     WHERE merchant_id = ? AND status = 'PENDING' AND due_date >= ?
     ORDER BY due_date ASC
     LIMIT 5`,
    [merchantId, todayStr]
  );

  // Also fetch future-dated EXPENSE transactions (recorded via voice/OCR for a future date)
  const [futureTxExpenses] = await pool.query(
    `SELECT t.id, t.description, t.amount, t.transaction_date as due_date,
            c.name as customer_name
     FROM transactions t
     LEFT JOIN customers c ON t.customer_id = c.id
     WHERE t.merchant_id = ? AND t.transaction_type = 'EXPENSE'
       AND DATE(t.transaction_date) > ?
     ORDER BY t.transaction_date ASC
     LIMIT 10`,
    [merchantId, todayStr]
  );

  // 3.5 Customer Entity Resolution & Ambiguity Detection
  let resolvedCustomerEntity = null;
  let targetCustomer = null;
  let finalIntent = intent;

  const cleanMsg = (message || '').trim();
  if (cleanMsg) {
    const words = cleanMsg.split(/\s+/);
    for (let len = Math.min(3, words.length); len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const slice = words.slice(i, i + len).join(' ');
        const candidate = slice.replace(/[?,.!"']/g, '').trim();
        if (
          candidate.length >= 2 &&
          !/^(how|much|does|owe|me|what|is|my|cash|sales|today|tomorrow|kal|aaj|parson|give|gave|pay|paid|rupaye|hazar|lakh|khata|balance|status|all|show|tell|the|and|for|hai|ko|ne|se|ka|ki|ke|baki|kitna|paisa|paise)$/i.test(candidate)
        ) {
          const res = await resolveCustomerEntity(merchantId, candidate);
          if (res.status === 'AMBIGUOUS_MATCH') {
            resolvedCustomerEntity = res;
            finalIntent = 'AMBIGUOUS_CUSTOMER';
            break;
          } else if (res.status === 'EXACT_MATCH') {
            resolvedCustomerEntity = res;
            targetCustomer = res.customer;
            if (['CUSTOMER_DETAILS', 'CUSTOMER_REPAYMENT', 'KHATA_OUTSTANDING', 'GENERAL_FINANCIAL_QUESTION'].includes(intent)) {
              finalIntent = 'CUSTOMER_DETAILS';
            }
            break;
          }
        }
      }
      if (resolvedCustomerEntity) break;
    }
  }

  // 6. Large Payment / Simulation Scenario Calculation
  let scenario = {
    amount: targetAmount,
    target_date: targetDateInfo.dateStr || (forecastDaily[0]?.date || todayStr),
    relative_label: targetDateInfo.relativeLabel || 'tomorrow',
    projected_remaining: null,
    cash_gap: null,
    is_affordable: null,
    explanation: null
  };

  if (targetAmount && targetAmount > 0) {
    const dailyWindow = forecastDaily.slice(0, Math.max(1, (targetDateInfo.dayOffset || 1)));
    const targetDayData = dailyWindow[dailyWindow.length - 1] || forecastDaily[0];

    if (targetDayData) {
      const projectedClosingBefore = targetDayData.closing_cash;
      const projectedRemaining = projectedClosingBefore - targetAmount;
      scenario.projected_closing_before = Math.round(projectedClosingBefore);
      scenario.projected_remaining = Math.round(projectedRemaining);
      scenario.cash_gap = Math.max(0, -Math.round(projectedRemaining));
      scenario.is_affordable = projectedRemaining >= 0;
    } else {
      const projectedRemaining = currentCash - targetAmount;
      scenario.projected_remaining = Math.round(projectedRemaining);
      scenario.cash_gap = Math.max(0, -Math.round(projectedRemaining));
      scenario.is_affordable = projectedRemaining >= 0;
    }
  }

  return {
    merchant: {
      id: merchantRecord.id,
      name: merchantRecord.name,
      cash_balance: currentCash
    },
    today: {
      date: todayStr,
      total_sales: todayTotalSales,
      cash_sales: todayCashSales,
      credit_sales: todayCreditSales,
      total_inflows: todayTotalInflows,
      total_repayments: todayRepayments,
      total_expenses: todayExpenses,
      tx_count: todayTxs.length
    },
    khata: {
      total_outstanding: intelData.summary?.total_outstanding || 0,
      total_credit: (intelData.customers || []).reduce((s, c) => s + c.total_credit, 0),
      total_repaid: (intelData.customers || []).reduce((s, c) => s + c.total_repaid, 0),
      customer_count: intelData.summary?.total_customers || 0,
      customers_with_due: intelData.summary?.customers_with_outstanding || 0,
      top_debtors: allKhataCustomers.slice(0, 5),
      all_khata_customers: allKhataCustomers,
      attention_count: intelData.summary?.attention_count || 0,
      attention_customers: attentionCustomers
    },
    forecast: {
      confidence: forecastRes.summary?.confidence || 'MEDIUM',
      min_threshold: forecastRes.summary?.min_cash_threshold || 5000,
      lowest_projected_cash: forecastRes.summary?.lowest_projected_cash ?? currentCash,
      has_shortage: forecastRes.summary?.has_shortage || false,
      daily: forecastDaily,
      shortage_days: shortageDays
    },
    upcoming_expenses: [
      ...upcomingExpenseRows.map(e => ({
        description: e.description,
        amount: parseFloat(e.amount),
        due_date: String(e.due_date).slice(0, 10),
        status: e.status,
        source: 'bill'
      })),
      ...futureTxExpenses.map(e => ({
        description: e.customer_name
          ? `${e.description} (${e.customer_name})`
          : e.description,
        amount: parseFloat(e.amount),
        due_date: String(e.due_date).slice(0, 10),
        status: 'SCHEDULED',
        source: 'voice_transaction'
      }))
    ].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    alerts: await getFinancialAlerts(merchantId),
    scenario,
    customer_entity: resolvedCustomerEntity,
    target_customer: targetCustomer,
    intent: finalIntent
  };
}
