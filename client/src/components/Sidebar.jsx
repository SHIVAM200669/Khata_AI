import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  TrendingUp,
  Settings,
  Store,
  Sparkles,
  Bot,
  Truck,
  Receipt,
  Wallet,
  ClipboardList,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const coreNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Copilot', path: '/copilot', icon: Bot },
  { name: 'Cash Forecast', path: '/forecast', icon: TrendingUp },
];

const ledgerNavItems = [
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Suppliers', path: '/transactions', icon: Truck },
  { name: 'Expenses', path: '/transactions', icon: Receipt },
  { name: 'Cashbook', path: '/transactions', icon: Wallet },
  { name: 'Reports - Parties', path: '/customers', icon: ClipboardList },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, merchant } = useAuth();

  const businessName = merchant?.store_name || merchant?.name || user?.displayName || 'My Business';
  const initial = businessName.charAt(0).toUpperCase() || 'M';
  const phoneOrEmail = merchant?.phone || user?.phoneNumber || user?.email?.split('@')[0] || '9692901375';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B0E14] border-r border-[#1C2436] flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 px-5 border-b border-[#1C2436] flex items-center justify-between shrink-0">
          <NavLink to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="KhataAI Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 border border-[#2B4328] shadow-sm shrink-0"
            />
            <div>
              <span className="font-extrabold text-base text-white tracking-tight">
                KhataAI
              </span>
              <p className="text-[11px] text-[#64748B] font-medium tracking-wide">Fintech Intelligence</p>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#161C2C] lg:hidden transition-colors"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
          {/* Merchant Profile Card (Khatabook PRO style) */}
          <div className="p-3 rounded-2xl bg-[#111622] border border-[#1E2638] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate tracking-tight">
                {businessName}
              </h4>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {phoneOrEmail}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#A3E635] shadow-[0_0_6px_#A3E635]" />
                <span className="text-[10px] font-semibold text-[#A3E635]">Online</span>
              </div>
            </div>
          </div>

          {/* Core Menu */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-[#4B586E] uppercase tracking-widest">
              CORE MENU
            </div>

            {coreNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#131927] border border-[#222C42] text-white shadow-sm'
                        : 'text-[#8E9CAE] hover:text-white hover:bg-[#111622] border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-[#A3E635] text-[#091002]'
                              : 'text-[#7B8B9E] group-hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                        </div>
                        <span className="tracking-tight text-[13px]">{item.name}</span>
                      </div>

                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-[#A3E635] shadow-[0_0_8px_#A3E635]" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Ledger Management (Khatabook PRO Items) */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-[#4B586E] uppercase tracking-widest">
              LEDGER MANAGEMENT
            </div>

            {ledgerNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#131927] border border-[#222C42] text-white shadow-sm'
                        : 'text-[#8E9CAE] hover:text-white hover:bg-[#111622] border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-[#A3E635] text-[#091002]'
                              : 'text-[#7B8B9E] group-hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                        </div>
                        <span className="tracking-tight text-[13px]">{item.name}</span>
                      </div>

                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-[#A3E635] shadow-[0_0_8px_#A3E635]" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom AI Status Banner */}
        <div className="p-4 border-t border-[#1C2436] shrink-0">
          <div className="p-3 rounded-2xl bg-[#111622] border border-[#1E2638]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#A3E635]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Engine Online</span>
            </div>
            <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed font-medium">
              Real-time ledger, voice sync &amp; 7-day cash forecast active.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
