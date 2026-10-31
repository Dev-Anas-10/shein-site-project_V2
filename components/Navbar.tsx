'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { SupportModal } from './SupportModal';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileAccountSheet } from './MobileAccountSheet';
import { UserProfileModal } from './UserProfileModal';
import {
  ShoppingBag,
  ShieldCheck,
  LogOut,
  LogIn,
  Plus,
  Headphones,
  Sun,
  Moon,
  Globe,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export function Navbar({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, theme, toggleTheme } = useThemeLang();
  const [supportOpen, setSupportOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isStaging, setIsStaging] = useState(false);

  React.useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('staging') ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview')
    ) {
      setIsStaging(true);
    }
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-40 w-full bg-white/85 dark:bg-[#0e0c14]/85 backdrop-blur-xl border-b border-neutral-100/80 dark:border-[#231e30] transition-colors"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          {/* Brand Logo: Links to /admin for Admins, / for Customers */}
          <Link href={user?.role === 'admin' ? '/admin' : '/'} className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <motion.div
              whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] via-[#A855F7] to-[#C084FC] text-white flex items-center justify-center font-black text-base sm:text-lg shadow-md shadow-purple-500/25 shrink-0"
            >
              S
            </motion.div>
            <div>
              <div className="font-extrabold text-neutral-900 dark:text-white tracking-tight text-sm sm:text-base flex items-center gap-1.5 leading-none">
                SHEIN <span className="text-[#8B5CF6] font-bold">Concierge</span>
                {isStaging && (
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[8px] sm:text-[9px] font-black text-amber-800 dark:text-amber-300 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    STAGING
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-500 font-medium tracking-tight mt-0.5">
                {user?.role === 'admin'
                  ? (lang === 'ar' ? 'لوحة تحكم وإدارة المشرف' : 'Admin Operations Control')
                  : t.brandSubtitle}
              </p>
            </div>
          </Link>

          {/* Center Pill Nav for Desktop */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-neutral-100/80 dark:bg-[#1a1625] rounded-full border border-neutral-200/60 dark:border-[#2a243a] shadow-xs">
            {user?.role === 'admin' ? (
              <>
                <Link
                  href="/admin"
                  className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    pathname === '/admin'
                      ? 'text-white'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  {pathname === '/admin' && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-[#8B5CF6] rounded-full shadow-xs"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إدارة الطلبات' : 'Customer Orders'}</span>
                  </span>
                </Link>

                <Link
                  href="/admin/analytics"
                  className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    pathname.startsWith('/admin/analytics')
                      ? 'text-white'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  {pathname.startsWith('/admin/analytics') && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-[#8B5CF6] rounded-full shadow-xs"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'الإحصائيات والتحليلات' : 'Analytics & Revenue'}</span>
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    pathname === '/'
                      ? 'text-neutral-950 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {pathname === '/' && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-white dark:bg-[#2b243b] rounded-full shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t.extractCart}</span>
                </Link>

                <Link
                  href="/orders"
                  className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    pathname.startsWith('/orders')
                      ? 'text-neutral-950 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {pathname.startsWith('/orders') && (
                    <motion.span
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-white dark:bg-[#2b243b] rounded-full shadow-xs border border-black/[0.04] dark:border-white/[0.06]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t.myOrders}</span>
                </Link>
              </>
            )}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Language Switcher (Ar / En) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLang}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-extrabold bg-neutral-100 dark:bg-[#1f1a2a] hover:bg-neutral-200/80 dark:hover:bg-[#2a243a] text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer border border-neutral-200/60 dark:border-[#2a243a]"
              title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
            >
              <Globe className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="text-[11px] sm:text-xs">{lang === 'ar' ? 'English' : 'عربي'}</span>
            </motion.button>

            {/* Dark / Light Mode Switcher */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={toggleTheme}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-100 dark:bg-[#1f1a2a] hover:bg-neutral-200/80 dark:hover:bg-[#2a243a] text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition-colors cursor-pointer border border-neutral-200/60 dark:border-[#2a243a]"
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-700" />
              )}
            </motion.button>

            {/* New Order Button (Hidden for Admins, visible on md+) */}
            {user?.role !== 'admin' && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="hidden md:block">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#F5EDFF] dark:bg-purple-950/40 hover:bg-[#E9D5FF] dark:hover:bg-purple-900/40 text-[#7C3AED] dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.newOrder}</span>
                </Link>
              </motion.div>
            )}

            {/* Support Contact Button (Desktop) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSupportOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-50 dark:bg-[#181422] hover:bg-neutral-100 dark:hover:bg-[#221c2f] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-[#2a243a] transition-colors cursor-pointer"
              title={t.support}
            >
              <Headphones className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="hidden lg:inline">{t.support}</span>
            </motion.button>

            {/* User Session Profile Chip */}
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setProfileOpen(true)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 bg-neutral-50 dark:bg-[#181422] hover:bg-purple-50 dark:hover:bg-[#221c2f] rounded-full border border-neutral-200/60 dark:border-[#2a243a] transition-colors cursor-pointer group"
                  title={user.name}
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                    alt={user.name}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-purple-300"
                  />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 max-w-[70px] sm:max-w-[110px] truncate inline-block">
                    {user.name.split(' ')[0]}
                  </span>
                  {user.role === 'admin' && (
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#7C3AED] dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 rounded-full">
                      Admin
                    </span>
                  )}
                </motion.button>

                {/* Quick Logout for Desktop */}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={logout}
                  className="hidden md:flex w-8 h-8 rounded-full border border-neutral-200/80 dark:border-[#2a243a] items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#221c2f] transition-colors cursor-pointer"
                  title={t.signOut}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 8px 20px -4px rgba(139, 92, 246, 0.4)' }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenAuth}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-extrabold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-sm shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.signIn}</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        onOpenSupport={() => setSupportOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenAuth={onOpenAuth}
      />

      {/* Mobile User Profile & Settings Drawer / Sheet */}
      <MobileAccountSheet
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        onOpenSupport={() => setSupportOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenAuth={() => {
          setAccountOpen(false);
          onOpenAuth?.();
        }}
      />

      {/* Customer Profile & Address Management Modal (Desktop & Mobile) */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenSupport={() => setSupportOpen(true)}
      />

      {/* Support Contact Modal */}
      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
