import express from 'express';
import { processAgentChat } from '../services/financialAgentService.js';

const router = express.Router();

/**
 * Suggested starter prompts for the Kirana merchant.
 */
const SUGGESTED_PROMPTS = [
  {
    category: 'Cash & Liquidity',
    prompts: [
      { text: 'Will I have enough money tomorrow?', lang: 'en' },
      { text: 'How much cash do I have right now?', lang: 'en' },
      { text: 'Kal mere paas kitne paise honge?', lang: 'hi' }
    ]
  },
  {
    category: 'Large Payments & Cash Gap',
    prompts: [
      { text: 'Can I pay ₹50,000 tomorrow?', lang: 'en' },
      { text: 'Mujhe kal ₹20,000 dene hain, kya paise honge?', lang: 'hi' },
      { text: 'What if I need to pay ₹10,000 to Amul on Friday?', lang: 'en' }
    ]
  },
  {
    category: 'Khata & Customers',
    prompts: [
      { text: 'How much do customers owe me in total?', lang: 'en' },
      { text: 'Who owes me the most Khata?', lang: 'en' },
      { text: 'Which customers have not repaid recently?', lang: 'en' }
    ]
  },
  {
    category: 'Sales & Expenses',
    prompts: [
      { text: 'How much did I sell today?', lang: 'en' },
      { text: 'Aaj kitni bikri hui?', lang: 'hi' },
      { text: 'What are my upcoming payments and bills?', lang: 'en' }
    ]
  }
];

/**
 * GET /api/agent/suggested-prompts
 * Returns quick starter questions for the merchant UI.
 */
router.get('/suggested-prompts', (req, res) => {
  res.json({
    success: true,
    suggestions: SUGGESTED_PROMPTS
  });
});

/**
 * POST /api/agent/chat
 * Primary conversation endpoint for AI Financial Copilot.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversation_history } = req.body;
    // In production with auth middleware, merchant_id is req.user.merchant_id.
    // For single merchant / demo session:
    const merchantId = req.user.merchantId;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required and must be a non-empty string.'
      });
    }

    const result = await processAgentChat(merchantId, message, conversation_history || []);
    res.json(result);
  } catch (error) {
    console.error('[agentRoute] Error processing copilot chat:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to process AI financial copilot response. Please try again.',
      code: error.code || 'COPILOT_ERROR'
    });
  }
});

export default router;
