import { Router } from 'express';
import { testConnection } from '../config/db.js';

const router = Router();

/**
 * GET /api/db/health
 * Tests the actual MySQL connection and returns a safe status.
 */
router.get('/health', async (_req, res) => {
  const result = await testConnection();
  const statusCode = result.success ? 200 : 503;
  res.status(statusCode).json(result);
});

export default router;
