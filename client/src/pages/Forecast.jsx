import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Wallet,
  DollarSign,
  Plus,
  X,
  FileText,
  ShieldCheck,
  HelpCircle,
  Building2,
  Activity,
  Layers
} from 'lucide-react';
import api from '../utils/api.js';

export default function Forecast() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Expense Modal
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const fetchForecast = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/api/forecast', {
        params: { min_threshold: 5000 }
      });
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.message || 'Failed to generate cash-flow forecast.');
      }
    } catch (err) {
      console.error('Forecast fetch error:', err);
      setError(err.response?.data?.message || 'Could not connect to forecast engine.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();

    const handleUpdate = () => fetchForecast();
    window.addEventListener('kirana:financial-update', handleUpdate);
    return () => window.removeEventListener('kirana:financial-update', handleUpdate);
  }, [fetchForecast]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) {
      setExpenseError('Please enter a description and valid positive amount.');
      return;
    }

    setExpenseLoading(true);
    setExpenseError('');
    try {
      const res = await api.post('/api/expenses', {
        description: expenseDesc.trim(),
        amount: parseFloat(expenseAmount),
        due_date: expenseDate || new Date().toISOString().slice(0, 10),
        status: 'PENDING'
      });

      if (res.data?.success) {
        setIsAddExpenseOpen(false);
        setExpenseDesc('');
        setExpenseAmount('');
        setExpenseDate('');
        await fetchForecast();
        window.dispatchEvent(new CustomEvent('kirana:financial-update'));
      } else {
        setExpenseError(res.data?.message || 'Failed to record expense.');
      }
    } catch (err) {
      console.error('Expense create error:', err);
      setExpenseError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setExpenseLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  // Compute SVG chart coordinates
  const forecastList = data?.forecast || [];
  const minCash = forecastList.length > 0 ? Math.min(0, ...forecastList.map(d => d.closing_cash)) : 0;
  const maxCash = forecastList.length > 0 ? Math.max(data?.current_cash || 1000, ...forecastList.map(d => d.closing_cash)) * 1.1 : 1000;

  const points = forecastList.map((d, idx) => {
    const x = 50 + (idx * (700 / Math.max(1, forecastList.length - 1)));
    const range = maxCash - minCash || 1;
    const y = 200 - (((d.closing_cash - minCash) / range) * 160);
    return { x, y, val: d.closing_cash, date: d.formatted_date, day: d.day_name, status: d.status };
  });

  const pathD = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Liquidity Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cash-Flow Forecast &amp; Projections
          </h1>
          <p className="text-xs sm:text-sm text-[#8E9CAE] mt-0.5">
            Dynamic liquidity projection based on historical sales velocity, customer Khata repayment habits, and scheduled bills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchForecast}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#111622] hover:bg-[#161C2A] border border-[#1E2638] text-xs font-semibold text-slate-300 transition-all active:scale-95"
            title="Recalculate Forecast"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3E635] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>

          <button
            id="btn-add-scheduled-expense"
            onClick={() => setIsAddExpenseOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-xs sm:text-sm transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            <span>Add Scheduled Bill</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
            <div className="flex items-center justify-between text-[#8E9CAE] mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Current Cash Drawer</span>
              <div className="w-7 h-7 rounded-lg bg-[#0B0E14] flex items-center justify-center text-slate-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              ₹{Number(data.current_cash || 0).toLocaleString('en-IN')}
            </p>
            <span className="text-[11px] text-[#64748B] mt-1 block">Starting opening liquidity</span>
          </div>

          <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A3E635] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                7-Day Lowest Point
              </span>
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight ${
              data.lowest_projected_cash < 0
                ? 'text-rose-400'
                : data.lowest_projected_cash < data.minimum_cash_threshold
                ? 'text-[#FBBF24]'
                : 'text-[#A3E635]'
            }`}>
              {data.lowest_projected_cash < 0 ? '-' : ''}₹{Math.abs(data.lowest_projected_cash).toLocaleString('en-IN')}
            </p>
            <span className="text-[11px] text-[#8E9CAE] mt-1 block font-mono">
              Projected on {formatDate(data.lowest_cash_date)}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
            <div className="flex items-center justify-between text-[#8E9CAE] mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Model Confidence</span>
              <div className="w-7 h-7 rounded-lg bg-[#0B0E14] flex items-center justify-center text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                data.confidence === 'HIGH'
                  ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                  : 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
              }`}>
                {data.confidence} CONFIDENCE
              </span>
            </div>
            <span className="text-[11px] text-[#64748B] mt-1.5 block truncate" title={data.confidence_reason}>
              {data.confidence_reason}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-[#111622] border border-[#1E2638]">
            <div className="flex items-center justify-between text-[#8E9CAE] mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Safety Threshold</span>
              <div className="w-7 h-7 rounded-lg bg-[#0B0E14] flex items-center justify-center text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-black text-white font-mono tracking-tight">
              ₹{Number(data.minimum_cash_threshold || 5000).toLocaleString('en-IN')}
            </p>
            <span className="text-[11px] text-[#64748B] mt-1 block">Configured minimum buffer</span>
          </div>
        </div>
      )}

      {/* 7-Day Chart */}
      {data && (
        <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">7-Day Projected Cash Trajectory</h2>
              <p className="text-xs text-[#8E9CAE] mt-0.5">
                Mathematical trajectory: Daily opening cash + estimated sales + Khata collections - scheduled supplier payables.
              </p>
            </div>
            <span className="text-xs font-bold text-[#A3E635] bg-[#162215] px-3 py-1 rounded-full border border-[#2B4328] font-mono">
              Live Projected Curve
            </span>
          </div>

          <div className="w-full h-60 relative overflow-hidden bg-[#0B0E14] rounded-2xl border border-[#1E2638] p-3">
            <svg viewBox="0 0 800 220" className="w-full h-full preserve-3d">
              <line x1="40" y1="40" x2="760" y2="40" stroke="#1E2638" strokeDasharray="4 4" />
              <line x1="40" y1="100" x2="760" y2="100" stroke="#1E2638" strokeDasharray="4 4" />
              <line x1="40" y1="160" x2="760" y2="160" stroke="#1E2638" strokeDasharray="4 4" />

              {/* Safety Threshold */}
              {(() => {
                const range = maxCash - minCash || 1;
                const threshY = 200 - (((data.minimum_cash_threshold - minCash) / range) * 160);
                return (
                  <g>
                    <line x1="40" y1={threshY} x2="760" y2={threshY} stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7" />
                    <text x="765" y={threshY + 4} fill="#FBBF24" fontSize="10" fontFamily="monospace">Buffer (₹{data.minimum_cash_threshold})</text>
                  </g>
                );
              })()}

              {/* Trend Path */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={data.overall_status === 'DEFICIT' ? '#f43f5e' : data.overall_status === 'SHORTAGE' ? '#fbbf24' : '#A3E635'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5.5"
                    fill={p.val < 0 ? '#f43f5e' : p.val < data.minimum_cash_threshold ? '#fbbf24' : '#A3E635'}
                    stroke="#0B0E14"
                    strokeWidth="2.5"
                  />
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    ₹{Math.round(p.val).toLocaleString('en-IN')}
                  </text>
                  <text
                    x={p.x}
                    y="215"
                    textAnchor="middle"
                    fill="#8E9CAE"
                    fontSize="10"
                    fontFamily="sans-serif"
                  >
                    {p.date} ({p.day.slice(0, 3)})
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Daily Breakdown Table */}
      {data && (
        <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Daily Cash-Flow Breakdown</h2>
            <p className="text-xs text-[#8E9CAE] mt-0.5">Day-by-day projected inflows, planned supplier payments, and closing balances.</p>
          </div>

          <div className="rounded-2xl border border-[#1E2638] overflow-x-auto bg-[#0B0E14]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111622] text-[#8E9CAE] text-[11px] uppercase tracking-wider border-b border-[#1E2638]">
                <tr>
                  <th className="py-3 px-4">Date / Day</th>
                  <th className="py-3 px-4 text-right">Opening Cash</th>
                  <th className="py-3 px-4 text-right text-[#A3E635]">Expected Inflow</th>
                  <th className="py-3 px-4 text-right text-rose-400">Expected Outflow</th>
                  <th className="py-3 px-4 text-right">Closing Projected</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2436] font-medium">
                {data.forecast.map((d, idx) => (
                  <tr key={idx} className="hover:bg-[#141A28]">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white block">{d.formatted_date}</span>
                      <span className="text-[11px] text-[#8E9CAE] font-mono">{d.day_name}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      ₹{Number(d.opening_cash).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[#A3E635]">
                      +₹{Number(d.expected_inflow).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                      -₹{Number(d.expected_outflow).toLocaleString('en-IN')}
                    </td>

                    <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                      d.closing_cash < 0
                        ? 'text-rose-400'
                        : d.closing_cash < data.minimum_cash_threshold
                        ? 'text-[#FBBF24]'
                        : 'text-white'
                    }`}>
                      {d.closing_cash < 0 ? '-' : ''}₹{Math.abs(d.closing_cash).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        d.status === 'HEALTHY'
                          ? 'bg-[#162215] text-[#A3E635] border border-[#2B4328]'
                          : d.status === 'SHORTAGE'
                          ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD SCHEDULED EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#111622] border border-[#1E2638] rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C2436] pb-3.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#A3E635]" />
                <span>Add Scheduled Supplier Payable</span>
              </h3>
              <button
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {expenseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {expenseError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">
                  Payable Description *
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Amul Dairy Milk Invoice, FMCG Distributor"
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 6000"
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-sm text-white font-mono font-bold placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E9CAE] block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-xl text-sm text-white font-mono placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#1C2436]">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#161C2C] hover:bg-[#1E273D] text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#A3E635] hover:bg-[#BEF264] disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-sm"
                >
                  {expenseLoading ? 'Saving…' : 'Schedule Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
