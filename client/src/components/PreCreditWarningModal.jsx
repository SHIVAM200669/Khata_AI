import React from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  X,
  ArrowRight,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  History
} from 'lucide-react';

/**
 * Pre-Credit Repayment Attention Advisory Modal.
 * Displays factual repayment metrics and projected balance before confirming credit.
 * Advisory only — does not block the merchant.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.warningData
 * @param {() => void} props.onCancel
 * @param {() => void} props.onConfirm
 */
export default function PreCreditWarningModal({ isOpen, warningData, onCancel, onConfirm }) {
  if (!isOpen || !warningData) return null;

  const {
    customer,
    current_outstanding = 0,
    new_credit_amount = 0,
    projected_outstanding = 0,
    repayment_rate = 0,
    recent_credit_count = 0,
    recent_unsettled_count = 0,
    last_repayment_date = null,
    days_since_last_repayment = null,
    warning_reason = null
  } = warningData;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No repayment recorded';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0E1320] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-white/[0.06] bg-[#111726]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Repayment Risk Advisory
              </h3>
              <p className="text-[11px] text-slate-400">
                Pre-Credit Assessment &bull; {customer?.name || 'Customer'}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center border border-white/[0.08] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Factual Advisory Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-white">Advisory Notification</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {warning_reason || `Customer currently has ₹${current_outstanding.toLocaleString('en-IN')} outstanding.`}
              </p>
            </div>
          </div>

          {/* Credit & Balance Projection Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-[#080B11]/60 border border-white/[0.05]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Current Due
              </span>
              <span className="text-sm font-black font-mono text-amber-400 mt-1 block">
                ₹{Number(current_outstanding).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#080B11]/60 border border-white/[0.05]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                + New Credit
              </span>
              <span className="text-sm font-black font-mono text-white mt-1 block">
                ₹{Number(new_credit_amount).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-[10px] uppercase font-bold text-rose-400 block">
                Projected Due
              </span>
              <span className="text-sm font-black font-mono text-rose-300 mt-1 block">
                ₹{Number(projected_outstanding).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Detailed Repayment Metrics Table */}
          <div className="p-4 rounded-2xl bg-[#080B11]/70 border border-white/[0.06] space-y-2.5">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Repayment Rate:</span>
              <span className={`font-mono font-bold ${
                repayment_rate >= 70
                  ? 'text-[#00E599]'
                  : repayment_rate >= 40
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}>
                {repayment_rate}%
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-white/[0.04]">
              <span className="text-slate-400">Recent Unsettled Credits:</span>
              <span className="font-mono font-bold text-amber-400">
                {recent_unsettled_count} of {recent_credit_count} recent credits
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-white/[0.04]">
              <span className="text-slate-400">Last Repayment Date:</span>
              <span className="text-slate-200 font-medium font-mono">
                {last_repayment_date
                  ? `${formatDate(last_repayment_date)} (${days_since_last_repayment === 0 ? 'Today' : `${days_since_last_repayment}d ago`})`
                  : 'No repayment recorded'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic text-center">
            This advisory is informational based on historical ledger entries. You retain full decision to proceed.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-[#111726]/80 flex items-center justify-end gap-3">
          <button
            id="btn-pre-credit-cancel"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 transition-colors"
          >
            Cancel
          </button>

          <button
            id="btn-pre-credit-continue"
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E599] to-[#10B981] hover:brightness-110 text-slate-950 font-bold text-xs transition-all shadow-md shadow-[#00E599]/20"
          >
            <span>Review & Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
