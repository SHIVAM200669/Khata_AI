import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Users,
  Calendar,
  IndianRupee,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-react';
import api from '../utils/api.js';
import { Link } from 'react-router-dom';

export default function AlertsCenter({ onActionClick }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'
  const [expandedAlerts, setExpandedAlerts] = useState({});

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/api/alerts');
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.message || 'Failed to load financial alerts.');
      }
    } catch (err) {
      console.error('Alerts fetch error:', err);
      setError(err.response?.data?.message || 'Could not connect to alerts engine.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    const handleUpdate = () => fetchAlerts();
    window.addEventListener('kirana:financial-update', handleUpdate);
    return () => window.removeEventListener('kirana:financial-update', handleUpdate);
  }, [fetchAlerts]);

  const toggleExpand = (id) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredAlerts = (data?.alerts || []).filter(a => {
    if (activeTab === 'ALL') return true;
    return a.priority === activeTab;
  });

  const criticalCount = data?.summary?.critical || 0;
  const warningCount = data?.summary?.warning || 0;
  const infoCount = data?.summary?.info || 0;
  const totalCount = data?.summary?.total || 0;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#111622] border border-[#1E2638]">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1C2436]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#241A0E] border border-[#483318] flex items-center justify-center text-[#FBBF24]">
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Financial Alerts &amp; Recommended Actions
              </h2>
              {criticalCount > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                  {criticalCount} Critical
                </span>
              ) : warningCount > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#241A0E] text-[#FBBF24] border border-[#483318] font-mono">
                  {warningCount} Attention
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328] font-mono">
                  Optimal
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E9CAE] mt-0.5">
              Automated working capital radar &amp; credit repayment intelligence
            </p>
          </div>
        </div>

        {/* Priority Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-[#1C2436] text-white border border-[#2E3B54]'
                : 'text-[#8E9CAE] hover:text-white'
            }`}
          >
            <span>All</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#0B0E14] text-slate-300 font-mono">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'CRITICAL'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-[#8E9CAE] hover:text-rose-300'
            }`}
          >
            <span>Critical</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              criticalCount > 0 ? 'bg-rose-500/30 text-rose-200 font-bold' : 'bg-[#0B0E14] text-[#8E9CAE]'
            }`}>
              {criticalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('WARNING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'WARNING'
                ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                : 'text-[#8E9CAE] hover:text-amber-300'
            }`}
          >
            <span>Warning</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              warningCount > 0 ? 'bg-[#38260F] text-[#FBBF24] font-bold' : 'bg-[#0B0E14] text-[#8E9CAE]'
            }`}>
              {warningCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('INFO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'INFO'
                ? 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                : 'text-[#8E9CAE] hover:text-blue-300'
            }`}
          >
            <span>Info</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#0B0E14] text-[#8E9CAE] font-mono">
              {infoCount}
            </span>
          </button>

          <button
            onClick={fetchAlerts}
            title="Refresh alerts"
            className="p-2 rounded-xl text-[#8E9CAE] hover:text-white hover:bg-[#161C2C] border border-[#1E2638] transition-colors ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#A3E635] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="mt-4 space-y-3">
        {isLoading && !data ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="p-4 rounded-2xl bg-[#0B0E14] border border-[#1E2638] animate-pulse h-20" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-[#0B0E14] border border-[#1E2638] text-[#8E9CAE] text-xs">
            <CheckCircle2 className="w-7 h-7 text-[#A3E635] mx-auto mb-2" />
            <p className="font-bold text-white">No {activeTab.toLowerCase()} alerts active</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              All financial indicators are currently operating within safe thresholds.
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.priority === 'CRITICAL';
            const isWarning = alert.priority === 'WARNING';
            const isExpanded = !!expandedAlerts[alert.id];

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isCritical
                    ? 'bg-rose-950/20 border-rose-500/35'
                    : isWarning
                    ? 'bg-[#241A0E]/30 border-[#483318]'
                    : 'bg-[#0B0E14] border-[#1E2638]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isWarning
                        ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                        : 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                    }`}>
                      {isCritical ? (
                        <AlertOctagon className="w-4 h-4" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                          {alert.title}
                        </h4>
                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider font-mono ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isWarning
                            ? 'bg-[#241A0E] text-[#FBBF24] border border-[#483318]'
                            : 'bg-[#101D2E] text-[#38BDF8] border border-[#1E3A5F]'
                        }`}>
                          {alert.priority}
                        </span>
                      </div>
                      <p className="text-xs text-[#8E9CAE] mt-1 leading-relaxed">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpand(alert.id)}
                    className="p-1.5 rounded-xl text-[#8E9CAE] hover:text-white bg-[#161C2C] hover:bg-[#1E273D] border border-[#242F46] transition-colors shrink-0"
                    title={isExpanded ? 'Hide actions' : 'View recommended actions'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Actions & Reason */}
                {isExpanded && (
                  <div className="mt-3.5 pt-3.5 border-t border-[#1C2436] space-y-3">
                    <div className="text-[11px] text-[#8E9CAE] leading-relaxed bg-[#111622] p-3 rounded-xl border border-[#1E2638]">
                      <strong className="text-white font-bold">Underlying Cause: </strong>
                      {alert.reason}
                    </div>

                    {alert.actions && alert.actions.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-[#8E9CAE] uppercase tracking-wider block mb-1.5">
                          Recommended Next Actions
                        </span>
                        <div className="space-y-2">
                          {alert.actions.map((act, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <span className="font-bold text-white block sm:inline">
                                  {act.label}:{' '}
                                </span>
                                <span className="text-[#8E9CAE] text-[11px]">
                                  {act.description}
                                </span>
                              </div>

                              {act.link ? (
                                <Link
                                  to={act.link}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#A3E635] hover:underline self-start sm:self-auto shrink-0 group"
                                >
                                  <span>Execute</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
