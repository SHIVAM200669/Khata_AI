import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;

// Create a small 1x1 test PNG in base64
const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testV2ChatVision() {
  console.log('Testing /v2/chat/completions with image_url base64...');
  try {
    const res = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: 'sarvam-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all handwritten text from this image exactly as written.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${testPngBase64}` } }
            ]
          }
        ]
      })
    });
    console.log('V2 response status:', res.status);
    const data = await res.text();
    console.log('V2 response:', data);
  } catch (e) {
    console.error('V2 error:', e);
  }
}

async function testV1ChatVision() {
  console.log('\nTesting /v1/chat/completions with image_url base64...');
  try {
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all text from this image.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${testPngBase64}` } }
            ]
          }
        ]
      })
    });
    console.log('V1 response status:', res.status);
    const data = await res.text();
    console.log('V1 response:', data);
  } catch (e) {
    console.error('V1 error:', e);
  }
}

async function testDocumentDigitize() {
  console.log('\nTesting /document/digitize or /v1/document/jobs...');
  try {
    const res = await fetch('https://api.sarvam.ai/document/digitize', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      }
    });
    console.log('Document digitize status:', res.status);
    const data = await res.text();
    console.log('Document digitize response:', data);
  } catch (e) {
    console.error('Doc error:', e);
  }
}

async function run() {
  await testV2ChatVision();
  await testV1ChatVision();
  await testDocumentDigitize();
}

run();
