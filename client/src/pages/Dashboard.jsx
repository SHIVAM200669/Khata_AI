import React, { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  Wallet,
  Users,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Clock,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Mic,
  Plus,
  Bot,
  Layers,
  ShieldCheck,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import api from '../utils/api.js';
import { Link } from 'react-router-dom';
import AlertsCenter from '../components/AlertsCenter.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { merchant, user } = useAuth();

  const storeName = merchant?.name || user?.displayName || 'Kirana Store';

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/api/dashboard/summary');
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.message || 'Failed to load dashboard data.');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.response?.data?.message || 'Could not connect to backend server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();

    const handleUpdate = () => fetchSummary();
    window.addEventListener('kirana:financial-update', handleUpdate);
    return () => window.removeEventListener('kirana:financial-update', handleUpdate);
  }, [fetchSummary]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });

  return (
    <div className="space-y-6">
      {/* Top Greeting & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {getGreeting()}, <span className="text-[#A3E635]">{storeName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#8E9CAE] mt-1">
            Real-time shop liquidity, customer Khata recovery, and 7-day risk forecasting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchSummary}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111622] hover:bg-[#161C2A] text-white border border-[#1E2638] text-xs font-semibold transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3E635] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Live Data</span>
          </button>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111622] text-slate-300 border border-[#1E2638] text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#8E9CAE]" />
            <span>Today, {todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO CARD: TOTAL AVAILABLE CASH BALANCE                                    */}
      {/* ========================================================================= */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E9CAE]">
              TOTAL AVAILABLE CASH BALANCE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Live Drawer
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3.5">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-mono tracking-tight">
              ₹{Number(data?.current_cash || 0).toLocaleString('en-IN')}
            </span>

            {data?.today_sales > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-[#162215] text-[#A3E635] border border-[#2B4328]">
                <span>↗</span>
                <span>+₹{Number(data.today_sales).toLocaleString('en-IN')} Today</span>
              </span>
            )}
          </div>

          <p className="text-xs text-[#8E9CAE] mt-2 font-medium">
            {storeName} &bull; Khata receivables due: <span className="text-white font-mono font-bold">₹{Number(data?.total_outstanding_khata || 0).toLocaleString('en-IN')}</span>
          </p>
        </div>

        {/* Action Buttons Row matching reference */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/transactions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-[#091002] font-black text-xs transition-all shadow-sm active:scale-95"
          >
            <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Record Sale</span>
          </Link>

          <Link
            to="/forecast"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#161C2C] hover:bg-[#1E273D] text-white border border-[#242F46] text-xs font-bold transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-[#8E9CAE]" />
            <span>Add Bill</span>
          </Link>

          <Link
            to="/customers"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#161C2C] hover:bg-[#1E273D] text-white border border-[#242F46] text-xs font-bold transition-all active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#8E9CAE]" />
            <span>Khata Book</span>
          </Link>

          <Link
            to="/copilot"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#161C2C] hover:bg-[#1E273D] text-white border border-[#242F46] text-xs font-bold transition-all active:scale-95"
          >
            <Bot className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>Ask Copilot</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 FINTECH METRIC CARDS ROW                                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Counter Sales */}
        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE]">
                TODAY'S COUNTER SALES
              </span>
              <div className="w-8 h-8 rounded-full bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
                <IndianRupee className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              ₹{Number(data?.today_sales || 0).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-[#1C2436]">
            <span className="text-[11px] text-[#8E9CAE] truncate max-w-[110px]">
              Counter cash sales
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              {data?.today_sales > 0 ? '+ Active Today' : '₹0 Today'}
            </span>
          </div>
        </div>

        {/* Card 2: Current Cash Register */}
        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE]">
                CURRENT CASH REGISTER
              </span>
              <div className="w-8 h-8 rounded-full bg-[#101D2E] border border-[#1E3A5F] flex items-center justify-center text-[#38BDF8]">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>

            <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              ₹{Number(data?.current_cash || 0).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-[#1C2436]">
            <span className="text-[11px] text-[#8E9CAE] truncate max-w-[110px]">
              {storeName}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Drawer Liquidity
            </span>
          </div>
        </div>

        {/* Card 3: Khata Outstanding */}
        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE]">
                KHATA OUTSTANDING
              </span>
              <div className="w-8 h-8 rounded-full bg-[#241A0E] border border-[#483318] flex items-center justify-center text-[#FBBF24]">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>

            <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              ₹{Number(data?.total_outstanding_khata || 0).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-[#1C2436]">
            <span className="text-[11px] text-[#8E9CAE] truncate max-w-[110px]">
              {data?.customer_count || 0} total khata acc...
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#241A0E] text-[#FBBF24] border border-[#483318]">
              {data?.customers_with_outstanding_count || 0} customer(s) due
            </span>
          </div>
        </div>

        {/* Card 4: 7-Day Projected Cash */}
        <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE]">
                7-DAY PROJECTED CASH
              </span>
              <div className="w-8 h-8 rounded-full bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              ₹{Number(data?.forecast_summary?.lowest_projected_cash || 0).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-[#1C2436]">
            <span className="text-[11px] text-[#8E9CAE] truncate max-w-[120px]">
              Lowest: {formatDate(data?.forecast_summary?.lowest_cash_date)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              data?.forecast_summary?.overall_status === 'HEALTHY'
                ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                : data?.forecast_summary?.overall_status === 'SHORTAGE'
                ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
            }`}>
              {data?.forecast_summary?.overall_status || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COPILOT SMART AGENT BANNER                                                */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] shrink-0">
            <Bot className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">KhataAI Copilot</span>
              <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
                SMART AGENT
              </span>
            </div>
            <p className="text-xs text-[#8E9CAE] mt-0.5 leading-relaxed">
              Ask questions in plain English or Hindi: "Can I afford ₹50,000 distributor payment?" &bull; "Who has overdue Khata?"
            </p>
          </div>
        </div>

        <Link
          to="/copilot"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-xs transition-all shadow-sm self-start sm:self-auto shrink-0 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch AI Copilot &rarr;</span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* FINANCIAL ALERTS CENTER                                                   */}
      {/* ========================================================================= */}
      <AlertsCenter />

      {/* ========================================================================= */}
      {/* RECENT TRANSACTIONS LEDGER                                                */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Recent Transactions</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161C2A] text-slate-300 border border-[#222C40]">
                {data?.total_transactions_count || 0}
              </span>
            </h2>
            <p className="text-xs text-[#8E9CAE] mt-0.5">Live store transactions recorded via Voice, OCR, and Register</p>
          </div>

          <Link
            to="/transactions"
            className="text-xs font-bold text-[#A3E635] hover:underline inline-flex items-center gap-1"
          >
            <span>Full Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data?.recent_transactions?.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#0B0E14] border border-[#1C2436] text-[#8E9CAE] text-xs">
            No transactions recorded yet today. Click Record Sale to add a transaction.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.recent_transactions?.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1C2436] flex items-center justify-between hover:border-[#2A364F] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#161C2C] border border-[#242F46] flex items-center justify-center text-xs font-bold text-slate-300">
                    {tx.source === 'VOICE' ? (
                      <Mic className="w-4 h-4 text-[#A3E635]" />
                    ) : tx.source === 'OCR' ? (
                      <FileSpreadsheet className="w-4 h-4 text-[#38BDF8]" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#8E9CAE]" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {tx.customer_name || (tx.transaction_type === 'EXPENSE' ? 'Shop Expense' : 'Counter Cash Sale')}
                    </p>
                    <p className="text-[11px] text-[#8E9CAE]">
                      {tx.description || tx.transaction_type} &bull; {formatDate(tx.transaction_date)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-black font-mono ${
                    tx.transaction_type === 'CASH_SALE' || tx.transaction_type === 'KHATA_REPAYMENT'
                      ? 'text-[#A3E635]'
                      : tx.transaction_type === 'EXPENSE'
                      ? 'text-rose-400'
                      : 'text-[#FBBF24]'
                  }`}>
                    {tx.transaction_type === 'EXPENSE' ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                  </p>
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                    tx.transaction_type === 'CREDIT_SALE'
                      ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                      : tx.transaction_type === 'KHATA_REPAYMENT'
                      ? 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                      : tx.transaction_type === 'CASH_SALE'
                      ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}>
                    {tx.transaction_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
