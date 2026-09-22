import fs from 'fs';
import path from 'path';

const SARVAM_DOC_DIGITISE_URL = 'https://api.sarvam.ai/doc-ai/v1/job/digitise';
const SARVAM_DOC_STATUS_URL   = 'https://api.sarvam.ai/doc-ai/v1/job';

/**
 * Sends a handwritten or printed ledger document (image/PDF) to Sarvam AI Document Intelligence
 * and extracts the raw OCR text and layout blocks.
 *
 * @param {string} filePath  - Absolute path to the temporary file on disk.
 * @param {string} mimeType  - MIME type of the uploaded document (e.g. image/jpeg, image/png, application/pdf).
 * @param {string} [language] - Optional BCP-47 language code (e.g. 'hi-IN', 'ta-IN', 'en-IN').
 * @returns {Promise<{
 *   success: boolean,
 *   text: string,
 *   language_code: string,
 *   request_id: string,
 *   status: string,
 *   page_count: number,
 *   blocks: Array<{ block_id: string, text: string, layout_tag: string, reading_order: number }>
 * }>}
 */
export async function extractLedgerText(filePath, mimeType, language = null) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('SARVAM_API_KEY is not configured on the server.'), {
      code: 'MISSING_API_KEY',
      statusCode: 500,
    });
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw Object.assign(new Error('Document file not found on server.'), {
      code: 'FILE_NOT_FOUND',
      statusCode: 400,
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer.length === 0) {
    throw Object.assign(new Error('The uploaded document is empty.'), {
      code: 'EMPTY_FILE',
      statusCode: 400,
    });
  }

  const ext = path.extname(filePath) || (mimeType?.includes('pdf') ? '.pdf' : '.jpg');
  const blob = new Blob([fileBuffer], { type: mimeType || 'image/jpeg' });

  // 1. Submit Digitise Job
  const formData = new FormData();
  formData.append('file', blob, `ledger_document${ext}`);
  formData.append('output_format', 'md');
  formData.append('content_type', 'handwritten');
  if (language) {
    formData.append('language', language);
  }

  let initRes;
  try {
    initRes = await fetch(SARVAM_DOC_DIGITISE_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    });
  } catch (networkErr) {
    console.error('[sarvamOcrService] Network error initiating job:', networkErr.message);
    throw Object.assign(new Error('Could not reach Sarvam Document Intelligence service.'), {
      code: 'OCR_NETWORK_ERROR',
      statusCode: 502,
    });
  }

  const initBody = await initRes.text();

  if (!initRes.ok) {
    console.error('[sarvamOcrService] Job initiation failed:', initRes.status, initBody);
    let detail = 'Sarvam Document AI request failed.';
    try {
      const errObj = JSON.parse(initBody);
      detail = errObj.message || errObj.error?.message || errObj.detail || detail;
    } catch { /* ignore */ }

    const safeDetail = detail.replace(apiKey, '***');
    throw Object.assign(new Error(safeDetail), {
      code: initRes.status === 401 ? 'SARVAM_AUTH_ERROR' : 'OCR_REQUEST_ERROR',
      statusCode: initRes.status >= 500 ? 502 : initRes.status,
    });
  }

  let initData;
  try {
    initData = JSON.parse(initBody);
  } catch {
    throw Object.assign(new Error('Invalid response from Sarvam OCR job creation.'), {
      code: 'OCR_PARSE_ERROR',
      statusCode: 502,
    });
  }

  const jobId = initData.job_id || initData.id;
  if (!jobId) {
    throw Object.assign(new Error('Sarvam did not return a valid job ID.'), {
      code: 'OCR_JOB_ID_MISSING',
      statusCode: 502,
    });
  }

  // 2. Poll for Job Completion (timeout after 45s)
  const maxAttempts = 25;
  const pollIntervalMs = 1800;
  let jobCompleted = false;
  let terminalStatus = 'pending';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    let statusRes;
    try {
      statusRes = await fetch(`${SARVAM_DOC_STATUS_URL}/${jobId}/status`, {
        headers: { 'api-subscription-key': apiKey },
      });
    } catch (pollErr) {
      console.warn(`[sarvamOcrService] Status poll attempt ${attempt + 1} network error:`, pollErr.message);
      continue;
    }

    if (!statusRes.ok) {
      continue;
    }

    const statusData = await statusRes.json();
    terminalStatus = statusData.status || 'pending';

    if (terminalStatus === 'completed' || terminalStatus === 'partially_completed') {
      jobCompleted = true;
      break;
    }

    if (terminalStatus === 'failed' || terminalStatus === 'rejected') {
      throw Object.assign(new Error(`Sarvam OCR job ${terminalStatus}. The document may be corrupted or unreadable.`), {
        code: 'OCR_JOB_FAILED',
        statusCode: 422,
      });
    }
  }

  if (!jobCompleted) {
    throw Object.assign(new Error('Document OCR processing timed out. Please try with a clearer or smaller image.'), {
      code: 'OCR_TIMEOUT',
      statusCode: 504,
    });
  }

  // 3. Fetch Job Results
  let resultsRes;
  try {
    resultsRes = await fetch(`${SARVAM_DOC_STATUS_URL}/${jobId}/results`, {
      headers: { 'api-subscription-key': apiKey },
    });
  } catch (resErr) {
    console.error('[sarvamOcrService] Results fetch error:', resErr.message);
    throw Object.assign(new Error('Could not retrieve OCR results from Sarvam.'), {
      code: 'OCR_RESULTS_FETCH_ERROR',
      statusCode: 502,
    });
  }

  if (!resultsRes.ok) {
    const errText = await resultsRes.text();
    console.error('[sarvamOcrService] Results endpoint returned status:', resultsRes.status, errText);
    throw Object.assign(new Error('Failed to retrieve OCR results from Sarvam Document AI.'), {
      code: 'OCR_RESULTS_ERROR',
      statusCode: 502,
    });
  }

  const resultsData = await resultsRes.json();

  // 4. Extract text preserving layout, line breaks, blocks, reading order
  const allBlocks = [];
  const textChunks = [];
  let pageCount = 0;

  if (Array.isArray(resultsData.documents)) {
    for (const doc of resultsData.documents) {
      if (Array.isArray(doc.pages)) {
        pageCount += doc.pages.length;
        for (const page of doc.pages) {
          if (Array.isArray(page.blocks)) {
            // Sort blocks by reading order if available
            const sortedBlocks = [...page.blocks].sort((a, b) => (a.reading_order || 0) - (b.reading_order || 0));
            for (const b of sortedBlocks) {
              if (b.text && b.text.trim()) {
                allBlocks.push({
                  block_id: b.block_id || `b_${allBlocks.length + 1}`,
                  text: b.text.trim(),
                  layout_tag: b.layout_tag || 'paragraph',
                  reading_order: b.reading_order || allBlocks.length + 1,
                });
                textChunks.push(b.text.trim());
              }
            }
          }
        }
      }
    }
  }

  const extractedText = textChunks.join('\n\n');

  if (!extractedText.trim()) {
    throw Object.assign(new Error('No readable text could be extracted from the image. Please ensure the image is well-lit and legible.'), {
      code: 'EMPTY_OCR_RESULT',
      statusCode: 422,
    });
  }

  return {
    success: true,
    text: extractedText,
    language_code: language || 'unknown',
    request_id: jobId,
    status: 'completed',
    page_count: pageCount || 1,
    blocks: allBlocks,
  };
}
