import fs from 'fs';
import path from 'path';

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

/**
 * Send an audio file to Sarvam AI Speech-to-Text API and return the transcript.
 *
 * @param {string} filePath      – Absolute path to the uploaded audio file on disk.
 * @param {string} mimeType      – The MIME type reported by the client (e.g. audio/webm).
 * @param {string} [languageCode] – Optional BCP-47 language code (e.g. 'hi-IN', 'ta-IN', 'unknown').
 * @returns {Promise<{transcript:string, language_code:string, request_id:string}>}
 */
export async function transcribeAudio(filePath, mimeType, languageCode = 'unknown') {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('SARVAM_API_KEY is not configured on the server.'), {
      code: 'MISSING_API_KEY',
      statusCode: 500,
    });
  }

  // Build a multipart/form-data body using the native Node 18+ FormData
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Determine a sensible extension from the MIME type
  const ext = mimeType?.includes('webm') ? '.webm'
            : mimeType?.includes('ogg')  ? '.ogg'
            : mimeType?.includes('mp4')  ? '.mp4'
            : mimeType?.includes('wav')  ? '.wav'
            : mimeType?.includes('mpeg') ? '.mp3'
            : '.webm';

  const blob = new Blob([fileBuffer], { type: mimeType || 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, `recording${ext}`);
  formData.append('model', 'saaras:v3');
  formData.append('language_code', languageCode || 'unknown');
  // 'transcribe' preserves original language without translating
  formData.append('mode', 'transcribe');

  let response;
  try {
    response = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    });
  } catch (networkErr) {
    throw Object.assign(new Error('Could not reach Sarvam Speech-to-Text service.'), {
      code: 'SARVAM_NETWORK_ERROR',
      statusCode: 502,
    });
  }

  const body = await response.text();

  if (!response.ok) {
    // Parse error details from Sarvam safely
    let detail = 'Sarvam API request failed.';
    try {
      const err = JSON.parse(body);
      detail = err.message || err.error || err.detail || detail;
    } catch { /* ignore parse error */ }

    const statusCode =
      response.status === 401 ? 401
      : response.status === 429 ? 429
      : response.status >= 500 ? 502
      : 400;

    const code =
      response.status === 401 ? 'SARVAM_AUTH_ERROR'
      : response.status === 429 ? 'SARVAM_RATE_LIMIT'
      : response.status >= 500 ? 'SARVAM_SERVER_ERROR'
      : 'SARVAM_REQUEST_ERROR';

    // Never expose the actual API key in error messages
    const safeDetail = detail.replace(apiKey, '***');

    throw Object.assign(new Error(safeDetail), { code, statusCode });
  }

  // Parse successful response
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw Object.assign(new Error('Invalid response from Sarvam API.'), {
      code: 'SARVAM_PARSE_ERROR',
      statusCode: 502,
    });
  }

  const transcript = data.transcript ?? data.text ?? '';
  if (!transcript) {
    throw Object.assign(new Error('No transcript was returned by Sarvam.'), {
      code: 'EMPTY_TRANSCRIPT',
      statusCode: 422,
    });
  }

  return {
    transcript,
    language_code: data.language_code || 'unknown',
    request_id: data.request_id || '',
  };
}
