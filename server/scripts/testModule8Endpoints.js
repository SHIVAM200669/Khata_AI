async function testModule8Endpoints() {
  console.log('Testing GET /api/dashboard/summary:');
  const dRes = await fetch('http://localhost:5000/api/dashboard/summary');
  const dData = await dRes.json();
  console.log('Dashboard summary status:', dRes.status);
  console.log('Current cash:', dData.current_cash);
  console.log('Today sales:', dData.today_sales);
  console.log('Outstanding khata:', dData.total_outstanding_khata);
  console.log('Recent tx count:', dData.recent_transactions?.length);
  console.log('Forecast summary:', dData.forecast_summary);

  console.log('\nTesting GET /api/forecast:');
  const fRes = await fetch('http://localhost:5000/api/forecast');
  const fData = await fRes.json();
  console.log('Forecast status:', fRes.status);
  console.log('Current cash:', fData.current_cash);
  console.log('7-day days count:', fData.forecast?.length);
  console.log('Day 1:', fData.forecast?.[0]);
  console.log('Day 7:', fData.forecast?.[6]);
  console.log('Confidence:', fData.confidence, '(', fData.confidence_reason, ')');
}

testModule8Endpoints();
