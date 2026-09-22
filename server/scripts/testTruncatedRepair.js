/**
 * Recovers valid items from a truncated JSON array or object
 */
function repairTruncatedJson(str) {
  if (!str || typeof str !== 'string') return null;

  // Find all complete individual objects inside the text
  const objectRegex = /\{[^{}]*?"transaction_date"[^{}]*?\}/g;
  const matches = str.match(objectRegex);

  if (matches && matches.length > 0) {
    const validItems = [];
    for (const m of matches) {
      try {
        const item = JSON.parse(m.replace(/,\s*$/, ''));
        validItems.push(item);
      } catch {}
    }
    if (validItems.length > 0) {
      return { transactions: validItems };
    }
  }

  // Strategy 2: Find the last complete '}' and close the array ']}'
  const lastCompleteObjIdx = str.lastIndexOf('}');
  if (lastCompleteObjIdx !== -1) {
    const truncatedChunk = str.slice(0, lastCompleteObjIdx + 1);
    // Check if it starts with { "transactions": [
    const firstBracket = truncatedChunk.indexOf('[');
    if (firstBracket !== -1) {
      const repaired = truncatedChunk.slice(firstBracket) + ']';
      try {
        const arr = JSON.parse(repaired);
        if (Array.isArray(arr)) {
          return { transactions: arr };
        }
      } catch {}
    }
  }

  return null;
}

const truncatedSample = `{
  "transactions": [
    {
      "transaction_date": "2024-09-01",
      "customer_name": "Ramesh",
      "amount": 500,
      "transaction_type": "CREDIT_SALE",
      "description": "Sugar 2kg, Tea 1pkt"
    },
    {
      "transaction_date": "2024-09-02",
      "customer_name": "Suresh",
      "amount": 300,
      "transaction_type": "CASH_SALE",
      "description": "Atta 5kg"
    },
    {
      "transaction_date": "2024-09-03",
      "customer_name": "Mohan",
      "amount": 800,
      "transaction_type": "CREDIT_SALE",
      "description": "Rice 10kg"
    },
    {
      "transaction_date": "2024-09-04",
      "customer_name": "Ramesh",
      "amount": 250,
      "review`;

console.log('Repaired Output:', JSON.stringify(repairTruncatedJson(truncatedSample), null, 2));
