import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;

// Create a small test image in base64
const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testBuffer = Buffer.from(testPngBase64, 'base64');

async function testFullPipeline() {
  console.log('1. Submitting Doc AI Digitise Job...');
  const formData = new FormData();
  const blob = new Blob([testBuffer], { type: 'image/png' });
  formData.append('file', blob, 'sample_ledger.png');
  formData.append('output_format', 'md');
  formData.append('content_type', 'handwritten');

  const res = await fetch('https://api.sarvam.ai/doc-ai/v1/job/digitise', {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData
  });

  const initData = await res.json();
  const jobId = initData.job_id;
  console.log('Job ID created:', jobId);

  // Poll status
  let attempts = 0;
  while (attempts < 15) {
    await new Promise(r => setTimeout(r, 1500));
    attempts++;
    const sRes = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/status`, {
      headers: { 'api-subscription-key': apiKey }
    });
    const sData = await sRes.json();
    console.log(`Attempt ${attempts}: status = ${sData.status}`);
    if (sData.status === 'completed' || sData.status === 'failed' || sData.status === 'rejected') {
      break;
    }
  }

  // Fetch results
  console.log('\n2. Fetching Results from /results endpoint...');
  const rRes = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/results`, {
    headers: { 'api-subscription-key': apiKey }
  });
  console.log('Results status:', rRes.status);
  const rData = await rRes.json();
  console.log('Results JSON:', JSON.stringify(rData, null, 2));
}

testFullPipeline();
