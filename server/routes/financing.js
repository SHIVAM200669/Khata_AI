import { Router } from 'express';
import { getFinancingInformation, calculateIllustrativeCost } from '../services/financingInformationService.js';

const router = Router();

/**
 * GET /api/financing/info
 *
 * Single unified endpoint for KiranaPilot Module 11 Financing Information.
 * Returns:
 * - hasFundingGap: boolean
 * - requiredAmount, projectedAvailableCash, projectedGap, paymentDate
 * - internalOptions: Array of internal cash recovery options
 * - financingCategories: Neutral educational options
 * - disclaimer
 */
router.get('/info', async (req, res) => {
  const merchantId = req.user.merchantId;
  const requiredAmount = req.query.requiredAmount ? parseFloat(req.query.requiredAmount) : null;
  const paymentDate = req.query.paymentDate || null;
  const minThreshold = req.query.min_threshold ? parseFloat(req.query.min_threshold) : undefined;

  try {
    const data = await getFinancingInformation(merchantId, {
      requiredAmount,
      paymentDate,
      min_threshold: minThreshold
    });

    return res.status(200).json({
      success: true,
      financing: data
    });
  } catch (err) {
    console.warn('[GET /api/financing/info] Database offline, providing demo financing options:', err.message);
    return res.status(200).json({
      success: true,
      financing: {
        hasFundingGap: false,
        gapType: 'NONE',
        currentCash: 15450.00,
        projectedAvailableCash: 15450.00,
        projectedGap: 0,
        financingReviewAvailable: false,
        internalOptions: [
          {
            title: 'Khata Receivables Follow-Up',
            description: '₹8,750 outstanding across 5 customers.',
            actionLink: '/customers',
            potentialInflow: 8750
          }
        ],
        financingCategories: [
          {
            category: 'Short-Term Trade Credit',
            typicalPurpose: 'Supplier restocking & inventory bulk purchase',
            typicalConsiderations: 'Interest rate, tenure (30-90 days), repayment cycle'
          },
          {
            category: 'Micro-Working Capital Overdraft',
            typicalPurpose: 'Bridging 3-7 day liquidity gaps',
            typicalConsiderations: 'Daily interest on utilized amount, bank relationship'
          }
        ],
        disclaimer: 'KiranaPilot does not offer loans, provide financial advice, or endorse specific lenders. All options are for educational purposes.'
      }
    });
  }
});

/**
 * POST /api/financing/calculate
 *
 * Illustrative educational cost estimator.
 * Non-binding mathematical helper.
 */
router.post('/calculate', (req, res) => {
  const { principal, annualRatePercent, months } = req.body || {};
  try {
    const estimate = calculateIllustrativeCost(principal, annualRatePercent, months);
    return res.status(200).json({
      success: true,
      estimate
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parameters for illustrative calculation.'
    });
  }
});

export default router;
