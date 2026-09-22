import { buildFinancialAgentContext } from './financialAgentContextService.js';

const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';

/**
 * Builds the system prompt for the financial agent with real merchant data.
 */
function buildSystemPrompt(context) {
  return `You are KiranaPilot's AI Financial Copilot, an expert, trustworthy, and factual financial assistant for small Indian Kirana (retail/grocery) shopkeepers.

YOUR MISSION:
Explain the merchant's financial position clearly, factually, and empathetically using ONLY the supplied REAL MySQL financial context below.

CRITICAL RULES:
1. STRICT TRUTHFULNESS: Answer ONLY from the supplied financial context. NEVER invent, hallucinate, or assume any financial numbers, customers, dates, or transactions.
2. CURRENCY & FORMATTING: Always use the Indian Rupee symbol "₹" and Indian numbering format (e.g. ₹15,000, ₹1,50,000).
3. FACT vs. FORECAST: Clearly distinguish current real balances (e.g. "Current cash is ₹X") from future projections. When talking about the future, always use terms like "projected", "expected", or "estimated" along with the specific date or day.
4. LARGE PAYMENTS & CASH GAPS: When asked if a payment can be made (e.g. ₹50,000 tomorrow), explain the math clearly:
   - Current cash & expected inflows
   - Scheduled outflows
   - Net projected balance after the payment
   - Exact projected cash gap (if negative/shortage)
5. NEUTRAL ADVISORY & ANTI-PREDATORY RULES:
   - If there is a cash shortage, suggest practical merchant actions: collecting pending Khata from attention customers, postponing non-essential supplier invoices, or reviewing upcoming bill dates.
   - NEVER push or sell loans.
   - NEVER fabricate interest rates or loan approvals.
6. READ-ONLY GUARANTEE:
   - You CANNOT create, modify, or delete transactions or accounts. If the merchant asks to record a sale or payment, politely instruct them to use the Voice Recorder or OCR Ledger Scanner in KiranaPilot.
7. CUSTOMER TRANSACTION HISTORY:
   - If the merchant asks about specific credit or repayment dates for a customer (e.g., "on which day I gave credit to Neha"), strictly reference the \`recent_transactions\` array provided in the customer's data within the context. Do not guess or hallucinate dates.
8. LANGUAGE ADAPTATION:
   - Respond in the same language as the user query (English, Hindi, or natural conversational Hinglish). Keep answers concise, clear, and easy for a busy shopkeeper to read.
9. FINANCIAL ALERTS & ATTENTION:
   - When asked what needs attention or about active warnings/alerts (e.g. "What needs my attention?", "Any alerts?"), summarize the current critical and warning items from the live \`alerts\` array in the context and provide clear, practical action steps based on the facts.
10. FINANCING INFORMATION & FUNDING GAPS:
   - When asked about cash shortages, options, or financing (e.g. "What can I do if I have a cash shortage?", "Mujhe paise ki kami hai, kya options hain?"):
     1. State the exact projected cash gap factually based on \`financing.projectedGap\` or \`scenario.cash_gap\`.
     2. Recommend internal solutions first: collecting pending Khata dues from customers with attention flags, and checking whether upcoming supplier bills can be split or adjusted.
     3. If an unresolved gap remains, present neutral educational categories (e.g. distributor trade credit, bank micro-business overdraft, NBFC working capital line, government MSME schemes like MUDRA/PM SVANidhi).
     4. NEVER recommend a specific lender as "best", NEVER rank lenders, NEVER fabricate interest rates, approval probabilities, or loan offers, and NEVER state that financing is guaranteed. Clearly state that approval and terms are determined exclusively by financial institutions.

=== LIVE MERCHANT FINANCIAL CONTEXT ===
${JSON.stringify(context, null, 2)}
=== END CONTEXT ===`;
}

/**
 * Generates structured supporting visual data cards based on intent and context.
 */
