import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const apiKey = process.env.SARVAM_API_KEY;
const imagePath = 'C:\\Users\\Shivam\\.gemini\\antigravity-ide\\brain\\8adc6a90-87ae-45bb-9415-2a702896d9ef\\.user_uploaded\\media_1789836615426.png';

async function testWithRealImage() {
  if (!fs.existsSync(imagePath)) {
    console.log('Image not found:', imagePath);
    return;
  }
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('file', blob, 'ledger_page.png');
  formData.append('output_format', 'md');
  formData.append('content_type', 'mixed');

  console.log('Sending real image to Sarvam Doc AI Digitise...');
  const res = await fetch('https://api.sarvam.ai/doc-ai/v1/job/digitise', {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData
  });

  const data = await res.json();
  const jobId = data.job_id;
  console.log('Job ID:', jobId);

  // Poll
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const sRes = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/status`, {
      headers: { 'api-subscription-key': apiKey }
    });
    const sData = await sRes.json();
    console.log(`Poll ${i+1}: ${sData.status}`);
    if (sData.status === 'completed' || sData.status === 'failed') break;
  }

  // Results
  const rRes = await fetch(`https://api.sarvam.ai/doc-ai/v1/job/${jobId}/results`, {
    headers: { 'api-subscription-key': apiKey }
  });
  const rData = await rRes.json();
  console.log('Results Summary:');
  console.log('Status:', rData.status);
  console.log('Pages:', rData.documents?.[0]?.pages?.length);
  if (rData.documents?.[0]?.pages?.[0]?.blocks) {
    console.log('Blocks count:', rData.documents[0].pages[0].blocks.length);
    console.log('First 5 blocks:', JSON.stringify(rData.documents[0].pages[0].blocks.slice(0, 5), null, 2));
  }
}

testWithRealImage();
