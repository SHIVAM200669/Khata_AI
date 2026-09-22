import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dbHealthRoutes from './routes/dbHealth.js';
import voiceRoutes from './routes/voice.js';
import transactionRoutes from './routes/transactions.js';
import ocrRoutes from './routes/ocr.js';
import customerRoutes from './routes/customers.js';
import forecastRoutes from './routes/forecast.js';
import dashboardRoutes from './routes/dashboard.js';
import expenseRoutes from './routes/expenses.js';
import agentRoutes from './routes/agent.js';
import alertRoutes from './routes/alerts.js';
import financingRoutes from './routes/financing.js';
import authRoutes from './routes/auth.js';
import { requireAuth } from './middleware/firebaseAuth.js';
import { ensureDbReady } from './scripts/seedMerchant.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'KiranaPilot API is running'
  });
});

// Database health route  (Module 2)
app.use('/api/db', dbHealthRoutes);

// ── Authentication routes (Module 11 — Firebase Auth) ──
// These are public (login, register, link) + protected (me, profile)
app.use('/api/auth', authRoutes);

// ── Protected Routes — Require Firebase Authentication ──

// Voice transcription routes (Module 3)
app.use('/api/voice', requireAuth, voiceRoutes);

// Transaction parsing & management routes (Module 4)
app.use('/api/transactions', requireAuth, transactionRoutes);

// Document OCR routes (Module 5)
app.use('/api/ocr', requireAuth, ocrRoutes);

// Customers & Khata intelligence routes (Module 7)
app.use('/api/customers', requireAuth, customerRoutes);

// Cash-Flow Forecasting & Financial Sync routes (Module 8)
app.use('/api/forecast', requireAuth, forecastRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/expenses', requireAuth, expenseRoutes);

// AI Financial Agent / Financial Copilot routes (Module 9)
app.use('/api/agent', requireAuth, agentRoutes);

// Financial Alerts & Recommended Actions routes (Module 10)
app.use('/api/alerts', requireAuth, alertRoutes);

// Financing Information & Educational Review routes
app.use('/api/financing', requireAuth, financingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Express Error]:', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Server] Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.warn('[Server] Uncaught Exception:', err?.message || err);
});

app.listen(PORT, async () => {
  console.log(`KiranaPilot server listening on port ${PORT}`);
  try {
    await ensureDbReady();
  } catch (err) {
    console.warn('[DB] Startup check error:', err.message);
  }
});