function buildSupportingDataCards(context) {
  const cards = [];
  const intent = context.intent;
  const currentCash = context.merchant.cash_balance;
  const khataOutstanding = context.khata.total_outstanding;

  // 1. Current Cash
  if (['CASH_BALANCE', 'URGENT_PAYMENT', 'CASH_FORECAST', 'CASH_SHORTAGE', 'TODAY_SALES', 'FINANCIAL_ALERTS', 'FINANCING_INFORMATION'].includes(intent)) {
    cards.push({
      label: 'Current Cash',
      value: `₹${Number(currentCash).toLocaleString('en-IN')}`,
      type: 'cash',
      subtitle: 'In drawer / register'
    });
  }

  // 2. Financing Gap / Shortage Card
  if (intent === 'FINANCING_INFORMATION' && context.financing) {
    if (context.financing.hasFundingGap) {
      cards.push({
        label: 'Projected Funding Gap',
        value: `₹${Number(context.financing.projectedGap).toLocaleString('en-IN')}`,
        type: 'warning',
        subtitle: `Date: ${context.financing.paymentDate}`
      });
      cards.push({
        label: 'Collectible Khata',
        value: `₹${Number(context.financing.factors?.totalKhataReceivable || 0).toLocaleString('en-IN')}`,
        type: 'khata',
        subtitle: 'Internal recovery option'
      });
    } else {
      cards.push({
        label: 'Working Capital Status',
        value: 'Healthy',
        type: 'success',
        subtitle: 'No funding gap projected'
      });
    }
  }

  // 2. Alerts Summary (if asking about alerts / attention)
  if (intent === 'FINANCIAL_ALERTS' && context.alerts) {
    const { critical, warning, info } = context.alerts.summary || { critical: 0, warning: 0, info: 0 };
    if (critical > 0) {
      cards.push({
        label: 'Critical Alerts',
        value: `${critical}`,
        type: 'warning',
        subtitle: 'Immediate action needed'
      });
    }
    if (warning > 0) {
      cards.push({
        label: 'Warnings',
        value: `${warning}`,
        type: 'warning',
        subtitle: 'Deserves attention'
      });
    }
  }

  // 2. Today's Sales
  if (['TODAY_SALES', 'SALES_SUMMARY'].includes(intent)) {
    cards.push({
      label: "Today's Sales",
      value: `₹${Number(context.today.total_sales).toLocaleString('en-IN')}`,
      type: 'sales',
      subtitle: `₹${Number(context.today.cash_sales).toLocaleString('en-IN')} Cash + ₹${Number(context.today.credit_sales).toLocaleString('en-IN')} Credit`
    });
  }

  // 3. Khata Outstanding
  if (['KHATA_OUTSTANDING', 'CUSTOMER_DETAILS', 'CUSTOMER_REPAYMENT', 'CASH_SHORTAGE', 'URGENT_PAYMENT'].includes(intent)) {
    cards.push({
      label: 'Khata Outstanding',
      value: `₹${Number(khataOutstanding).toLocaleString('en-IN')}`,
      type: 'khata',
      subtitle: `${context.khata.customers_with_due} customer(s) with dues`
    });
  }

  // 3.5 Ambiguous Customer Candidate Cards
  if (intent === 'AMBIGUOUS_CUSTOMER' && context.customer_entity?.matches) {
    for (const match of context.customer_entity.matches) {
      cards.push({
        label: match.name,
        value: `₹${Number(match.outstanding).toLocaleString('en-IN')}`,
        type: 'warning',
        subtitle: match.phone ? `Ph: ${match.phone}` : (match.last_transaction_date ? `Last tx: ${match.last_transaction_date}` : 'No phone recorded')
      });
    }
  }

  // 3.6 Target Customer Card
  if (context.target_customer) {
    const tc = context.target_customer;
    cards.push({
      label: tc.name,
      value: `₹${Number(tc.outstanding).toLocaleString('en-IN')}`,
      type: 'khata',
      subtitle: `Total Credit: ₹${Number(tc.total_credit).toLocaleString('en-IN')} | Repaid: ₹${Number(tc.total_repaid).toLocaleString('en-IN')}`
    });
  }

  // 4. Large Payment Simulation Scenario Cards
  if (intent === 'URGENT_PAYMENT' && context.scenario.amount) {
    cards.push({
      label: 'Proposed Payment',
      value: `₹${Number(context.scenario.amount).toLocaleString('en-IN')}`,
      type: 'payment',
      subtitle: `Target: ${context.scenario.relative_label || context.scenario.target_date}`
    });

    if (context.scenario.cash_gap > 0) {
      cards.push({
        label: 'Projected Cash Gap',
        value: `₹${Number(context.scenario.cash_gap).toLocaleString('en-IN')}`,
        type: 'warning',
        subtitle: 'Shortage after payment'
      });
    } else {
      cards.push({
        label: 'Projected Balance',
        value: `₹${Number(context.scenario.projected_remaining).toLocaleString('en-IN')}`,
        type: 'success',
        subtitle: 'Remaining closing cash'
      });
    }
  }

  // 5. Cash Forecast / Tomorrow
  if (['CASH_FORECAST', 'CASH_SHORTAGE'].includes(intent) && context.forecast.daily.length > 0) {
    const tomForecast = context.forecast.daily[0];
    cards.push({
      label: `Projected Cash (${tomForecast.day_name || 'Tomorrow'})`,
      value: `₹${Number(tomForecast.closing_cash).toLocaleString('en-IN')}`,
      type: tomForecast.status === 'HEALTHY' ? 'forecast' : 'warning',
      subtitle: `Status: ${tomForecast.status}`
    });
  }

  return cards;
}

