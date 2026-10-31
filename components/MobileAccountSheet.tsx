'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import {
  X,
  User as UserIcon,
  ShoppingBag,
  Package,
  Plus,
  Headphones,
  LogOut,
  LogIn,
  ShieldCheck,
  TrendingUp,
  Globe,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface MobileAccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport: () => void;
  onOpenAuth: () => void;
  onOpenProfile?: () => void;
}

export function MobileAccountSheet({
  isOpen,
  onClose,
  onOpenSupport,
  onOpenAuth,
  onOpenProfile,
}: MobileAccountSheetProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, toggleLang, theme, toggleTheme, dir } = useThemeLang();
  const isRtl = dir === 'rtl';
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleNavigate = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-h-[88vh] overflow-y-auto bg-white dark:bg-[#120f1d] rounded-t-[32px] border-t border-neutral-200/80 dark:border-[#2a243a] shadow-2xl p-5 pb-8 space-y-5"
          >
            {/* Sheet Handle */}
            <div className="flex justify-center pb-1">
              <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-[#1e192c]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[#8B5CF6] flex items-center justify-center font-bold">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {isRtl ? 'حسابي وإعداداتي' : 'My Account & Settings'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    {user
                      ? user.email || (isRtl ? 'عميل كونسيرج' : 'Concierge Member')
                      : isRtl
                      ? 'مرحباً بك كزائر'
                      : 'Welcome Guest'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#1c172a] text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title={isRtl ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Card or Guest Login Prompt */}
            {user ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-pink-50/40 dark:from-[#1b152b] dark:via-[#141021] dark:to-[#1d122b] border border-purple-200/70 dark:border-[#2f2545] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                      alt={user.name}
                      className="w-13 h-13 rounded-2xl object-cover ring-2 ring-[#8B5CF6]/40 shadow-sm"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#120f1d] flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
                        {user.name}
                      </h4>
                      {user.role === 'admin' ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-800">
                          Admin
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                          {isRtl ? 'عميل معتمد' : 'Verified'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      {user.email}
                    </p>
                    {user.phone && (
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                        📞 {user.phone}
                      </p>
                    )}
                    {user.address && (
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium truncate max-w-[220px]">
                        📍 {user.address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-100 dark:border-purple-900/40">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenProfile?.();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-100/90 dark:bg-purple-950/70 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-[#7C3AED] dark:text-purple-300 text-xs font-black border border-purple-200 dark:border-purple-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'عرض وتعديل بيانات الحساب والعنوان' : 'View & Edit Profile / Address'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181326] border border-neutral-200/70 dark:border-[#29223b] text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center">
                  <LogIn className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                    {isRtl ? 'سجل دخولك لتتبع طلباتك' : 'Sign in to track orders'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isRtl
                      ? 'يمكنك حفظ سلاتك المستخرجة ومتابعة فحص المقاسات وحالة الشحن.'
                      : 'Save your extracted carts and track sizes & shipping updates.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-xs font-black shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isRtl ? 'تسجيل الدخول / إنشاء حساب' : 'Sign In / Register'}</span>
                </button>
              </div>
            )}

            {/* Quick Actions List */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                {isRtl ? 'روابط التنقل السريع' : 'Quick Navigation'}
              </span>

              {/* Home / Extract Cart */}
              <button
                onClick={() => handleNavigate('/')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-50/70 dark:bg-[#161224] hover:bg-neutral-100 dark:hover:bg-[#1f1932] border border-neutral-200/50 dark:border-[#261f38] transition-colors text-start cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-[#8B5CF6] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                      {isRtl ? 'الرئيسية • استخراج السلة' : 'Home • Extract Cart'}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {isRtl ? 'لصق روابط شي إن وحساب الإجمالي' : 'Paste SHEIN links & compute cash'}
                    </div>
                  </div>
                </div>
                <Chevron className="w-4 h-4 text-neutral-400" />
              </button>

              {/* My Orders */}
              <button
                onClick={() => handleNavigate('/orders')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-50/70 dark:bg-[#161224] hover:bg-neutral-100 dark:hover:bg-[#1f1932] border border-neutral-200/50 dark:border-[#261f38] transition-colors text-start cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                      {isRtl ? 'طلباتي وشحناتي' : 'My Orders & Shipments'}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {isRtl ? 'تتبع حالة المراجعة والدفع والتوصيل' : 'Track review, payment & delivery'}
                    </div>
                  </div>
                </div>
                <Chevron className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Support Contact */}
              <button
                onClick={() => {
                  onClose();
                  onOpenSupport();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-50/70 dark:bg-[#161224] hover:bg-neutral-100 dark:hover:bg-[#1f1932] border border-neutral-200/50 dark:border-[#261f38] transition-colors text-start cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                      {isRtl ? 'خدمة العملاء والدعم الفني' : 'Customer Support & Hotline'}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {isRtl ? 'محادثة واتساب، الهاتف، وإنستاباي' : 'WhatsApp, Phone & InstaPay help'}
                    </div>
                  </div>
                </div>
                <Chevron className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Admin Panel Links (if Admin) */}
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => handleNavigate('/admin')}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/60 transition-colors text-start cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                          {isRtl ? 'إدارة الطلبات والعمليات (المشرف)' : 'Admin Operations Control'}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {isRtl ? 'مراجعة الأسعار وتسعير الطلبات' : 'Review & approve customer carts'}
                        </div>
                      </div>
                    </div>
                    <Chevron className="w-4 h-4 text-purple-600" />
                  </button>

                  <button
                    onClick={() => handleNavigate('/admin/analytics')}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/60 transition-colors text-start cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                          {isRtl ? 'إحصائيات الأرباح والمبيعات' : 'Revenue & Sales Analytics'}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {isRtl ? 'تحليل الأرباح ومعدل التحويل' : 'Track net margins and conversion'}
                        </div>
                      </div>
                    </div>
                    <Chevron className="w-4 h-4 text-purple-600" />
                  </button>
                </>
              )}
            </div>

            {/* App Preferences (Language & Theme) */}
            <div className="pt-2 border-t border-neutral-100 dark:border-[#1e192c] space-y-2">
              <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                {isRtl ? 'المظهر واللغة' : 'Appearance & Language'}
              </span>

              <div className="grid grid-cols-2 gap-2">
                {/* Language Switch */}
                <button
                  onClick={toggleLang}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/80 dark:bg-[#1a1528] border border-neutral-200/60 dark:border-[#2a243a] text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#8B5CF6]" />
                    <span>{isRtl ? 'اللغة' : 'Language'}</span>
                  </div>
                  <span className="text-[11px] font-black text-[#8B5CF6] uppercase">
                    {lang === 'ar' ? 'English' : 'عربي'}
                  </span>
                </button>

                {/* Theme Switch */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/80 dark:bg-[#1a1528] border border-neutral-200/60 dark:border-[#2a243a] text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-neutral-700" />
                    )}
                    <span>{isRtl ? 'المظهر' : 'Theme'}</span>
                  </div>
                  <span className="text-[11px] font-medium text-neutral-500">
                    {theme === 'dark'
                      ? isRtl
                        ? 'داكن'
                        : 'Dark'
                      : isRtl
                      ? 'فاتح'
                      : 'Light'}
                  </span>
                </button>
              </div>
            </div>

            {/* Logout button (if logged in) */}
            {user && (
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-black border border-rose-200/70 dark:border-rose-900/60 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isRtl ? 'تسجيل الخروج من الحساب' : 'Sign Out of Account'}</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
