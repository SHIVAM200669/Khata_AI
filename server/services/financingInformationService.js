import pool from '../config/db.js';
import { generateCashFlowForecast } from './cashFlowForecastService.js';
import { getCustomerRepaymentIntelligence } from './customerRepaymentIntelligenceService.js';

const DEFAULT_MIN_CASH_THRESHOLD = 5000;

/**
 * Formats a Date object or string to YYYY-MM-DD
 */
function toDateStr(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates illustrative repayment estimates purely for merchant financial education.
 * Non-binding, non-guaranteed mathematical reference only.
 *
 * @param {number} principal Proposed amount
 * @param {number} annualRatePercent Annual interest rate % (e.g. 12%)
 * @param {number} months Tenure in months (e.g. 6)
 * @returns {{
 *   principal: number,
 *   annual_rate: number,
 *   tenure_months: number,
 *   estimated_monthly_installment: number,
 *   total_estimated_interest: number,
 *   total_estimated_repayment: number,
 *   disclaimer: string
 * }}
 */
export function calculateIllustrativeCost(principal = 15000, annualRatePercent = 14, months = 6) {
  const p = Math.max(0, parseFloat(principal || 0));
  const r = Math.max(0, parseFloat(annualRatePercent || 0)) / 100 / 12; // Monthly rate
  const n = Math.max(1, parseInt(months || 6, 10));

  let emi = 0;
  if (r === 0) {
    emi = Math.round(p / n);
  } else {
    emi = Math.round((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }

  const totalRepayment = emi * n;
  const totalInterest = Math.max(0, totalRepayment - p);

  return {
    principal: p,
    annual_rate: parseFloat(annualRatePercent || 0),
    tenure_months: n,
    estimated_monthly_installment: emi,
    total_estimated_interest: totalInterest,
    total_estimated_repayment: totalRepayment,
    disclaimer: 'Illustrative estimate only. Actual rates, fees, eligibility, and repayment terms are determined exclusively by external financial institutions.'
  };
}

/**
 * Analyzes whether a merchant faces a genuine projected funding gap,
 * outlines internal cash-generation options first (Khata, timing),
 * and surfaces neutral, non-predatory educational financing categories if a gap remains.
 *
 * @param {number} merchantId Merchant ID (defaults to 1)
 * @param {object} options Optional parameters: requiredAmount, paymentDate, min_threshold
 * @returns {Promise<{
 *   success: boolean,
 *   merchant_id: number,
 *   hasFundingGap: boolean,
 *   requiredAmount: number|null,
 *   projectedAvailableCash: number,
 *   projectedGap: number,
 *   paymentDate: string,
 *   gapType: 'DEFICIT' | 'SHORTAGE' | 'PAYMENT_SCENARIO' | 'NONE',
 *   currentCash: number,
 *   factors: {
 *     expectedInflows: number,
 *     scheduledOutflows: number,
 *     totalKhataReceivable: number,
 *     attentionKhataDue: number
 *   },
 *   internalOptions: Array<{
 *     type: 'KHATA_COLLECTION' | 'PAYMENT_TIMING' | 'INVENTORY_DISCOUNT',
 *     title: string,
 *     description: string,
 *     amount?: number,
 *     actionLink?: string
 *   }>,
 *   financingCategories: Array<{
 *     category: string,
 *     typicalPurpose: string,
 *     keyConsiderations: string,
 *     repaymentNature: string
 *   }>,
 *   financingReviewAvailable: boolean,
 *   disclaimer: string
 * }>}
 */
export async function getFinancingInformation(merchantId = 1, options = {}) {
  const reqAmount = options.requiredAmount ? parseFloat(options.requiredAmount) : null;
  const paymentDate = options.paymentDate ? toDateStr(options.paymentDate) : null;
  const minThreshold = parseFloat(options.min_threshold || DEFAULT_MIN_CASH_THRESHOLD);

  // 1. Fetch live merchant record
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

  // 2. Reuse Module 8 Forecast Engine (Single source of truth)
  const forecastData = await generateCashFlowForecast(merchantId, { min_threshold: minThreshold });
  const dailyForecast = forecastData.forecast || [];

  // 3. Reuse Module 8.2 Customer Repayment Intelligence (Single source of truth)
  const repaymentData = await getCustomerRepaymentIntelligence(merchantId);
  const totalKhata = repaymentData.summary?.total_outstanding || 0;
  const attentionCustomers = (repaymentData.customers || []).filter(c => c.attention_flag && c.outstanding > 0);
  const attentionDueSum = attentionCustomers.reduce((s, c) => s + c.outstanding, 0);

  // 4. Calculate Funding Gap
  let hasFundingGap = false;
  let projectedAvailableCash = currentCash;
  let projectedGap = 0;
  let targetDate = paymentDate || (dailyForecast[0]?.date || toDateStr(new Date()));
  let gapType = 'NONE';
  let expectedInflows = 0;
  let scheduledOutflows = 0;

  if (reqAmount !== null && reqAmount > 0) {
    // Specific payment scenario (e.g. ₹50,000 for tomorrow or custom date)
    const targetDay = dailyForecast.find(d => d.date === targetDate) || dailyForecast[0];
    if (targetDay) {
      targetDate = targetDay.date;
      expectedInflows = targetDay.expected_inflow;
      scheduledOutflows = targetDay.expected_outflow;
      projectedAvailableCash = Math.max(0, targetDay.opening_cash + expectedInflows - scheduledOutflows);
    } else {
      projectedAvailableCash = currentCash;
    }

    if (projectedAvailableCash < reqAmount) {
      hasFundingGap = true;
      projectedGap = reqAmount - projectedAvailableCash;
      gapType = 'PAYMENT_SCENARIO';
    }
  } else {
    // Check general 7-day forecast state
    const deficitDay = dailyForecast.find(d => d.status === 'DEFICIT');
    const shortageDay = dailyForecast.find(d => d.status === 'SHORTAGE');

    if (deficitDay) {
      hasFundingGap = true;
      targetDate = deficitDay.date;
      expectedInflows = deficitDay.expected_inflow;
      scheduledOutflows = deficitDay.expected_outflow;
      projectedAvailableCash = Math.max(0, deficitDay.opening_cash + expectedInflows - scheduledOutflows);
      projectedGap = Math.abs(deficitDay.closing_cash);
      gapType = 'DEFICIT';
    } else if (shortageDay) {
      hasFundingGap = true;
      targetDate = shortageDay.date;
      expectedInflows = shortageDay.expected_inflow;
      scheduledOutflows = shortageDay.expected_outflow;
      projectedAvailableCash = shortageDay.closing_cash;
      projectedGap = Math.max(0, minThreshold - shortageDay.closing_cash);
      gapType = 'SHORTAGE';
    }
  }

  // 5. Internal Options (Priority 1: Khata Recovery, Bill Postponement)
  const internalOptions = [];

  if (totalKhata > 0) {
    internalOptions.push({
      type: 'KHATA_COLLECTION',
      title: 'Review Pending Khata Collections',
      description: attentionCustomers.length > 0
        ? `₹${Number(attentionDueSum).toLocaleString('en-IN')} is outstanding across ${attentionCustomers.length} customer(s) with pending dues. Prioritize follow-ups with these customers before seeking external funding.`
        : `₹${Number(totalKhata).toLocaleString('en-IN')} total Khata receivable is outstanding across customers. Accelerating collections can immediately restore liquidity.`,
      amount: attentionCustomers.length > 0 ? attentionDueSum : totalKhata,
      actionLink: '/customers'
    });
  }

  internalOptions.push({
    type: 'PAYMENT_TIMING',
    title: 'Review Upcoming Payment Timing',
    description: 'Check if non-essential supplier invoices or scheduled utility bills can be split into installments or delayed by 2–3 days to align with cash inflows.',
    actionLink: '/forecast'
  });

  // 6. Educational Financing Categories (Neutral, Non-Predatory, No Fabricated Lenders)
  const financingCategories = [
    {
      category: 'Working Capital Trade Credit',
      typicalPurpose: 'Short-term inventory purchase directly from verified FMCG distributors or wholesale suppliers.',
      typicalConsiderations: 'Supplier may offer 7–15 days grace periods without interest, or small early-settlement discounts.',
      repaymentNature: 'Settled directly against distributor delivery invoices upon stock sales.'
    },
    {
      category: 'Bank Micro-Business Overdraft / Term Facility',
      typicalPurpose: 'Bridging periodic liquidity dips or managing monthly store operational expenses.',
      typicalConsiderations: 'Requires formal banking relationship, GST / current account transaction history, and shop verification.',
      repaymentNature: 'Monthly reducing balance EMI or revolving credit interest charged only on utilized amount.'
    },
    {
      category: 'NBFC Merchant Working Capital Line',
      typicalPurpose: 'Quick working capital replenishment for retail grocery and FMCG inventory cycles.',
      typicalConsiderations: 'May evaluate digital UPI counter turnover or QR code transaction frequency. Compare total processing charges and annual percentage rates.',
      repaymentNature: 'Daily or weekly automated deduction aligned with counter receipts.'
    },
    {
      category: 'Government MSME Schemes (e.g. MUDRA / PM SVANidhi)',
      typicalPurpose: 'Collateral-free micro-enterprise support for small retail shopkeepers and vendor businesses.',
      typicalConsiderations: 'Administered through commercial and regional rural banks with structured interest subvention terms.',
      repaymentNature: 'Structured term loan installments with standard scheduled monthly payments.'
    }
  ];

  const disclaimer = 'Financing information is provided for merchant educational and review purposes only. KiranaPilot does not lend, sell loans, rank financial providers, or guarantee loan approval, rates, eligibility, or availability. All decisions remain solely with the merchant.';

  return {
    success: true,
    merchant_id: merchantId,
    hasFundingGap,
    requiredAmount: reqAmount,
    projectedAvailableCash: Math.round(projectedAvailableCash),
    projectedGap: Math.round(projectedGap),
    paymentDate: targetDate,
    gapType,
    currentCash,
    factors: {
      expectedInflows: Math.round(expectedInflows),
      scheduledOutflows: Math.round(scheduledOutflows),
      totalKhataReceivable: totalKhata,
      attentionKhataDue: attentionDueSum
    },
    internalOptions,
    financingCategories,
    financingReviewAvailable: hasFundingGap,
    disclaimer
  };
}