/**
 * Deterministic fallback generator for when external LLM API is unavailable.
 * Guarantees zero hallucinations and 100% mathematical accuracy from MySQL.
 */
export function generateDeterministicFallback(context, userMessage) {
  const intent = context.intent;
  const currentCash = context.merchant.cash_balance;
  const isHindi = /\b(kya|mere|paise|kitne|baki|hai|hain|hoga|honge|dene|batao|bikri|udhar|aaj|kal|parson)\b/i.test(userMessage);

  switch (intent) {
    case 'FINANCING_INFORMATION': {
      const fin = context.financing;
      const hasGap = fin?.hasFundingGap || (context.scenario?.cash_gap > 0);
      const gapAmt = fin?.projectedGap || context.scenario?.cash_gap || 0;
      const targetDt = fin?.paymentDate || context.scenario?.target_date || 'upcoming dates';
      const khataTotal = Number(context.khata.total_outstanding || 0).toLocaleString('en-IN');

      if (!hasGap || gapAmt === 0) {
        if (isHindi) {
          return `Aapke store mein abhi koi funding gap nahi hai. Current cash: **₹${Number(currentCash).toLocaleString('en-IN')}**. Aapki working capital sthiti surakshit hai.`;
        }
        return `Based on your live cash forecast, your store has adequate working capital without any projected funding gap (Current Cash: **₹${Number(currentCash).toLocaleString('en-IN')}**).`;
      }

      if (isHindi) {
        return `Aapke forecast ke anusar **${targetDt}** tak lagbhag **₹${Number(gapAmt).toLocaleString('en-IN')}** ki kami (cash gap) ho sakti hai.\n\nExternal financing se pehle ye internal upaay dekhein:\n1. **Khata Vasooli**: Grahakon par kul ₹${khataTotal} udhaar baki hai, pehle ise mangne par dhyan dein.\n2. **Payment Timing**: Kya supplier payment ya bills ko 2-3 din aage badhaya ja sakta hai.\n\nAgar gap bana rehta hai, toh aap Working Capital Trade Credit ya Bank Micro-Business Overdraft jaise vikalpo par vichar kar sakte hain. KiranaPilot kisi lender ki guarantee ya recommendation nahi deta.`;
      }

      return `Based on your cash flow forecast, you face a projected cash gap of approximately **₹${Number(gapAmt).toLocaleString('en-IN')}** for ${targetDt}.\n\nBefore considering external funding, we recommend these internal options:\n1. **Pending Khata Collections**: You have ₹${khataTotal} in outstanding receivables across customers.\n2. **Payment Timing**: Check if scheduled supplier invoices can be split or adjusted by a few days.\n\nIf a gap remains, you can review general options like distributor trade credit or bank working capital facilities. KiranaPilot does not sell loans, rank lenders, or guarantee approval.`;
    }

    case 'FINANCIAL_ALERTS': {
      const alerts = context.alerts?.alerts || [];
      const criticals = alerts.filter(a => a.priority === 'CRITICAL');
      const warnings = alerts.filter(a => a.priority === 'WARNING');
      const actionable = [...criticals, ...warnings];

      if (actionable.length === 0) {
        if (isHindi) {
          return `Aapki financial sthiti surakshit hai. Agle 7 dino mein koi cash deficit ya repayment dikkat nahi hai (Current cash: ₹${Number(currentCash).toLocaleString('en-IN')}).`;
        }
        return `Your store financials are in a healthy position. No critical deficits or immediate repayment warnings were detected (Current Cash: ₹${Number(currentCash).toLocaleString('en-IN')}).`;
      }

      const listStr = actionable.map((a, i) => {
        const icon = a.priority === 'CRITICAL' ? '🚨' : '⚠️';
        const actionItems = (a.actions || []).map(act => `  - ${act.label}: ${act.description}`).join('\n');
        return `${i + 1}. ${icon} **${a.title}**: ${a.message}\n${actionItems}`;
      }).join('\n\n');

      if (isHindi) {
        return `Aapke store mein in baaton par dhyan dene ki zaroorat hai:\n\n${listStr}`;
      }
      return `Here are the key financial situations requiring your attention:\n\n${listStr}`;
    }

    case 'CASH_BALANCE': {
      if (isHindi) {
        return `Aapke paas abhi galle (cash drawer) mein **₹${Number(currentCash).toLocaleString('en-IN')}** cash balance hai.`;
      }
      return `Your current cash drawer balance is **₹${Number(currentCash).toLocaleString('en-IN')}**.`;
    }

    case 'TODAY_SALES': {
      const { total_sales, cash_sales, credit_sales, tx_count } = context.today;
      if (isHindi) {
        return `Aaj ki kul bikri **₹${Number(total_sales).toLocaleString('en-IN')}** hui hai (₹${Number(cash_sales).toLocaleString('en-IN')} cash bikri aur ₹${Number(credit_sales).toLocaleString('en-IN')} udhaar bikri, kul ${tx_count} transactions mein).`;
      }
      return `Today's total sales are **₹${Number(total_sales).toLocaleString('en-IN')}** (₹${Number(cash_sales).toLocaleString('en-IN')} cash sales and ₹${Number(credit_sales).toLocaleString('en-IN')} credit sales across ${tx_count} transaction(s)).`;
    }

    case 'KHATA_OUTSTANDING': {
      const { total_outstanding, customers_with_due, customer_count } = context.khata;
      if (isHindi) {
        return `Grahakon par kul baki udhaar (Khata outstanding) **₹${Number(total_outstanding).toLocaleString('en-IN')}** hai (${customers_with_due} grahakon se lene hain).`;
      }
      return `Total Khata outstanding receivable from customers is **₹${Number(total_outstanding).toLocaleString('en-IN')}** across ${customers_with_due} customer(s) with pending balances.`;
    }

    case 'AMBIGUOUS_CUSTOMER': {
      const entity = context.customer_entity;
      const candidates = entity?.matches || entity?.candidates || [];
      const queryName = entity?.standardized_name || entity?.query_name || 'this customer';
      if (candidates.length === 0) {
        return isHindi
          ? `Mujhe '${queryName}' naam ka koi grahak nahi mila. Kya aap naya grahak jodna chahte hain?`
          : `I could not find '${queryName}' in your customers. Would you like to create a new customer?`;
      }
      const listStr = candidates.map((c, i) => `• **${c.name}** (Phone: ${c.phone || 'N/A'}, Baki: ₹${Number(c.outstanding).toLocaleString('en-IN')})`).join('\n');
      if (isHindi) {
        return `Aapke store mein **${queryName}** naam ke **${candidates.length}** grahak mile hain. Aap kis grahak ke baare mein pooch rahe hain?\n\n${listStr}`;
      }
      return `I found **${candidates.length}** customers matching **${queryName}**. Which customer do you mean?\n\n${listStr}`;
    }

    case 'CUSTOMER_DETAILS': {
      if (context.target_customer) {
        const tc = context.target_customer;
        if (isHindi) {
          return `**${tc.name}** ka Khata vivaran:\n- Baki Udhaar (Outstanding): **₹${Number(tc.outstanding).toLocaleString('en-IN')}**\n- Kul Udhaar (Total Credit): ₹${Number(tc.total_credit || 0).toLocaleString('en-IN')}\n- Chhukta kiya (Total Repaid): ₹${Number(tc.total_repaid || 0).toLocaleString('en-IN')}\n- Phone: ${tc.phone || 'N/A'}\n- Pichhla transaction: ${tc.last_transaction_date || 'N/A'}`;
        }
        return `**${tc.name}** Khata Details:\n- Outstanding Balance: **₹${Number(tc.outstanding).toLocaleString('en-IN')}**\n- Lifetime Credit: ₹${Number(tc.total_credit || 0).toLocaleString('en-IN')}\n- Total Repaid: ₹${Number(tc.total_repaid || 0).toLocaleString('en-IN')}\n- Phone: ${tc.phone || 'N/A'}\n- Last Transaction Date: ${tc.last_transaction_date || 'N/A'}`;
      }

      const top = context.khata.top_debtors;
      if (top.length === 0) {
        return isHindi ? 'Kisi bhi grahak ka koi udhaar baki nahi hai.' : 'No customers currently have outstanding Khata balances.';
      }
      const listStr = top.map((c, i) => `${i + 1}. **${c.name}**: ₹${Number(c.outstanding).toLocaleString('en-IN')} (Repayment rate: ${c.repayment_rate}%)`).join('\n');
      if (isHindi) {
        return `Sabse zyada baki udhaar wale grahak:\n\n${listStr}`;
      }
      return `Here are the customers with the highest outstanding Khata balances:\n\n${listStr}`;
    }

    case 'CUSTOMER_REPAYMENT': {
      const att = context.khata.attention_customers;
      if (att.length === 0) {
        return isHindi
          ? 'Sabhi grahak samay par payment kar rahe hain. Kisi grahak par repayment attention ki zaroorat nahi hai.'
          : 'All customers are maintaining regular repayment schedules. No accounts currently require repayment attention.';
      }
      const listStr = att.map((c, i) => `${i + 1}. **${c.name}**: ₹${Number(c.outstanding).toLocaleString('en-IN')} pending (${c.reason || c.repayment_rate + '% repayment rate'})`).join('\n');
      if (isHindi) {
        return `In grahakon ka repayment pattern dhyan dene yogya hai:\n\n${listStr}\n\nUnse agla udhaar dene se pehle purana hisab mangna sahi rahega.`;
      }
      return `The following customers require repayment attention:\n\n${listStr}\n\nWe recommend reviewing their outstanding balance before extending additional credit.`;
    }

    case 'URGENT_PAYMENT': {
      const { amount, target_date, relative_label, projected_remaining, cash_gap, is_affordable, day_opening, day_inflows, day_outflows } = context.scenario;
      const amtStr = `₹${Number(amount || 0).toLocaleString('en-IN')}`;
      const gapStr = `₹${Number(cash_gap || 0).toLocaleString('en-IN')}`;
      const remStr = `₹${Number(projected_remaining || 0).toLocaleString('en-IN')}`;

      if (is_affordable) {
        if (isHindi) {
          return `Haan, aap **${amtStr}** ka payment kar sakte hain. Aapke paas abhi ₹${Number(currentCash).toLocaleString('en-IN')} cash hai. Payment ke baad aapke paas anumanit **${remStr}** cash bachega.`;
        }
        return `Yes, you can afford to pay **${amtStr}** for ${relative_label || target_date}. You currently have ₹${Number(currentCash).toLocaleString('en-IN')} in cash. After this payment, your projected remaining cash balance will be approximately **${remStr}**.`;
      } else {
        if (isHindi) {
          return `Aapke paas abhi **₹${Number(currentCash).toLocaleString('en-IN')}** cash hai. **${amtStr}** ka payment karne par lagbhag **${gapStr}** ki kami (cash gap) pad sakti hai.\n\nAap in upaayo par vichar kar sakte hain:\n1. Attention wale grahakon se pending Khata vasooli karein (Kul baki: ₹${Number(context.khata.total_outstanding).toLocaleString('en-IN')})\n2. Kya is payment ko do hisso mein ya kuch din aage badhaya ja sakta hai.`;
        }
        return `You currently have **₹${Number(currentCash).toLocaleString('en-IN')}** in cash. A payment of **${amtStr}** on ${relative_label || target_date} would create a projected cash gap of approximately **${gapStr}** (Projected closing: ${remStr}).\n\nSuggested actions:\n1. Follow up with customers on pending Khata collections (Total due: ₹${Number(context.khata.total_outstanding).toLocaleString('en-IN')}).\n2. Check if this payment can be split or scheduled across multiple days.`;
      }
    }

    case 'CASH_FORECAST': {
      if (context.forecast.daily.length === 0) {
        return `Your current cash balance is ₹${Number(currentCash).toLocaleString('en-IN')}.`;
      }
      const day1 = context.forecast.daily[0];
      if (isHindi) {
        return `Kal (${day1.date}) aapka anumanit closing cash balance lagbhag **₹${Number(day1.closing_cash).toLocaleString('en-IN')}** hoga (Expected inflow: ₹${Number(day1.expected_inflow).toLocaleString('en-IN')}, Expected outflow: ₹${Number(day1.expected_outflow).toLocaleString('en-IN')}).`;
      }
      return `For tomorrow (${day1.date}), your projected closing cash balance is approximately **₹${Number(day1.closing_cash).toLocaleString('en-IN')}** (Expected inflows: ₹${Number(day1.expected_inflow).toLocaleString('en-IN')}, Scheduled outflows: ₹${Number(day1.expected_outflow).toLocaleString('en-IN')}, Status: ${day1.status}).`;
    }

    case 'CASH_SHORTAGE': {
      const shortages = context.forecast.shortage_days;
      if (shortages.length === 0) {
        return isHindi
          ? `Agle 7 dino mein koi cash shortage ya deficit ka anuman nahi hai. Sabhi din balance surakshit limit mein hai.`
          : `No cash shortage is projected over the next 7 days. Your projected cash balance remains above the safety threshold.`;
      }
      const firstShort = shortages[0];
      if (isHindi) {
        return `Aapke cash flow mein **${firstShort.date} (${firstShort.day_name})** ko kami ka anuman hai (Projected cash: ₹${Number(firstShort.closing_cash).toLocaleString('en-IN')}). Mukhya karan aane wale kharche aur bills hain (Outflow: ₹${Number(firstShort.expected_outflow).toLocaleString('en-IN')}).`;
      }
      return `A cash ${firstShort.status.toLowerCase()} is projected on **${firstShort.date} (${firstShort.day_name})** with estimated closing cash of **₹${Number(firstShort.closing_cash).toLocaleString('en-IN')}**. This is primarily driven by scheduled outflows of ₹${Number(firstShort.expected_outflow).toLocaleString('en-IN')} exceeding daily inflows.`;
    }

    case 'UPCOMING_PAYMENTS': {
      const exp = context.upcoming_expenses;
      if (exp.length === 0) {
        return isHindi ? 'Agle kuch dino mein koi scheduled payment ya bill pending nahi hai.' : 'There are no scheduled upcoming payments or supplier bills pending in the system.';
      }
      const listStr = exp.map((e, i) => `${i + 1}. **${e.description}**: ₹${Number(e.amount).toLocaleString('en-IN')} (Due date: ${e.due_date})`).join('\n');
      if (isHindi) {
        return `Aane wale scheduled payments:\n\n${listStr}`;
      }
      return `Here are your upcoming scheduled payments and supplier invoices:\n\n${listStr}`;
    }

    default: {
      if (isHindi) {
        return `Aapke paas abhi **₹${Number(currentCash).toLocaleString('en-IN')}** cash hai aur grahakon par **₹${Number(context.khata.total_outstanding).toLocaleString('en-IN')}** udhaar baki hai. Aap mujhse cash forecast, bikri, ya kisi payment scenario ke baare mein pooch sakte hain.`;
      }
      return `You currently have **₹${Number(currentCash).toLocaleString('en-IN')}** in cash and **₹${Number(context.khata.total_outstanding).toLocaleString('en-IN')}** in outstanding Khata receivables. You can ask me about cash forecasts, today's sales, large payment simulations, or customer repayment intelligence.`;
    }
  }
}

