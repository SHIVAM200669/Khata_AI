async function testEndpoint() {
  const sample = `01-09-24 Ramesh Sugar 2kg, Tea 1pkt 500 Udhaar
02-09-24 Suresh Atta 5kg 300 Cash
03-09-24 Mohan Rice 10kg 800 Udhaar
05-09-24 Ramesh Payment received 500 Repayment
12-09-24 Shop Expense Stock Payment 2000 Expense
13-09-24 Shop Expense Electricity Bill 1200 Expense`;

  console.log('Testing POST /api/transactions/parse-ocr...');
  const res = await fetch('http://localhost:5000/api/transactions/parse-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sample,
      merchant_id: 1
    })
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('Success:', data.success);
  console.log('Transactions Count:', data.transactions?.length);
  console.log('Sample item:', data.transactions?.[0]);
  console.log('Summary:', data.summary);
}

testEndpoint();
