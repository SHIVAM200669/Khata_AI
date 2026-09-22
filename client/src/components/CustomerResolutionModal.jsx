import React from 'react';
import {
  Users,
  UserPlus,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Phone,
  Clock,
  ArrowRight,
  X,
  CreditCard
} from 'lucide-react';

/**
 * CustomerResolutionModal
 * 
 * Centralized modal to safely resolve ambiguous customer names or confirm creating a new customer.
 * Used across Voice transactions, OCR transactions, and Manual transactions.
 * 
 * Guarantees:
 * 1. AMBIGUOUS_MATCH: Merchant MUST choose a candidate or explicitly add new customer.
 * 2. NO_MATCH: Merchant MUST explicitly confirm creating a new customer.
 * 3. Never auto-selects by balance, customer ID, or recency.
 */
export default function CustomerResolutionModal({
  isOpen,
  onClose,
  resolutionData,
  onSelectCustomer,
  onCreateNewCustomer
}) {
  if (!isOpen || !resolutionData) return null;

  const { standardized_name, query_name, matches = [], candidates = [] } = resolutionData;
  const candidateList = matches.length > 0 ? matches : candidates;
  const targetName = standardized_name || query_name || 'Customer';

  if (candidateList.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#111622] border border-[#1E2638] shadow-2xl overflow-hidden animate-scaleUp">
        
        {/* Top Header Banner */}
        <div className="px-6 py-4.5 border-b bg-[#241A0E]/50 border-[#483318] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#241A0E] text-[#FBBF24] border border-[#483318]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Multiple Matching Customers
              </h3>
              <p className="text-xs text-[#8E9CAE]">
                Found {candidateList.length} customers matching "{targetName}". Please select one:
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E9CAE] hover:text-white hover:bg-[#161C2C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#8E9CAE] uppercase tracking-wider">
              Which customer do you mean?
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {candidateList.map((cand) => (
                <button
                  key={cand.id}
                  onClick={() => onSelectCustomer(cand)}
                  className="w-full text-left p-4 rounded-2xl bg-[#0B0E14] hover:bg-[#151B29] border border-[#1E2638] hover:border-[#A3E635]/60 transition-all duration-150 group flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-[#A3E635] transition-colors">
                        {cand.name}
                      </span>
                      {cand.outstanding > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#241A0E] text-[#FBBF24] border border-[#483318]">
                          Due: ₹{Number(cand.outstanding).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#8E9CAE]">
                      {cand.phone ? (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-[#5A687D]" />
                          {cand.phone}
                        </span>
                      ) : (
                        <span className="text-[#5A687D] italic">No phone</span>
                      )}

                      {cand.last_transaction_date && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#5A687D]" />
                          Last tx: {cand.last_transaction_date}
                        </span>
                      )}

                      {cand.transaction_count > 0 && (
                        <span className="text-[#5A687D]">
                          ({cand.transaction_count} transactions)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-xs font-bold text-[#A3E635] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Select <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-[#0B0E14] border-t border-[#1E2638] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onCreateNewCustomer(targetName)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-[#161C2C] hover:bg-[#1E273D] border border-[#242F46] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>Add as a new customer "{targetName}" instead</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-[#8E9CAE] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
