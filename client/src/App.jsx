import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Customers from './pages/Customers.jsx';
import Forecast from './pages/Forecast.jsx';
import Copilot from './pages/Copilot.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import { Store, Loader2 } from 'lucide-react';

/**
 * Loading screen shown while Firebase auth state is being determined.
 */
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white p-1 border border-[#2B4328] shadow-lg shadow-black/40 animate-pulse">
          <img src="/logo.png" alt="KhataAI" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#A3E635]" />
          <span className="text-sm font-medium text-slate-300">Loading KhataAI...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper for protected routes — redirects to /login if not authenticated.
 * Shows loading screen while auth state is being determined.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, needsOnboarding, user } = useAuth();

  if (loading) return <AuthLoadingScreen />;

  // If user is authenticated via Firebase but needs onboarding, redirect to register
  if (user && needsOnboarding) return <Navigate to="/register" replace />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

/**
 * Wrapper for public routes — redirects to /dashboard if already authenticated.
 */
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Legacy Home Page */}
      <Route path="/home" element={<Home />} />

      {/* Protected Merchant Console Routes with Sidebar and Top Navigation */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/copilot" element={<Copilot />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Default redirect: unauthenticated → /login, authenticated → /dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
