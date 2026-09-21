import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Mail, Eye, EyeOff, Shield, ArrowRight, Key, X, Check, AlertCircle, Copy } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, requestPasswordReset, completePasswordReset } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password Modal States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [receivedCodeNotice, setReceivedCodeNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim());
    setForgotCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);
    setReceivedCodeNotice(null);
    setForgotStep('request');
    setIsForgotModalOpen(true);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);
    setIsForgotLoading(true);

    try {
      const res = await requestPasswordReset(forgotEmail.trim());
      if (res.success) {
        setForgotSuccessMsg('Password reset request logged in treasury records.');
        if (res.resetCode) {
          setReceivedCodeNotice(res.resetCode);
          setForgotCode(res.resetCode);
        }
        setForgotStep('verify');
      } else {
        setForgotErrorMsg(res.error || 'Could not initiate password reset.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Service communication error.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotErrorMsg('New passwords do not match.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsForgotLoading(true);

    try {
      const res = await completePasswordReset(forgotEmail.trim(), forgotCode.trim(), forgotNewPassword);
      if (res.success) {
        setForgotSuccessMsg('Password updated! Signing you into StarRuby.in...');
        // Pre-fill email and auto sign in
        setEmail(forgotEmail.trim());
        setPassword(forgotNewPassword);
        setTimeout(async () => {
          setIsForgotModalOpen(false);
          await login(forgotEmail.trim(), forgotNewPassword);
        }, 1200);
      } else {
        setForgotErrorMsg(res.error || 'Password reset verification failed.');
      }
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Reset verification error.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden text-slate-900 select-none">
      
      {/* ========================================================================= */}
      {/* LUXURY GEMSTONE GRAPHICAL BACKGROUND & SUBTLE MOTION                      */}
      {/* ========================================================================= */}

      {/* 1. Subtle Precision Gemological Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E2E8F0 1px, transparent 1px),
            linear-gradient(to bottom, #E2E8F0 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* 2. Soft Ruby & Warm Amber Refractive Light Pools */}
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-gradient-to-br from-rose-200/40 via-rose-100/25 to-transparent rounded-full blur-3xl pointer-events-none animate-light-pulse" />
      <div className="absolute -bottom-32 -right-32 w-[540px] h-[540px] bg-gradient-to-tl from-amber-100/45 via-rose-100/30 to-transparent rounded-full blur-3xl pointer-events-none animate-light-pulse" style={{ animationDelay: '-5s' }} />

      {/* 3. Central Signature Star Ruby 6-Ray Asterism (Celestial Gemstone Light Rays) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
        <svg
          className="w-[720px] h-[720px] opacity-[0.14] animate-asterism text-rose-800"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ray 1: Vertical */}
          <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
          <path d="M200 0 L204 200 L200 400 L196 200 Z" fill="url(#starGrad)" opacity="0.6" />
          
          {/* Ray 2: 60-degree angle */}
          <line x1="35" y1="105" x2="365" y2="295" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
          <path d="M27 91 L200 200 L373 309 L200 200 Z" stroke="url(#starGrad)" strokeWidth="3" opacity="0.6" />

          {/* Ray 3: 120-degree angle */}
          <line x1="35" y1="295" x2="365" y2="105" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6" />
          <path d="M27 309 L200 200 L373 91 L200 200 Z" stroke="url(#starGrad)" strokeWidth="3" opacity="0.6" />

          {/* Core Gem Star Highlight */}
          <circle cx="200" cy="200" r="18" fill="url(#gemCore)" />
          <circle cx="200" cy="200" r="48" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
          <circle cx="200" cy="200" r="96" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />

          <defs>
            <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#BE123C" stopOpacity="0" />
              <stop offset="50%" stopColor="#BE123C" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#BE123C" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="gemCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.8" />
              <stop offset="40%" stopColor="#BE123C" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#881337" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* 4. Top-Right Floating Faceted Gemstone (Brilliant Cut Wireframe & Prism) */}
      <div className="hidden lg:block absolute top-12 right-16 pointer-events-none select-none z-0 animate-gem-float">
        <svg className="w-56 h-56 opacity-[0.28]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gemstone Crown & Table Geometry */}
          <polygon points="100,20 150,55 170,110 140,165 60,165 30,110 50,55" stroke="#9F1239" strokeWidth="1.2" fill="url(#rubyShimmer)" />
          <polygon points="100,50 135,75 145,115 125,145 75,145 55,115 65,75" stroke="#E11D48" strokeWidth="0.9" fill="#FFF1F2" fillOpacity="0.35" />
          <polygon points="100,75 120,90 125,115 112,130 88,130 75,115 80,90" stroke="#BE123C" strokeWidth="0.75" />
          {/* Facet Lines */}
          <line x1="100" y1="20" x2="100" y2="50" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="150" y1="55" x2="135" y2="75" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="170" y1="110" x2="145" y2="115" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="140" y1="165" x2="125" y2="145" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="60" y1="165" x2="75" y2="145" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="30" y1="110" x2="55" y2="115" stroke="#E11D48" strokeWidth="0.8" />
          <line x1="50" y1="55" x2="65" y2="75" stroke="#E11D48" strokeWidth="0.8" />
          <defs>
            <linearGradient id="rubyShimmer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFE4E6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FDA4AF" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 5. Bottom-Left Floating Emerald-Cut Crystal Geometry */}
      <div className="hidden lg:block absolute bottom-12 left-16 pointer-events-none select-none z-0 animate-gem-float-rev">
        <svg className="w-52 h-52 opacity-[0.24]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Octagon / Step Cut Facets */}
          <polygon points="50,20 150,20 180,50 180,150 150,180 50,180 20,150 20,50" stroke="#881337" strokeWidth="1.2" fill="url(#stepCutGrad)" />
          <polygon points="65,40 135,40 160,65 160,135 135,160 65,160 40,135 40,65" stroke="#9F1239" strokeWidth="0.85" />
          <polygon points="80,60 120,60 140,80 140,120 120,140 80,140 60,120 60,80" stroke="#BE123C" strokeWidth="0.6" fill="#FFF1F2" fillOpacity="0.25" />
          {/* Corner Bevel Lines */}
          <line x1="50" y1="20" x2="80" y2="60" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="150" y1="20" x2="120" y2="60" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="180" y1="50" x2="140" y2="80" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="180" y1="150" x2="140" y2="120" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="150" y1="180" x2="120" y2="140" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="50" y1="180" x2="80" y2="140" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="20" y1="150" x2="60" y2="120" stroke="#BE123C" strokeWidth="0.8" />
          <line x1="20" y1="50" x2="60" y2="80" stroke="#BE123C" strokeWidth="0.8" />
          <defs>
            <linearGradient id="stepCutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF2F2" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FFE4E6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* CLEAN CORPORATE LOGIN CARD (NO CLUTTER, NO FLUFF)                         */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[390px] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/5 p-7 sm:p-8 z-10 transition-all">
        
        {/* Brand Banner */}
        <div className="text-center pb-5 border-b border-slate-100">
          <div className="inline-flex items-center justify-center p-2.5 bg-slate-50/60 rounded-xl border border-slate-100 mb-3.5">
            <img
              src="/star-ruby-banner.gif"
              alt="StarRuby.in"
              className="h-8.5 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Banking & Treasury Portal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign in with your official credentials
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200/80 text-rose-800 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-200">
            <Shield className="w-4 h-4 text-rose-700 shrink-0" />
            <span className="font-medium leading-tight">{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@starruby.in"
                className="w-full pl-9 pr-3 py-2 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-700 focus:ring-1 focus:ring-rose-700/20 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-9 py-2 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-700 focus:ring-1 focus:ring-rose-700/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Forgot Password Action Link */}
          <div className="flex items-center justify-end -mt-1">
            <button
              type="button"
              onClick={handleOpenForgotModal}
              className="text-[11px] font-medium text-rose-800 hover:text-rose-950 transition hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 bg-rose-800 hover:bg-rose-900 active:bg-rose-950 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
          >
            <span>{isLoading ? 'Verifying...' : 'Sign In'}</span>
            {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        {/* Minimal Quiet Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400">
          <Shield className="w-3 h-3 text-slate-400" />
          <span>Authorized Personnel &bull; 256-Bit TLS</span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PASSWORD RECOVERY & RESET MODAL                                          */}
      {/* ========================================================================= */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-text">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-800 shadow-xs shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-slate-900 leading-tight">
                  Password Recovery & Reset
                </h3>
                <p className="text-[11px] text-slate-500">
                  StarRuby.in Treasury Governance Identity Service
                </p>
              </div>
            </div>

            {/* Step Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold text-center">
              <button
                type="button"
                onClick={() => setForgotStep('request')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  forgotStep === 'request'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Request Reset
              </button>
              <button
                type="button"
                onClick={() => setForgotStep('verify')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  forgotStep === 'verify'
                    ? 'bg-rose-800 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Enter 6-Digit Code
              </button>
            </div>

            {/* Feedback Alerts */}
            {forgotErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{forgotErrorMsg}</span>
              </div>
            )}

            {forgotSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{forgotSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: REQUEST RESET FORM */}
            {forgotStep === 'request' && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. staff@starruby.in"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-700 focus:ring-1 focus:ring-rose-700/20 transition"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1.5 block">
                    A secure 6-digit verification code will be generated, and your reset request will appear in the Admin queue for instant approval.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="w-1/3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="w-2/3 py-2 bg-rose-800 hover:bg-rose-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <span>{isForgotLoading ? 'Generating...' : 'Submit Request'}</span>
                    {!isForgotLoading && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: VERIFY CODE & SET NEW PASSWORD */}
            {forgotStep === 'verify' && (
              <form onSubmit={handleCompleteReset} className="space-y-3.5">
                {receivedCodeNotice && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      Generated 6-Digit Security Code
                    </span>
                    <div className="font-mono text-2xl font-black text-amber-950 tracking-widest">
                      {receivedCodeNotice}
                    </div>
                    <span className="text-[10px] text-amber-700 block">
                      Code valid for 1 hour. You can use it now or have Admin approve your request.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@starruby.in"
                    className="w-full px-3 py-2 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest text-center text-slate-900 focus:outline-none focus:border-rose-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        required
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3 pr-8 py-2 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title={showForgotNewPassword ? 'Hide' : 'Show'}
                      >
                        {showForgotNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-700"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between space-x-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="w-1/3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="w-2/3 py-2 bg-rose-800 hover:bg-rose-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <span>{isForgotLoading ? 'Updating...' : 'Set Password & Sign In'}</span>
                    {!isForgotLoading && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

