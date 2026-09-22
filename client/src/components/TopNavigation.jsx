import React, { useEffect, useState } from 'react';
import { Menu, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

export default function TopNavigation({ onMenuClick }) {
  const [apiStatus, setApiStatus] = useState('checking'); // checking | online | offline
  const { merchant, user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await api.get('/api/health');
        if (isMounted) {
          if (response.data && response.data.success) {
            setApiStatus('online');
          } else {
            setApiStatus('offline');
          }
        }
      } catch (err) {
        if (isMounted) {
          setApiStatus('offline');
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const storeName = merchant?.name || user?.displayName || 'Kirana Store';
  const merchantSub = merchant?.id
    ? `Merchant #${merchant.id}${merchant.phone ? ` • ${merchant.phone}` : ''}`
    : (user?.email || 'Authenticated');

  return (
    <header className="h-20 sticky top-0 z-30 bg-[#0B0E14] border-b border-[#1C2436] px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#151B29] lg:hidden transition-colors"
          aria-label="Open Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Node API Pill Badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#111622] border border-[#1E2638] text-[#A3E635]"
        >
          <span className="w-2 h-2 rounded-full bg-[#A3E635] animate-pulse" />
          <span className="text-[11px] font-medium tracking-wide">Live Node API</span>
        </div>

        {/* Notification Bell */}
        <button
          className="w-9 h-9 rounded-full bg-[#111622] border border-[#1E2638] hover:bg-[#161C2A] text-slate-300 hover:text-white flex items-center justify-center transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
        </button>

        {/* Merchant Profile */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-9 h-9 rounded-full bg-[#162215] border border-[#2B4328] flex items-center justify-center text-[#A3E635] font-bold text-xs">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block text-left max-w-[150px]">
            <p className="text-xs font-bold text-white leading-tight truncate">{storeName}</p>
            <p className="text-[10px] text-[#64748B] font-mono truncate">{merchantSub}</p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign Out"
            className="p-2 rounded-xl text-[#64748B] hover:text-rose-400 hover:bg-[#181D2A] transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
