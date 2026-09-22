import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLedgerText } from '../services/sarvamOcrService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Multer storage in server/uploads/
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uniqueName}${ext}`);
  },
});

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype.toLowerCase())) {
      return cb(
        Object.assign(
          new Error('Unsupported file format. Please upload a JPG, PNG, WEBP image or PDF document.'),
          { code: 'UNSUPPORTED_FORMAT' }
        )
      );
    }
    cb(null, true);
  },
});

function cleanup(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, () => {});
  }
}

const router = Router();

/**
 * POST /api/ocr/process
 *
 * Accepts multipart/form-data with field name "document" (or "file" / "image").
 * Processes the handwritten or printed ledger image via Sarvam Document AI OCR.
 * Returns raw extracted text and layout structure.
 */
router.post('/process', upload.single('document'), async (req, res) => {
  const file = req.file;
  const language = req.body.language || null;

  try {
    // 1. Verify file was provided
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No document file was uploaded. Please select or photograph a ledger page.',
      });
    }

    // 2. Verify file is not empty
    if (file.size === 0) {
      cleanup(file.path);
      return res.status(400).json({
        success: false,
        message: 'The uploaded file is empty. Please select a valid ledger image.',
      });
    }

    // 3. Process with Sarvam Document AI
    const result = await extractLedgerText(file.path, file.mimetype, language);

    // 4. Clean up temporary file
    cleanup(file.path);

    // 5. Return extracted OCR data
    return res.status(200).json({
      success: true,
      text: result.text,
      language_code: result.language_code,
      request_id: result.request_id,
      page_count: result.page_count,
      blocks: result.blocks,
      status: 'completed',
    });
  } catch (err) {
    cleanup(file?.path);
    console.error('[ocr/process] Error:', err.message);

    const statusCode = err.statusCode || 500;
    const messages = {
      MISSING_API_KEY:        'OCR service is not configured. Please contact the administrator.',
      SARVAM_AUTH_ERROR:      'OCR service authentication failed. Please verify API configuration.',
      OCR_NETWORK_ERROR:      'Could not reach Sarvam OCR service. Please check network connection.',
      OCR_TIMEOUT:            'Document processing timed out. Please try with a clearer or smaller image.',
      OCR_JOB_FAILED:         'Could not process document. Please ensure the image is clear and legible.',
      EMPTY_OCR_RESULT:       'No readable text detected. Please ensure proper lighting and handwriting clarity.',
      UNSUPPORTED_FORMAT:     'Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.',
    };

    const message = messages[err.code] || err.message || 'Failed to extract text from document.';
    return res.status(statusCode).json({ success: false, message });
  }
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File size too large (max 15 MB). Please upload a smaller image.',
      });
    }
    return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
  }
  if (err?.code === 'UNSUPPORTED_FORMAT') {
    return res.status(415).json({ success: false, message: err.message });
  }
  console.error('[ocr] Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'An unexpected upload error occurred.' });
});

export default router;
