import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Store, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login, loginWithGoogle, isAuthenticated, loading, needsOnboarding } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (needsOnboarding) return <Navigate to="/register" replace />;

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) return setError('Please enter your email address.');
    if (!password) return setError('Please enter your password.');

    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    if (!result.success) setError(result.message);
    setIsSubmitting(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    const result = await loginWithGoogle();
    if (!result.success) setError(result.message);
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md space-y-7">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white p-1 border border-[#2B4328] mb-3.5 shadow-lg shadow-black/40">
            <img src="/logo.png" alt="KhataAI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            KhataAI
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8E9CAE]">AI Financial Operating System for Indian Merchants</p>
        </div>

        {/* Login Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-5">
          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#1C2436]" />
            <span className="text-[10px] text-[#5A687D] font-bold uppercase tracking-wider">or email credentials</span>
            <div className="flex-1 h-px bg-[#1C2436]" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@kiranapilot.in"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] font-mono transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A687D] hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full py-3.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Sparkles className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              )}
              <span>Sign In to KiranaPilot</span>
            </button>
          </form>

          {/* Forgot Password */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-xs text-[#A3E635] hover:underline font-bold"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        {/* Register Link */}
        <p className="text-center text-xs sm:text-sm text-[#8E9CAE]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#A3E635] hover:underline font-bold ml-1">
            Create Merchant Account
          </Link>
        </p>
      </div>
    </div>
  );
}
