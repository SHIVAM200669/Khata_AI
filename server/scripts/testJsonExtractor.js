/**
 * Helper to safely extract JSON data from AI response text
 */
function extractJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Convert Indic numerals (Devanagari ०-९) to standard ASCII 0-9
  let text = rawText
    .replace(/[०]/g, '0')
    .replace(/[१]/g, '1')
    .replace(/[२]/g, '2')
    .replace(/[३]/g, '3')
    .replace(/[४]/g, '4')
    .replace(/[५]/g, '5')
    .replace(/[६]/g, '6')
    .replace(/[७]/g, '7')
    .replace(/[८]/g, '8')
    .replace(/[९]/g, '9');

  // 2. Remove markdown code fences (```json ... ``` or ``` ...)
  text = text.replace(/```(?:json|JSON)?([\s\S]*?)```/g, '$1').trim();

  // 3. Fix trailing commas before } or ]
  const sanitizeCommas = (str) => str.replace(/,\s*([}\]])/g, '$1');

  // 4. Try direct parse
  try {
    const direct = JSON.parse(sanitizeCommas(text));
    if (direct) return direct;
  } catch {}

  // 5. Look for outermost JSON object { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sanitizeCommas(candidate));
    } catch {}
  }

  // 6. Look for outermost JSON array [ ... ]
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = text.slice(firstBracket, lastBracket + 1);
    try {
      const arr = JSON.parse(sanitizeCommas(candidate));
      if (Array.isArray(arr)) {
        return { transactions: arr };
      }
    } catch {}
  }

  return null;
}

// Test cases
const test1 = '```json\n{\n  "transactions": [\n    {"customer_name": "Ramesh", "amount": 500,}\n  ]\n}\n```';
const test2 = 'Here is the extracted list:\n[\n  {"customer_name": "Suresh", "amount": 300}\n]';
const test3 = '{"data": [{"customer_name": "Mohan", "amount": 800}]}';

console.log('Test 1 (markdown + trailing comma):', extractJsonPayload(test1));
console.log('Test 2 (array with leading text):', extractJsonPayload(test2));
console.log('Test 3 (data key):', extractJsonPayload(test3));
