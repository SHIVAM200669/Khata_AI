async function verify() {
  const cRes = await (await fetch('http://localhost:5000/api/customers')).json();
  const tRes = await (await fetch('http://localhost:5000/api/transactions')).json();
  console.log('Customers API Summary:', JSON.stringify(cRes.summary));
  console.log('Customers Count:', cRes.customers?.length);
  console.log('Transactions Count:', tRes.transactions?.length);
  console.log('Merchant Balance:', tRes.merchant?.current_cash_balance);
}

verify();
