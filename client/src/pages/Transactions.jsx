import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, Search, Filter, RefreshCw, Wallet, Mic, Camera, FileSpreadsheet, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import LedgerScanner from '../components/LedgerScanner.jsx';
import api from '../utils/api.js';

/** Formats a date string into readable local representation */
function formatTransactionDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const isToday = new Date().toDateString() === d.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    const dateFormatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${dateFormatted}, ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export default function Transactions() {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'ocr'
  const [transactions, setTransactions] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/transactions');
      if (res.data?.success) {
        setTransactions(res.data.transactions || []);
        setMerchant(res.data.merchant || null);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();

    const handleUpdate = () => fetchTransactions();
    window.addEventListener('kirana:financial-update', handleUpdate);
    return () => window.removeEventListener('kirana:financial-update', handleUpdate);
  }, [fetchTransactions]);

  const handleTransactionConfirmed = () => {
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      !searchTerm ||
      tx.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(tx.id).includes(searchTerm);

    const matchesFilter =
      selectedFilter === 'ALL' ||
      tx.transaction_type === selectedFilter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Balance Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Audit Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Transactions &amp; Ledger</h1>
          <p className="text-xs sm:text-sm text-[#8E9CAE] mt-0.5">
            Real-time multi-modal store collections, customer Khata credit, and supplier payouts.
          </p>
        </div>

        {/* Live Cash Balance Widget */}
        <div className="flex items-center gap-3">
          {merchant && (
            <div className="px-5 py-3 rounded-2xl bg-[#111622] border border-[#1E2638] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8E9CAE] tracking-wider block">
                  Current Cash Drawer
                </span>
                <span className="text-base font-black font-mono text-white tracking-tight">
                  ₹{Number(merchant.current_cash_balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={fetchTransactions}
            className="p-3 rounded-2xl bg-[#111622] border border-[#1E2638] hover:bg-[#161C2A] text-slate-300 hover:text-white transition-all shadow-sm"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 text-[#A3E635] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Input Mode Selector Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#111622] border border-[#1E2638] rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('voice')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'voice'
              ? 'bg-[#A3E635] text-[#091002] shadow-sm'
              : 'text-[#8E9CAE] hover:text-white hover:bg-[#161C2A]'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Voice Transaction Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('ocr')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ocr'
              ? 'bg-[#A3E635] text-[#091002] shadow-sm'
              : 'text-[#8E9CAE] hover:text-white hover:bg-[#161C2A]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Scan Handwritten Ledger</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      <div>
        {activeTab === 'voice' ? (
          <VoiceRecorder onTransactionConfirmed={handleTransactionConfirmed} />
        ) : (
          <LedgerScanner />
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#5A687D] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, description..."
            className="w-full pl-11 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-xs sm:text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#2E3B54] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Records' },
            { key: 'CASH_SALE', label: 'Cash Sales' },
            { key: 'CREDIT_SALE', label: 'Khata Credit' },
            { key: 'KHATA_REPAYMENT', label: 'Repayments' },
            { key: 'EXPENSE', label: 'Expenses' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedFilter === f.key
                  ? 'bg-[#A3E635] text-[#091002]'
                  : 'bg-[#0B0E14] text-[#8E9CAE] hover:text-white border border-[#1E2638]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl bg-[#111622] border border-[#1E2638] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#0D121C] text-[11px] uppercase font-bold text-[#8E9CAE] border-b border-[#1C2436] tracking-wider">
              <tr>
                <th className="px-6 py-4">Ref ID</th>
                <th className="px-6 py-4">Date &amp; Time</th>
                <th className="px-6 py-4">Party / Customer</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C2436]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[#8E9CAE] text-xs">
                    {loading ? 'Loading transactions from MySQL…' : 'No transactions found matching your criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isExpense = tx.transaction_type === 'EXPENSE';
                  const isCash = tx.transaction_type === 'CASH_SALE';
                  const isRepayment = tx.transaction_type === 'KHATA_REPAYMENT';
                  const isCredit = tx.transaction_type === 'CREDIT_SALE';

                  return (
                    <tr key={tx.id} className="hover:bg-[#141A28] transition-colors">
                      <td className="px-6 py-4.5 font-mono text-xs text-[#8E9CAE] font-semibold">
                        TX-{String(tx.id).padStart(4, '0')}
                      </td>
                      <td className="px-6 py-4.5 text-xs text-[#8E9CAE] font-mono">
                        {formatTransactionDateTime(tx.transaction_date || tx.created_at)}
                      </td>
                      <td className="px-6 py-4.5 font-bold text-white">
                        {tx.customer_name || (tx.transaction_type === 'EXPENSE' ? 'Store Expense' : 'Walk-in Customer')}
                        {tx.description && tx.description !== 'Voice recorded transaction' && (
                          <span className="block text-[11px] font-normal text-[#8E9CAE] truncate max-w-xs mt-0.5">
                            {tx.description}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-xs">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCash
                            ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                            : isCredit
                            ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                            : isRepayment
                            ? 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {isCash && 'Cash Sale'}
                          {isCredit && 'Khata Credit'}
                          {isRepayment && 'Repayment'}
                          {isExpense && 'Expense'}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0B0E14] text-[#8E9CAE] font-mono text-[10px] border border-[#1E2638] font-semibold">
                          {tx.source}
                        </span>
                      </td>
                      <td className={`px-6 py-4.5 text-right font-black font-mono text-sm sm:text-base tracking-tight ${
                        isExpense ? 'text-rose-400' : isCredit ? 'text-[#FBBF24]' : 'text-[#A3E635]'
                      }`}>
                        {isExpense ? `- ₹${Number(tx.amount).toLocaleString('en-IN')}` : `+ ₹${Number(tx.amount).toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
