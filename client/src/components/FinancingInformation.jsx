import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingUp,
  Users,
  Calendar,
  IndianRupee,
  Calculator,
  HelpCircle,
  Building2,
  Landmark,
  Briefcase,
  Store,
  ExternalLink
} from 'lucide-react';
import api from '../utils/api.js';
import { Link } from 'react-router-dom';

export default function FinancingInformation({ isOpen, onClose, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState('');

  // Illustrative Calculator State
  const [calcPrincipal, setCalcPrincipal] = useState('15000');
  const [calcRate, setCalcRate] = useState('14');
  const [calcMonths, setCalcMonths] = useState('6');
  const [calcResult, setCalcResult] = useState(null);

  const fetchFinancingInfo = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/api/financing/info');
      if (res.data?.success && res.data.financing) {
        setData(res.data.financing);
        if (res.data.financing.projectedGap > 0) {
          setCalcPrincipal(String(res.data.financing.projectedGap));
        }
      }
    } catch (err) {
      console.error('Financing info fetch error:', err);
      setError(err.response?.data?.message || 'Could not load financing information.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!initialData) {
        fetchFinancingInfo();
      } else {
        setData(initialData);
        if (initialData.projectedGap > 0) {
          setCalcPrincipal(String(initialData.projectedGap));
        }
      }
    }
  }, [isOpen, initialData, fetchFinancingInfo]);

  // Run local illustrative calculation
  useEffect(() => {
    const p = Math.max(0, parseFloat(calcPrincipal || 0));
    const r = Math.max(0, parseFloat(calcRate || 0)) / 100 / 12;
    const n = Math.max(1, parseInt(calcMonths || 6, 10));

    let emi = 0;
    if (r === 0) {
      emi = Math.round(p / n);
    } else {
      emi = Math.round((p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }

    const totalRepayment = emi * n;
    const totalInterest = Math.max(0, totalRepayment - p);

    setCalcResult({
      emi,
      totalInterest,
      totalRepayment
    });
  }, [calcPrincipal, calcRate, calcMonths]);

  if (!isOpen) return null;

  const getCategoryIcon = (index) => {
    switch (index) {
      case 0: return Store;
      case 1: return Landmark;
      case 2: return Building2;
      default: return Briefcase;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Financing Information & Working Capital Review
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent, neutral review for projected cash-flow gaps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Financial Gap Radar */}
          {data && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Projected Cash Position Review
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  data.hasFundingGap ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {data.hasFundingGap ? 'Potential Gap Detected' : 'Healthy Balance'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {data.requiredAmount && (
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Required Outflow</span>
                    <span className="text-sm font-bold font-mono text-slate-200">
                      ₹{Number(data.requiredAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Current Cash</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    ₹{Number(data.currentCash || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Projected Cash</span>
                  <span className="text-sm font-bold font-mono text-slate-300">
                    ₹{Number(data.projectedAvailableCash || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Projected Gap</span>
                  <span className={`text-sm font-bold font-mono ${
                    data.projectedGap > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    ₹{Number(data.projectedGap || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Before Considering External Financing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Step 1: Internal Cash-Flow Recovery Options
              </h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Always evaluate internal receivables and supplier timing before seeking any external financing.
            </p>

            <div className="space-y-2">
              {(data?.internalOptions || []).map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                      {opt.type === 'KHATA_COLLECTION' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200">{opt.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </div>

                  {opt.actionLink && (
                    <Link
                      to={opt.actionLink}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors self-start sm:self-auto shrink-0 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
                    >
                      <span>Take Action</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Neutral Financing Information Categories */}
          <div className="space-y-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Step 2: Neutral Financing Categories (Educational)
              </h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If an unresolved gap remains after reviewing internal options, you may independently explore standard market categories. KiranaPilot does not sell loans or recommend specific lenders.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(data?.financingCategories || []).map((cat, idx) => {
                const Icon = getCategoryIcon(idx);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-200">{cat.category}</h5>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed mb-1">
                        <strong>Purpose: </strong>{cat.typicalPurpose}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-1">
                        <strong>Considerations: </strong>{cat.typicalConsiderations}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60 font-mono">
                      Repayment: {cat.repaymentNature}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Illustrative Cost Calculator */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Illustrative Repayment Estimator (Educational Math Only)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={calcPrincipal}
                  onChange={(e) => setCalcPrincipal(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  placeholder="15000"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Indicative Annual Rate (%)</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={(e) => setCalcRate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  placeholder="14"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tenure (Months)</label>
                <select
                  value={calcMonths}
                  onChange={(e) => setCalcMonths(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                </select>
              </div>
            </div>

            {calcResult && (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">Est. Monthly EMI</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    ₹{calcResult.emi.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Est. Total Interest</span>
                  <span className="text-xs font-bold font-mono text-amber-400">
                    ₹{calcResult.totalInterest.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Est. Outflow</span>
                  <span className="text-xs font-bold font-mono text-slate-200">
                    ₹{calcResult.totalRepayment.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-500 italic">
              * Illustrative mathematical estimate only. KiranaPilot does not set rates, approve financing, or broker loans.
            </p>
          </div>

          {/* Section 5: Anti-Predatory Disclaimer */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>{data?.disclaimer || 'Financing information is provided for review only. KiranaPilot does not guarantee approval, rates, eligibility, or availability.'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
          >
            Close Review
          </button>
        </div>
      </div>
    </div>
  );
}
