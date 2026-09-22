import React from 'react';
import { Settings as SettingsIcon, Store, Shield, Bell, Database, User, Mail, Phone, MapPin, Hash, LogOut, CheckCircle2, Sparkles, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { merchant, user, logout } = useAuth();

  const providerId = user?.providerData?.[0]?.providerId || 'password';
  const providerLabel = providerId.includes('google') ? 'Google Account' : 'Email & Password';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#162215] text-[#A3E635] border border-[#2B4328]">
              Merchant Settings
            </span>
            <span className="text-xs text-[#8E9CAE] font-mono">ID #{merchant?.id || '—'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Settings &amp; Store Profile</h1>
          <p className="text-xs sm:text-sm text-[#8E9CAE] mt-0.5">
            Store identity, security credentials, and system architecture status.
          </p>
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all shadow-sm self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Store Profile Section */}
      <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#1C2436]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635]">
              <Store className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Merchant Business Profile</h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-[#162215] text-[#A3E635] border border-[#2B4328]">
            Active Account
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Shop / Business Name</label>
            <input
              type="text"
              readOnly
              value={merchant?.name || user?.displayName || 'My Kirana Store'}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Registered Email</label>
            <input
              type="text"
              readOnly
              value={merchant?.email || user?.email || '—'}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Primary Phone</label>
            <input
              type="text"
              readOnly
              value={merchant?.phone || 'Not configured'}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">GSTIN / Tax Registration</label>
            <input
              type="text"
              readOnly
              value={merchant?.gstin || 'Composition / Unregistered'}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Store Address</label>
            <input
              type="text"
              readOnly
              value={merchant?.address || 'Main Market, Local City'}
              className="w-full px-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white font-medium"
            />
          </div>
        </div>
      </div>

      {/* Security & Authentication */}
      <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1C2436]">
          <div className="w-9 h-9 rounded-2xl bg-[#101D2E] border border-[#1E3A5F] flex items-center justify-center text-[#38BDF8]">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Security &amp; Authentication Layer</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1E2638]">
            <div>
              <p className="font-bold text-white">Active Identity Provider</p>
              <p className="text-[#8E9CAE] text-xs mt-0.5">{providerLabel}</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#162215] text-[#A3E635] border border-[#2B4328] text-[10px] font-bold uppercase tracking-wider font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0B0E14] border border-[#1E2638] space-y-1.5 font-mono text-xs text-[#8E9CAE]">
            <p><span className="text-[#5A687D]">Firebase UID:</span> {user?.uid || '—'}</p>
            <p><span className="text-[#5A687D]">Isolation Policy:</span> Strict multi-tenant MySQL partition by merchant_id ({merchant?.id || '—'})</p>
          </div>
        </div>
      </div>

      {/* Database & Infrastructure */}
      <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1C2436]">
          <div className="w-9 h-9 rounded-2xl bg-[#161C2C] border border-[#242F46] flex items-center justify-center text-[#A3E635]">
            <Cpu className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Financial Intelligence Engine</h2>
        </div>

        <div className="space-y-3 text-xs text-[#8E9CAE] leading-relaxed">
          <p>
            <span className="font-bold text-white">Database Engine:</span> MySQL Server 8.4 with real-time transactional isolation across transactions, customers, expenses, alerts, and forecasts.
          </p>
          <p>
            <span className="font-bold text-white">AI Intelligence:</span> Sarvam Multi-lingual Speech STT, Document OCR Vision, Mistral 7B Natural Language Parser, and 7-Day Liquidity Forecast.
          </p>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-[#1E2638] text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#A3E635]" />
            <span>KiranaPilot Fintech Production Core v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
