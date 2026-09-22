import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Store,
  Sparkles,
  TrendingUp,
  BookOpen,
  Mic
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col justify-between selection:bg-[#A3E635]/30 selection:text-[#A3E635]">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="KhataAI Logo"
            className="w-9 h-9 rounded-xl object-contain border border-[#1E2638] bg-[#111622] p-1"
          />
          <span className="font-extrabold text-xl tracking-tight text-white">
            KhataAI
          </span>
        </div>

        <Link
          to="/dashboard"
          className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-[#8E9CAE] hover:text-[#A3E635] transition-colors"
        >
          <span>Merchant Console</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#111622] border border-[#1E2638] text-xs font-bold text-[#A3E635] mb-8">
          <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" />
          <span>Next-Generation Financial Copilot for Indian Retail</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-6">
          Kirana<span className="text-[#A3E635]">Pilot</span>
        </h1>

        <p className="text-lg sm:text-xl text-[#8E9CAE] font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
          Real-time cash drawer analytics, customer Khata intelligence, and 7-day liquidity forecasting.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[#A3E635] text-[#091002] font-black text-sm sm:text-base hover:bg-[#BEF264] transition-all shadow-sm active:scale-95"
          >
            <span>Open Merchant Dashboard</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-16 sm:mt-24 w-full text-left">
          <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center mb-4 text-[#A3E635]">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Vernacular Voice &amp; OCR</h3>
            <p className="text-[#8E9CAE] text-xs leading-relaxed">
              Log sales and credit in Hindi, Tamil, English, and code-mixed speech or scanned paper ledgers.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#101D2E] border border-[#1E3A5F] flex items-center justify-center mb-4 text-[#38BDF8]">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Khata Intelligence</h3>
            <p className="text-[#8E9CAE] text-xs leading-relaxed">
              Track customer debt, detect repayment anomalies, and prevent customer entity ambiguities.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#111622] border border-[#1E2638] transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#162215] border border-[#2B4328] flex items-center justify-center mb-4 text-[#A3E635]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">7-Day Cash Forecast</h3>
            <p className="text-[#8E9CAE] text-xs leading-relaxed">
              Model liquidity trajectories and simulate supplier payments before shortages hit your counter.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C2436] py-6 px-6 text-center text-xs text-[#5A687D] font-mono">
        <p>KiranaPilot &copy; {new Date().getFullYear()} &bull; Production Fintech Financial OS</p>
      </footer>
    </div>
  );
}
