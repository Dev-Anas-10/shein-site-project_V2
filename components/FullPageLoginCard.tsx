'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { getSupabase } from '@/lib/supabase';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  Phone,
  ShieldCheck,
  AlertCircle,
  Globe,
  Sun,
  Moon,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
} from 'lucide-react';

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

interface FullPageLoginCardProps {
  onGuestContinue?: () => void;
}

export function FullPageLoginCard({ onGuestContinue }: FullPageLoginCardProps) {
  const { login } = useAuth();
  const { dir, lang, toggleLang, theme, toggleTheme } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<'user' | 'admin'>('user');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Gmail Quick-Sign-In states
  const [showGmailInput, setShowGmailInput] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailName, setGmailName] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const handleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const payload = parseJwt(response.credential);
      if (!payload || !payload.email) {
        throw new Error('Failed to parse Google account information');
      }

      const cleanEmail = payload.email.toLowerCase();
      const detectedName = payload.name || payload.given_name || cleanEmail.split('@')[0];
      const avatar =
        payload.picture ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(detectedName)}`;

      // 1. Sync user to Supabase DB via our API
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: detectedName,
          avatar,
        }),
      });

      const data = await res.json();
      if (res.ok && data.data) {
        login(data.data);
      } else {
        login({
          id: `google-${payload.sub || Date.now()}`,
          name: detectedName,
          email: cleanEmail,
          avatar,
          role: 'user',
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Also authenticate Supabase session if supported
      const sb = getSupabase();
      if (sb) {
        sb.auth
          .signInWithIdToken({
            provider: 'google',
            token: response.credential,
          })
          .catch((e) => console.warn('Supabase signInWithIdToken sync note:', e));
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignInPopup = () => {
    setError(null);
    setGoogleLoading(true);

    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '392409310054-et01pph0ao3gt9mfjaq8equ5rh2coa05.apps.googleusercontent.com';

    // 1. Prefer direct Google Identity Services (GIS) Token Client (Shows app origin, avoids Supabase domain)
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              console.warn('Google Token Client response note:', tokenResponse);
              setGoogleLoading(false);
              return;
            }

            if (tokenResponse?.access_token) {
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const googleProfile = await userRes.json();

                if (!googleProfile?.email) {
                  throw new Error('Could not retrieve email from Google');
                }

                const cleanEmail = googleProfile.email.toLowerCase();
                const detectedName = googleProfile.name || cleanEmail.split('@')[0];
                const avatar =
                  googleProfile.picture ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(detectedName)}`;

                const res = await fetch('/api/auth/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: cleanEmail,
                    name: detectedName,
                    avatar,
                  }),
                });

                const data = await res.json();
                if (res.ok && data.data) {
                  login(data.data);
                } else {
                  login({
                    id: `google-${googleProfile.sub || Date.now()}`,
                    name: detectedName,
                    email: cleanEmail,
                    avatar,
                    role: 'user',
                    createdAt: new Date().toISOString(),
                  });
                }
              } catch (fetchErr: any) {
                console.error('Error fetching Google userinfo:', fetchErr);
                setError(fetchErr.message || 'Failed to complete Google Sign In');
              } finally {
                setGoogleLoading(false);
              }
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('Direct Google Token Client fallback note:', err);
      }
    }

    // 2. Fallback to Supabase OAuth popup if GIS script was blocked
    try {
      const redirectOrigin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://shein-cart-concierge.vercel.app';
      const redirectUrl = `${redirectOrigin}/auth/callback`;

      const authUrl = `https://sxcsgnzkgwctafqxkfdd.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
        redirectUrl
      )}`;

      // On mobile devices, redirect directly instead of popup for a seamless full-screen login
      const isMobile =
        typeof window !== 'undefined' &&
        (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

      if (isMobile) {
        window.location.href = authUrl;
        return;
      }

      const width = 500;
      const height = 650;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const popup = window.open(
        authUrl,
        'GoogleSignInPopup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // If popup was blocked by browser, redirect smoothly
        window.location.href = authUrl;
        return;
      }

      const messageHandler = (e: MessageEvent) => {
        if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          window.removeEventListener('message', messageHandler);
          setGoogleLoading(false);
          if (e.data.user) {
            login({
              id: `google-${Date.now()}`,
              name: e.data.user.name,
              email: e.data.user.email,
              avatar: e.data.user.avatar,
              role: 'user',
              createdAt: new Date().toISOString(),
            });
          }
        } else if (e.data?.type === 'GOOGLE_AUTH_DONE') {
          window.removeEventListener('message', messageHandler);
          setGoogleLoading(false);
        }
      };
      window.addEventListener('message', messageHandler);

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', messageHandler);
          setGoogleLoading(false);
        }
      }, 500);
    } catch (err: any) {
      setShowGmailInput(true);
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleGmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = gmailEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(isRtl ? 'يرجى كتابة بريد Gmail صحيح (مثال: ahmed@gmail.com)' : 'Please enter a valid Gmail address');
      return;
    }

    setGoogleLoading(true);
    setError(null);
    try {
      const detectedName = gmailName.trim() || cleanEmail.split('@')[0];
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: detectedName,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(detectedName)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google login failed');
      login(data.data);
      setShowGmailInput(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || (isRtl ? 'فشل تسجيل الدخول' : 'Login failed'));
        login(data.data);
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, phone }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || (isRtl ? 'فشل إنشاء الحساب' : 'Signup failed'));
        login(data.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#0A0713]">
      {/* High-Fashion Editorial Background Image ("وراها BACKGROUND كده") */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35 mix-blend-luminosity scale-105 pointer-events-none transition-all duration-1000"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop')`,
        }}
      />

      {/* Atmospheric Dark Luxury Vignette & Gradients */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-[#0c0914]/90 to-[#221035]/80 pointer-events-none" />

      {/* Ambient Breathing Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/25 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-rose-600/20 blur-3xl pointer-events-none animate-pulse" />

      {/* Centered Liquid Glass Login Card ("مربع ف الوش") */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-white/95 dark:bg-[#14101e]/90 backdrop-blur-3xl rounded-[36px] shadow-[0_30px_90px_rgba(0,0,0,0.65)] border border-white/60 dark:border-purple-500/25 p-7 sm:p-9 text-neutral-900 dark:text-white transition-colors"
      >
        {/* Top Floating Controls inside the card */}
        <div className="flex items-center justify-between pb-5 border-b border-neutral-100 dark:border-[#262035]">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] via-[#A855F7] to-[#C084FC] text-white flex items-center justify-center font-black text-base shadow-md shadow-purple-500/30">
              S
            </div>
            <div>
              <div className="font-extrabold text-neutral-950 dark:text-white text-sm tracking-tight leading-none">
                SHEIN <span className="text-[#8B5CF6]">Concierge</span>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                {isRtl ? 'فرع القاهرة • مصر' : 'Cairo Hub • Egypt'}
              </p>
            </div>
          </div>

          {/* Language & Theme Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-[#201a2c] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2c243c] transition-colors cursor-pointer border border-neutral-200/60 dark:border-[#2f2742] flex items-center gap-1"
              title={lang === 'ar' ? 'English' : 'عربي'}
            >
              <Globe className="w-3 h-3 text-[#8B5CF6]" />
              <span>{lang === 'ar' ? 'En' : 'عربي'}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#201a2c] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#2c243c] flex items-center justify-center transition-colors cursor-pointer border border-neutral-200/60 dark:border-[#2f2742]"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Card Headline */}
        <div className="pt-5 pb-4 text-start">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100/70 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 text-[10px] font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
            <span>{isRtl ? 'منصة الدفع والاستخراج الآمن' : 'Secure Extraction & Payment'}</span>
          </div>
          <h2 className="text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
            {mode === 'signin'
              ? isRtl
                ? 'تسجيل الدخول إلى حسابك'
                : 'Welcome Back'
              : isRtl
              ? 'إنشاء حساب عميل جديد'
              : 'Create Customer Account'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            {mode === 'signin'
              ? isRtl
                ? 'سجّل دخولك لمتابعة سلالك ومعاملاتك السابقة بالجنيه المصري'
                : 'Sign in to access your previous orders and SHEIN cart requests.'
              : isRtl
              ? 'أنشئ حسابك لبدء استخراج مشترياتك من شي إن والتوصيل في مصر'
              : 'Sign up to start extracting SHEIN carts with Egypt doorstep delivery.'}
          </p>
        </div>

        {/* Role Selector (Customer vs Admin) */}
        {mode === 'signin' && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 dark:bg-[#1a1626] rounded-2xl mb-4 border border-neutral-200/60 dark:border-[#292237]">
            <button
              type="button"
              onClick={() => {
                setRole('user');
                setError(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                role === 'user'
                  ? 'bg-white dark:bg-[#2b243b] text-neutral-950 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isRtl ? 'عميل' : 'Customer'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setError(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                role === 'admin'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-rose-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isRtl ? 'مشرف (Admin)' : 'Admin'}</span>
            </button>
          </div>
        )}

        {/* Google Identity Services Section (For Customers) */}
        {role === 'user' && (
          <div className="mb-4">
            {showGmailInput ? (
              <div className="p-4 bg-gradient-to-br from-blue-50/80 via-white to-purple-50/60 dark:from-blue-950/30 dark:via-[#1a1722] dark:to-purple-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-1 border-b border-blue-100 dark:border-blue-900/40">
                  <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                    {isRtl ? 'الدخول السريع ببريد Gmail' : 'Sign in with Gmail Address'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGmailInput(false)}
                    className="text-[11px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-start">
                    <input
                      type="email"
                      required
                      value={gmailEmail}
                      onChange={(e) => setGmailEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1722] border border-blue-200 dark:border-[#2a2538] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div className="text-start">
                    <input
                      type="text"
                      value={gmailName}
                      onChange={(e) => setGmailName(e.target.value)}
                      placeholder={isRtl ? 'الاسم الكريم (اختياري)' : 'Your Name (Optional)'}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1a1722] border border-blue-200 dark:border-[#2a2538] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGmailSubmit}
                    disabled={googleLoading || !gmailEmail.trim()}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {googleLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{isRtl ? 'جاري التحقق...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <span>{isRtl ? 'دخول بحساب Gmail الآن' : 'Sign in with Gmail'}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Responsive Google Capsule Button - Never clipped, generous padding */}
                <button
                  type="button"
                  onClick={handleGoogleSignInPopup}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-5 border border-neutral-300 dark:border-[#2f2742] rounded-full bg-white dark:bg-[#1a1626] hover:bg-neutral-50 dark:hover:bg-[#251f35] text-neutral-800 dark:text-neutral-100 font-bold text-xs transition-all shadow-xs active:scale-[0.99] cursor-pointer"
                >
                  {googleLoading ? (
                    <div className="w-4 h-4 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                  )}
                  <span>
                    {googleLoading
                      ? (isRtl ? 'جاري الاتصال بـ Google...' : 'Connecting to Google...')
                      : (isRtl ? 'المتابعة باستخدام حساب Google' : 'Continue with Google')}
                  </span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowGmailInput(true)}
                    className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline font-medium cursor-pointer"
                  >
                    {isRtl ? 'أو الدخول بكتابة إيميل Gmail يدوياً' : 'Or type Gmail address manually'}
                  </button>
                </div>
              </div>
            )}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-[#2a2538]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-white dark:bg-[#14101e] px-3 text-neutral-400 font-bold">
                  {isRtl ? 'أو تسجيل الدخول بالإيميل' : 'Or Email Login'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Standard Email / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div className="text-start">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                {isRtl ? 'الاسم الكريم' : 'Full Name'}
              </label>
              <div className="relative">
                <User className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRtl ? 'أحمد جمال' : 'Sara Ahmed'}
                  className={`w-full py-2.5 text-xs bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#201a2e] focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                    isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="text-start">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={`w-full py-2.5 text-xs bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#201a2e] focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                  isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                }`}
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="text-start">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                {isRtl ? 'رقم الهاتف (للتواصل أو فودافون كاش)' : 'Phone Number (Vodafone Cash / Contact)'}
              </label>
              <div className="relative">
                <Phone className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className={`w-full py-2.5 text-xs bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#201a2e] focus:outline-none focus:ring-2 focus:ring-purple-600 font-mono ${
                    isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="text-start">
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              {isRtl ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full py-2.5 text-xs bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#201a2e] focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                  isRtl ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                }`}
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={formLoading}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {formLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isRtl ? 'جاري التحقق...' : 'Verifying...'}</span>
              </>
            ) : mode === 'signin' ? (
              <span>{isRtl ? 'تسجيل الدخول الآن' : 'Sign In'}</span>
            ) : (
              <span>{isRtl ? 'إنشاء الحساب الآن' : 'Create Account'}</span>
            )}
          </motion.button>
        </form>

        {/* Toggle between Sign In / Sign Up */}
        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-[#241e33] text-center text-xs text-neutral-500 dark:text-neutral-400">
          {mode === 'signin' ? (
            <p>
              {isRtl ? 'ليس لديك حساب؟ ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="font-bold text-[#8B5CF6] hover:text-[#7C3AED] cursor-pointer underline"
              >
                {isRtl ? 'إنشاء حساب جديد' : 'Sign up now'}
              </button>
            </p>
          ) : (
            <p>
              {isRtl ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="font-bold text-[#8B5CF6] hover:text-[#7C3AED] cursor-pointer underline"
              >
                {isRtl ? 'تسجيل الدخول' : 'Sign in'}
              </button>
            </p>
          )}
        </div>

        {/* Guest Continue Option */}
        {onGuestContinue && (
          <div className="mt-5 pt-3 border-t border-dashed border-neutral-200/80 dark:border-neutral-800 text-center">
            <button
              type="button"
              onClick={onGuestContinue}
              className="w-full py-3 px-4 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-[#7C3AED] dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <ShoppingBag className="w-4 h-4 text-pink-500" />
              <span>{isRtl ? 'استكشاف الموقع وتجربة استخراج سلة شي إن كضيفة 🛍️' : 'Explore & Extract SHEIN Cart as Guest 🛍️'}</span>
              {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Payment Methods Trust Bar */}
        <div className="mt-5 pt-3.5 border-t border-neutral-100 dark:border-[#201b2d] flex items-center justify-center gap-2.5 flex-wrap">
          <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
            {isRtl ? 'دفع آمن بالجنيه المصري عبر' : 'Secure payment in EGP via'}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-6 px-2 py-0.5 rounded-lg bg-white dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] shadow-2xs flex items-center gap-1">
              <img src="/images/instapay.png" alt="InstaPay" className="h-3.5 w-auto object-contain" />
              <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">InstaPay</span>
            </div>
            <div className="h-6 px-2 py-0.5 rounded-lg bg-white dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2f2742] shadow-2xs flex items-center gap-1">
              <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="h-3.5 w-auto object-contain" />
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Vodafone</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}