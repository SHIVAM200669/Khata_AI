import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeAudio } from '../services/sarvamSpeechService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ----- Multer config: store temporarily in server/uploads/ -----
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${uniqueName}${ext}`);
  },
});

const ALLOWED_MIME_PREFIXES = ['audio/', 'video/webm']; // browsers send video/webm for opus
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
    if (!ok) {
      return cb(Object.assign(new Error('Unsupported audio format.'), { code: 'UNSUPPORTED_FORMAT' }));
    }
    cb(null, true);
  },
});

// ----- Helper: delete temp file silently -----
function cleanup(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, () => {});
  }
}

// ----- Router -----
const router = Router();

/**
 * POST /api/voice/transcribe
 *
 * Accepts multipart/form-data with field name "audio".
 * Sends the file to Sarvam Speech-to-Text and returns the transcript.
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const file = req.file;

  try {
    // 1. Verify file exists
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file was uploaded. Please record and try again.',
      });
    }

    // 2. Verify file is not empty
    if (file.size === 0) {
      cleanup(file.path);
      return res.status(400).json({
        success: false,
        message: 'The uploaded recording is empty. Please try recording again.',
      });
    }

    // 3. Call Sarvam service
    const result = await transcribeAudio(file.path, file.mimetype);

    // 4. Clean up temp file
    cleanup(file.path);

    // 5. Return transcript
    return res.status(200).json({
      success: true,
      transcript: result.transcript,
      language_code: result.language_code,
      request_id: result.request_id,
    });
  } catch (err) {
    // Always clean up the temp file on error
    cleanup(file?.path);

    console.error('[voice/transcribe] Error:', err.message);

    // Map known error codes to user-friendly messages
    const statusCode = err.statusCode || 500;
    const messages = {
      MISSING_API_KEY:      'Speech service is not configured. Please contact the administrator.',
      SARVAM_AUTH_ERROR:     'Speech service authentication failed. Please contact the administrator.',
      SARVAM_RATE_LIMIT:    'Too many requests. Please wait a moment and try again.',
      SARVAM_NETWORK_ERROR: 'Could not reach the speech service. Please check your connection and try again.',
      SARVAM_SERVER_ERROR:  'Speech service is temporarily unavailable. Please try again later.',
      EMPTY_TRANSCRIPT:     'Could not transcribe the recording. Please speak clearly and try again.',
      UNSUPPORTED_FORMAT:   'Unsupported audio format. Please try a different recording.',
    };

    const message = messages[err.code] || 'Could not transcribe the recording. Please try again.';

    return res.status(statusCode).json({ success: false, message });
  }
});

// Multer error handler (file too large, wrong type, etc.)
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'Recording is too large (max 10 MB). Please record a shorter clip.',
      });
    }
    return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
  }
  if (err?.code === 'UNSUPPORTED_FORMAT') {
    return res.status(415).json({ success: false, message: err.message });
  }
  // Fallback
  console.error('[voice] Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

export default router;
