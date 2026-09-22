import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Store, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const { isAuthenticated, loading } = useAuth();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) return setError('Please enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email address.');

    setIsSubmitting(true);
    await resetPassword(email.trim());
    setSent(true);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md space-y-7">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#162215] border border-[#2B4328] mb-3.5">
            <KeyRound className="w-7 h-7 text-[#A3E635] stroke-[2.4]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Reset Password</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8E9CAE]">
            Enter your merchant email to receive password recovery instructions.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-5">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#162215] text-[#A3E635] mb-2 border border-[#2B4328]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm text-slate-200 font-medium">
                If an account exists for <span className="text-[#A3E635] font-mono">{email}</span>, a password reset link has been dispatched.
              </p>
              <p className="text-xs text-[#8E9CAE] leading-relaxed">
                Please check your email inbox and spam folder.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#A3E635] hover:underline mt-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Email Address</label>
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
                  <span>Send Recovery Link</span>
                </button>
              </form>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs text-[#8E9CAE] hover:text-white font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