/**
 * Main processor for merchant chat queries with AI reasoning and deterministic fallback.
 *
 * @param {number} merchantId
 * @param {string} message User message
 * @param {Array<{ role: string, content: string }>} [conversationHistory]
 * @returns {Promise<{
 *   success: boolean,
 *   answer: string,
 *   intent: string,
 *   data_cards: Array<any>,
 *   generated_at: string,
 *   source: string
 * }>}
 */
export async function processAgentChat(merchantId = 1, message = '', conversationHistory = []) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw Object.assign(new Error('Chat message cannot be empty.'), {
      code: 'EMPTY_MESSAGE',
      statusCode: 400
    });
  }

  const cleanMessage = message.trim();

  // 1. Build live structured financial context from MySQL
  const context = await buildFinancialAgentContext(merchantId, cleanMessage);
  const dataCards = buildSupportingDataCards(context);
  const generatedAt = new Date().toISOString();

  const apiKey = process.env.SARVAM_API_KEY;

  // If Sarvam API key is not configured, immediately use deterministic fallback
  if (!apiKey) {
    const fallbackAnswer = generateDeterministicFallback(context, cleanMessage);
    return {
      success: true,
      answer: fallbackAnswer,
      intent: context.intent,
      data_cards: dataCards,
      generated_at: generatedAt,
      source: 'DETERMINISTIC_ENGINE'
    };
  }

  // 2. Call Sarvam AI LLM
  try {
    const systemPrompt = buildSystemPrompt(context);

    // Build message history array (limit to last 4 messages for token efficiency)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-4).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      })),
      { role: 'user', content: cleanMessage }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(SARVAM_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages,
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const aiReply = data?.choices?.[0]?.message?.content?.trim();
      if (aiReply) {
        return {
          success: true,
          answer: aiReply,
          intent: context.intent,
          data_cards: dataCards,
          target_customer: context.target_customer || null,
          generated_at: generatedAt,
          source: 'SARVAM_AI'
        };
      }
    }

    console.warn('[financialAgent] Sarvam response not OK or empty, falling back to deterministic engine');
  } catch (err) {
    console.warn('[financialAgent] AI call failed or timed out:', err.message, 'Using deterministic fallback.');
  }

  // 3. Fallback to deterministic calculation
  const fallbackAnswer = generateDeterministicFallback(context, cleanMessage);
  return {
    success: true,
    answer: fallbackAnswer,
    intent: context.intent,
    data_cards: dataCards,
    target_customer: context.target_customer || null,
    generated_at: generatedAt,
    source: 'DETERMINISTIC_FALLBACK'
  };
}
