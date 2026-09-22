import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Calendar,
  User,
  DollarSign,
  Tag,
  Trash2,
  Edit2,
  Plus,
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import api from '../utils/api.js';
import PreCreditWarningModal from './PreCreditWarningModal';
import CustomerResolutionModal from './CustomerResolutionModal';

const TRANSACTION_TYPES = [
  { value: 'CREDIT_SALE', label: 'Credit Sale (Udhaar)', color: 'amber' },
  { value: 'CASH_SALE', label: 'Cash Sale (Nagad)', color: 'emerald' },
  { value: 'KHATA_REPAYMENT', label: 'Khata Repayment (Jama)', color: 'blue' },
  { value: 'EXPENSE', label: 'Expense / Kharcha', color: 'rose' }
];

export default function OcrTransactionReview({ ocrText, onTransactionsSaved }) {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [summary, setSummary] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState('');

  // Module 8 Part 2: Pre-Credit Advisory Warning State
  const [preCreditWarningData, setPreCreditWarningData] = useState(null);
  const [showPreCreditModal, setShowPreCreditModal] = useState(false);
  const [pendingConfirmOnlySelected, setPendingConfirmOnlySelected] = useState(true);

  // Customer Entity Resolution State
  const [resolutionData, setResolutionData] = useState(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [pendingResolutionRowId, setPendingResolutionRowId] = useState(null);

  // Automatically parse or provide parse trigger
  const handleParseTransactions = async () => {
    if (!ocrText || !ocrText.trim()) {
      setParseError('No OCR text available to parse. Please scan a ledger first.');
      return;
    }

    console.log(`[OcrTransactionReview] Initiating parse. Text length: ${ocrText.length}. Preview: "${ocrText.slice(0, 100).replace(/\n/g, ' ')}"`);
    setIsParsing(true);
    setParseError('');
    setSaveSuccess(null);
    setSaveError('');

    try {
      const res = await api.post('/api/transactions/parse-ocr', {
        text: ocrText
      });

      console.log('[OcrTransactionReview] API response status:', res.status, 'transactions count:', res.data?.transactions?.length);

      if (res.data?.success && Array.isArray(res.data?.transactions)) {
        const txs = res.data.transactions;
        setTransactions(txs);
        setSummary(res.data.summary || null);
        // Default select all valid items
        setSelectedIds(new Set(txs.map(t => t.temp_id)));
      } else {
        setParseError(res.data?.message || 'Could not parse structured transactions from this text.');
      }
    } catch (err) {
      console.error('[OcrTransactionReview] Parsing Error:', err);
      const serverMsg = err.response?.data?.message;
      const details = err.response?.data?.details ? ` (Details: ${err.response.data.details})` : '';
      const msg = serverMsg ? `${serverMsg}${details}` : 'Failed to extract transactions from OCR text. Please ensure text contains transaction rows.';
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  // Recalculate summary metrics on manual user edits
  useEffect(() => {
    if (!transactions.length) return;

    let creditSum = 0;
    let cashSum = 0;
    let repaymentSum = 0;
    let expenseSum = 0;
    let needsReviewCount = 0;
    let ambiguousCount = 0;

    transactions.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      if (item.transaction_type === 'CREDIT_SALE') creditSum += amt;
      else if (item.transaction_type === 'CASH_SALE') cashSum += amt;
      else if (item.transaction_type === 'KHATA_REPAYMENT') repaymentSum += amt;
      else if (item.transaction_type === 'EXPENSE') expenseSum += amt;

      if (item.needs_review) needsReviewCount++;
      if (item.is_ambiguous) ambiguousCount++;
    });

    setSummary({
      total_count: transactions.length,
      credit_sales_sum: creditSum,
      cash_sales_sum: cashSum,
      repayments_sum: repaymentSum,
      expenses_sum: expenseSum,
      needs_review_count: needsReviewCount,
      ambiguous_count: ambiguousCount
    });
  }, [transactions]);

  // Toggle single item selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.temp_id)));
    }
  };

  // Update a single draft row field
  const updateDraft = (id, field, value) => {
    setTransactions(prev =>
      prev.map(t => {
        if (t.temp_id !== id) return t;

        const updated = { ...t, [field]: value };

        // If user resolves ambiguous type
        if (field === 'transaction_type' && value) {
          updated.is_ambiguous = false;
        }

        // Re-evaluate needs review if amount and date are resolved
        if (field === 'amount' && parseFloat(value) > 0 && updated.transaction_date) {
          updated.needs_review = false;
          updated.review_reason = null;
        }
        if (field === 'transaction_date' && value && parseFloat(updated.amount) > 0) {
          updated.needs_review = false;
          updated.review_reason = null;
        }

        return updated;
      })
    );
  };

  // Delete row
  const deleteDraft = (id) => {
    setTransactions(prev => prev.filter(t => t.temp_id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Add manual empty row
  const addManualDraft = () => {
    const newId = `ocr_tx_manual_${Date.now()}`;
    const newRow = {
      temp_id: newId,
      transaction_date: new Date().toISOString().slice(0, 10),
      customer_name: '',
      amount: 0,
      transaction_type: 'CREDIT_SALE',
      description: 'Manual ledger entry',
      is_ambiguous: false,
      possible_types: ['CREDIT_SALE', 'KHATA_REPAYMENT'],
      needs_review: true,
      review_reason: 'Newly added row — please verify details',
      source: 'OCR',
      is_duplicate: false
    };

    setTransactions(prev => [newRow, ...prev]);
    setSelectedIds(prev => new Set(prev).add(newId));
  };

    // Resolution Modal Handlers
  const handleSelectResolvedCustomer = (cand) => {
    if (pendingResolutionRowId === null) return;
    setTransactions(prev => prev.map(t => {
      if (t.temp_id === pendingResolutionRowId) {
        return { ...t, customer_id: cand.id, customer_name: cand.name, is_ambiguous: false };
      }
      return t;
    }));
    setShowResolutionModal(false);
    setResolutionData(null);
    setPendingResolutionRowId(null);
    // Continue saving
    setTimeout(() => handleConfirmTransactions(pendingConfirmOnlySelected, true), 50);
  };

  const handleCreateNewCustomerConfirmed = (standardizedName) => {
    if (pendingResolutionRowId === null) return;
    setTransactions(prev => prev.map(t => {
      if (t.temp_id === pendingResolutionRowId) {
        return {
          ...t,
          customer_name: standardizedName || t.customer_name,
          confirm_create_customer: true,
          is_ambiguous: false
        };
      }
      return t;
    }));
    setShowResolutionModal(false);
    setResolutionData(null);
    setPendingResolutionRowId(null);
    // Continue saving
    setTimeout(() => handleConfirmTransactions(pendingConfirmOnlySelected, true), 50);
  };

  // Save selected transactions to MySQL
  const handleConfirmTransactions = async (onlySelected = true, forceBypass = false) => {
    const targets = transactions.filter(t => (onlySelected ? selectedIds.has(t.temp_id) : true));

    if (targets.length === 0) {
      setSaveError('Please select at least one transaction to confirm.');
      return;
    }

    // Client-side pre-validation
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t.transaction_type) {
        setSaveError(`Row #${i + 1} is missing a transaction type. Please select whether it is Credit Sale, Repayment, Cash, or Expense.`);
        return;
      }
      if (parseFloat(t.amount) <= 0 || isNaN(parseFloat(t.amount))) {
        setSaveError(`Row #${i + 1} has an invalid amount (₹${t.amount}).`);
        return;
      }
      if ((t.transaction_type === 'CREDIT_SALE' || t.transaction_type === 'KHATA_REPAYMENT') && !t.customer_name?.trim()) {
        setSaveError(`Row #${i + 1} (${t.transaction_type}) requires a customer name.`);
        return;
      }
    }

    // Customer Entity Resolution Check (Module Safety Rule)
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const needsCust = t.transaction_type === 'CREDIT_SALE' || t.transaction_type === 'KHATA_REPAYMENT' || Boolean(t.customer_name?.trim());
      if (needsCust && t.customer_name?.trim() && !t.customer_id && !t.confirm_create_customer) {
        try {
          const resRes = await api.post('/api/customers/resolve-entity', { name: t.customer_name.trim() });
          if (resRes.data?.success) {
            if (resRes.data.status === 'AMBIGUOUS_MATCH') {
              setResolutionData(resRes.data);
              setPendingResolutionRowId(t.temp_id);
              setPendingConfirmOnlySelected(onlySelected);
              setShowResolutionModal(true);
              return; // PAUSE transaction ONLY when multiple candidates match
            } else if (resRes.data.status === 'EXACT_MATCH' && resRes.data.customer) {
              t.customer_id = resRes.data.customer.id;
              t.customer_name = resRes.data.customer.name;
            }
          }
        } catch (resErr) {
          console.warn('[OcrTransactionReview] Customer resolve check error:', resErr.message);
        }
      }
    }

    // Module 8 Part 2: Pre-Credit Check for OCR Credit Sales
    if (!forceBypass) {
      const creditTarget = targets.find(t => t.transaction_type === 'CREDIT_SALE' && t.customer_name?.trim());
      if (creditTarget) {
        try {
          const preRes = await api.post('/api/customers/pre-credit-check', {
            customer_name: creditTarget.customer_name.trim(),
            amount: parseFloat(creditTarget.amount) || 0
          });

          if (preRes.data?.show_warning) {
            setPreCreditWarningData(preRes.data);
            setPendingConfirmOnlySelected(onlySelected);
            setShowPreCreditModal(true);
            return;
          }
        } catch (preErr) {
          console.warn('[OcrTransactionReview] Pre-credit check warning:', preErr.message);
        }
      }
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(null);

    try {
      const payload = {
        transactions: targets.map(t => ({
          customer_id: t.customer_id || undefined,
          confirm_create_customer: Boolean(t.confirm_create_customer),
          transaction_date: t.transaction_date,
          customer_name: t.customer_name,
          amount: parseFloat(t.amount),
          transaction_type: t.transaction_type,
          description: t.description,
          source: 'OCR'
        }))
      };

      const res = await api.post('/api/transactions/confirm', payload);

      if (res.data?.success) {
        setSaveSuccess({
          count: res.data.saved_transactions?.length || targets.length,
          saved: res.data.saved_transactions || [],
          newCashBalance: res.data.current_cash_balance
        });
        setShowPreCreditModal(false);
        setShowResolutionModal(false);

        // Remove confirmed items from draft list
        const confirmedTempIds = new Set(targets.map(t => t.temp_id));
        setTransactions(prev => prev.filter(t => !confirmedTempIds.has(t.temp_id)));
        setSelectedIds(prev => {
          const next = new Set(prev);
          confirmedTempIds.forEach(id => next.delete(id));
          return next;
        });

        if (onTransactionsSaved) {
          onTransactionsSaved(res.data);
        }

        window.dispatchEvent(new CustomEvent('kirana:financial-update', { detail: res.data }));
      } else {
        setSaveError(res.data?.message || 'Could not record transactions.');
      }
    } catch (err) {
      console.error('Save error:', err);
      const errCode = err.response?.data?.code;
      if (errCode === 'AMBIGUOUS_CUSTOMER' || errCode === 'CUSTOMER_NOT_FOUND') {
        setResolutionData(err.response?.data);
        setPendingResolutionRowId(targets[0]?.temp_id);
        setPendingConfirmOnlySelected(onlySelected);
        setShowResolutionModal(true);
      } else {
        const msg = err.response?.data?.message || 'Failed to save transactions to database.';
        setSaveError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Parse Trigger Button if not yet parsed */}
      {transactions.length === 0 && !saveSuccess && (
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Extract Structured Transactions</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Convert the raw handwritten OCR lines into structured drafts with automatic date parsing, 5OO normalization, and customer credit ledger matching.
            </p>
          </div>

          <button
            id="btn-extract-transactions"
            onClick={handleParseTransactions}
            disabled={isParsing || !ocrText}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-lg shadow-emerald-500/25"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Ledger with AI…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Parse Structured Transactions</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Parse Error Alert */}
      {parseError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Success Banner */}
      {saveSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Successfully Recorded {saveSuccess.count} Transaction(s) to MySQL!
              </h4>
              <p className="text-xs text-emerald-300/80">
                Ledger entries have been persisted. Historical records preserved today's cash balance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="text-xs text-slate-300">
              Current Register Cash Balance: <strong className="text-emerald-400 font-mono">₹{Number(saveSuccess.newCashBalance).toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Structured Review Interface */}
      {transactions.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Summary KPIs Banner */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Entries</span>
                <p className="text-lg font-extrabold text-white font-mono mt-0.5">{summary.total_count}</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <span className="text-[10px] uppercase font-bold text-amber-400">Credit Sales (Udhaar)</span>
                <p className="text-lg font-extrabold text-amber-300 font-mono mt-0.5">
                  ₹{summary.credit_sales_sum.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-emerald-400">Cash Sales (Nagad)</span>
                <p className="text-lg font-extrabold text-emerald-300 font-mono mt-0.5">
                  ₹{summary.cash_sales_sum.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <span className="text-[10px] uppercase font-bold text-blue-400">Khata Repayments</span>
                <p className="text-lg font-extrabold text-blue-300 font-mono mt-0.5">
                  ₹{summary.repayments_sum.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <span className="text-[10px] uppercase font-bold text-rose-400">Expenses / Kharcha</span>
                <p className="text-lg font-extrabold text-rose-300 font-mono mt-0.5">
                  ₹{summary.expenses_sum.toLocaleString('en-IN')}
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${summary.needs_review_count > 0 || summary.ambiguous_count > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] uppercase font-bold text-amber-400">Needs Review</span>
                <p className="text-lg font-extrabold text-amber-300 font-mono mt-0.5">
                  {summary.needs_review_count + summary.ambiguous_count}
                </p>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Select All ({selectedIds.size}/{transactions.length})</span>
              </label>

              <button
                type="button"
                onClick={addManualDraft}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-confirm-selected"
                type="button"
                onClick={() => handleConfirmTransactions(true)}
                disabled={isSaving || selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-md shadow-emerald-500/20"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to DB…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Selected ({selectedIds.size})</span>
                  </>
                )}
              </button>

              <button
                id="btn-confirm-all"
                type="button"
                onClick={() => handleConfirmTransactions(false)}
                disabled={isSaving || transactions.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-bold text-white border border-slate-700 transition-all"
              >
                <span>Confirm All ({transactions.length})</span>
              </button>
            </div>
          </div>

          {/* Save Error Alert */}
          {saveError && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Transaction Drafts List */}
          <div className="flex flex-col gap-3">
            {transactions.map((t, idx) => {
              const isSelected = selectedIds.has(t.temp_id);

              return (
                <div
                  key={t.temp_id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-slate-700 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                  } ${t.needs_review || t.is_ambiguous ? 'ring-1 ring-amber-500/30' : ''}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                    {/* Left: Checkbox + Row # + Fields */}
                    <div className="flex items-start sm:items-center gap-3 flex-1 flex-wrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(t.temp_id)}
                        className="mt-1 sm:mt-0 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                      />

                      <span className="text-[10px] font-mono text-slate-500 w-6">
                        #{idx + 1}
                      </span>

                      {/* Date Input */}
                      <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={t.transaction_date || ''}
                          onChange={(e) => updateDraft(t.temp_id, 'transaction_date', e.target.value)}
                          className="bg-transparent text-xs text-slate-200 focus:outline-none font-mono"
                          title="Transaction Date (YYYY-MM-DD)"
                        />
                      </div>

                      {/* Customer / Party Name Input */}
                      <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60 flex-1 min-w-[140px]">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={t.customer_name || ''}
                          onChange={(e) => updateDraft(t.temp_id, 'customer_name', e.target.value)}
                          placeholder={t.transaction_type === 'EXPENSE' ? 'Supplier / Payee' : 'Customer Name'}
                          className="bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none w-full font-medium"
                        />
                      </div>

                      {/* Amount Input */}
                      <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60 w-32">
                        <span className="text-xs text-emerald-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="any"
                          value={t.amount || ''}
                          onChange={(e) => updateDraft(t.temp_id, 'amount', e.target.value)}
                          placeholder="Amount"
                          className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none w-full"
                        />
                      </div>

                      {/* Description / Item Note */}
                      <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60 flex-1 min-w-[150px]">
                        <input
                          type="text"
                          value={t.description || ''}
                          onChange={(e) => updateDraft(t.temp_id, 'description', e.target.value)}
                          placeholder="Item details / Note"
                          className="bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    {/* Right: Transaction Type Selector & Actions */}
                    <div className="flex items-center gap-3 justify-between lg:justify-end">
                      {/* Type Dropdown */}
                      <select
                        value={t.transaction_type || ''}
                        onChange={(e) => updateDraft(t.temp_id, 'transaction_type', e.target.value)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors focus:outline-none ${
                          t.transaction_type === 'CREDIT_SALE'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : t.transaction_type === 'CASH_SALE'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : t.transaction_type === 'KHATA_REPAYMENT'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : t.transaction_type === 'EXPENSE'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <option value="" disabled>Select Type…</option>
                        {TRANSACTION_TYPES.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => deleteDraft(t.temp_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ambiguity Quick-Select Chips */}
                  {t.is_ambiguous && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Ambiguous entry — specify transaction intent:
                      </span>

                      <button
                        type="button"
                        onClick={() => updateDraft(t.temp_id, 'transaction_type', 'CREDIT_SALE')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold border border-amber-500/40 transition-colors"
                      >
                        Credit Sale (Udhaar diya)
                      </button>

                      <button
                        type="button"
                        onClick={() => updateDraft(t.temp_id, 'transaction_type', 'KHATA_REPAYMENT')}
                        className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-semibold border border-blue-500/40 transition-colors"
                      >
                        Khata Repayment (Wapas mila)
                      </button>

                      <button
                        type="button"
                        onClick={() => updateDraft(t.temp_id, 'transaction_type', 'CASH_SALE')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold border border-emerald-500/40 transition-colors"
                      >
                        Cash Sale (Nagad)
                      </button>
                    </div>
                  )}

                  {/* Duplicate Detection Warning (Warning only, non-blocking) */}
                  {t.is_duplicate && (
                    <div className="mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>{t.duplicate_warning || 'Possible duplicate of existing transaction in database.'}</span>
                    </div>
                  )}

                  {/* Needs Review Flag */}
                  {t.needs_review && (
                    <div className="mt-2 text-[11px] text-rose-300/90 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>Review Required: {t.review_reason || 'Please verify amount and details before confirmation.'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-Credit Advisory Warning Modal */}
      <PreCreditWarningModal
        isOpen={showPreCreditModal}
        warningData={preCreditWarningData}
        onCancel={() => setShowPreCreditModal(false)}
        onConfirm={() => {
          setShowPreCreditModal(false);
          handleConfirmTransactions(pendingConfirmOnlySelected, true);
        }}
      />

      {/* Safe Customer Entity Resolution Modal (Module Safety Rule) */}
      <CustomerResolutionModal
        isOpen={showResolutionModal}
        resolutionData={resolutionData}
        onClose={() => {
          setShowResolutionModal(false);
          setResolutionData(null);
          setPendingResolutionRowId(null);
        }}
        onSelectCustomer={handleSelectResolvedCustomer}
        onCreateNewCustomer={handleCreateNewCustomerConfirmed}
      />
    </div>
  );
}
