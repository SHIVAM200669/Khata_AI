import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Store, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User, Phone, Building2, FileText, Globe, CheckCircle2, Sparkles } from 'lucide-react';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
];

export default function Register() {
  const { register, loginWithGoogle, completeOnboarding, isAuthenticated, loading, needsOnboarding, user } = useAuth();

  const [form, setForm] = useState({
    name: '',
    shopName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    gstin: '',
    preferredLanguage: 'en',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const isOnboarding = !!user && needsOnboarding;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.name.trim()) return 'Merchant name is required.';
    if (!form.shopName.trim()) return 'Shop/business name is required.';
    if (!form.phone.trim()) return 'Phone number is required.';

    const cleaned = form.phone.replace(/[\s\-\(\)+]/g, '');
    const digits = cleaned.replace(/^91/, '');
    if (!/^\d{10}$/.test(digits)) return 'Please enter a valid 10-digit Indian phone number.';

    if (!isOnboarding) {
      if (!form.email.trim()) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
      if (form.password.length < 8) return 'Password must be at least 8 characters.';
      if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    }

    if (form.gstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(form.gstin.trim().toUpperCase())) {
        return 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5';
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) return setError(validationError);

    setIsSubmitting(true);

    const merchantData = {
      name: form.name.trim(),
      shopName: form.shopName.trim(),
      phone: form.phone.trim(),
      email: isOnboarding ? user.email : form.email.trim(),
      gstin: form.gstin.trim() || null,
      preferredLanguage: form.preferredLanguage,
    };

    let result;
    if (isOnboarding) {
      result = await completeOnboarding(merchantData);
    } else {
      result = await register(form.email.trim(), form.password, merchantData);
    }

    if (!result.success) setError(result.message);
    setIsSubmitting(false);
  };

  const handleGoogleRegister = async () => {
    setError('');
    setIsGoogleLoading(true);
    const result = await loginWithGoogle();
    if (!result.success) setError(result.message);
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4 relative">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white p-1 border border-[#2B4328] mb-3.5 shadow-lg shadow-black/40">
            <img src="/logo.png" alt="KhataAI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isOnboarding ? 'Complete Store Onboarding' : 'Create KhataAI Account'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8E9CAE]">
            {isOnboarding
              ? 'Please provide your business details to configure your khata ledger.'
              : 'Launch your KhataAI merchant account in minutes.'
            }
          </p>
        </div>

        {/* Register Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#111622] border border-[#1E2638] space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Merchant Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ramesh Kumar"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Shop Name *</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                  <input
                    type="text"
                    name="shopName"
                    value={form.shopName}
                    onChange={handleChange}
                    placeholder="Shree Ganesh Kirana"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all font-mono"
                />
              </div>
            </div>

            {!isOnboarding && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="merchant@kiranapilot.in"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="Min 8 chars"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all"
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
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">
                  GSTIN <span className="text-[#5A687D]">(optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                  <input
                    type="text"
                    name="gstin"
                    value={form.gstin}
                    onChange={handleChange}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white placeholder-[#5A687D] focus:outline-none focus:border-[#A3E635] transition-all uppercase font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8E9CAE] mb-1.5">Preferred Language</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A687D]" />
                  <select
                    name="preferredLanguage"
                    value={form.preferredLanguage}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#1E2638] rounded-2xl text-sm text-white focus:outline-none focus:border-[#A3E635] transition-all appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value} className="bg-[#111622] text-white">{lang.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#A3E635] hover:bg-[#BEF264] text-slate-950 font-black text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 mt-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Sparkles className="w-4 h-4 text-slate-950 stroke-[2.5]" />}
              <span>{isOnboarding ? 'Complete Setup' : 'Create Merchant Account'}</span>
            </button>
          </form>

          {!isOnboarding && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#1C2436]" />
                <span className="text-[10px] text-[#5A687D] font-bold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#1C2436]" />
              </div>

              <button
                onClick={handleGoogleRegister}
                disabled={isGoogleLoading || isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
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
                <span>Sign up with Google</span>
              </button>
            </>
          )}
        </div>

        {!isOnboarding && (
          <p className="text-center text-xs sm:text-sm text-[#8E9CAE]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#A3E635] hover:underline font-bold ml-1">
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
