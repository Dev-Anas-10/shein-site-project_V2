'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { getClientOrders } from '@/lib/order-storage';
import {
  Sparkles,
  ShoppingBag,
  Package,
  Plus,
  Headphones,
  User as UserIcon,
  LogIn,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenSupport: () => void;
  onOpenAccount: () => void;
  onOpenAuth?: () => void;
}

export function MobileBottomNav({
  onOpenSupport,
  onOpenAccount,
  onOpenAuth,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { lang, dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [orderCount, setOrderCount] = useState<number>(0);

  // Read orders count for badge
  useEffect(() => {
    if (user?.id) {
      try {
        const clientOrders = getClientOrders(user.id, user.email);
        setOrderCount(clientOrders.length);
      } catch {
        setOrderCount(0);
      }
    } else {
      setOrderCount(0);
    }
  }, [user, pathname]);

  const handleNewOrderClick = () => {
    if (pathname === '/') {
      const el = document.getElementById('cart-extractor-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const textarea = el.querySelector('textarea');
        if (textarea) {
          setTimeout(() => textarea.focus(), 400);
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      router.push('/?action=new');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/92 dark:bg-[#0e0c14]/92 backdrop-blur-2xl border-t border-neutral-200/80 dark:border-[#231e30] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1.5 px-2"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-end justify-items-center">
        {isAdmin ? (
          /* ================= ADMIN MOBILE TABS ================= */
          <>
            {/* Tab 1: Admin Orders */}
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors ${
                pathname === '/admin'
                  ? 'text-[#8B5CF6] dark:text-[#A78BFA] font-black'
                  : 'text-neutral-500 dark:text-neutral-400 font-semibold'
              }`}
            >
              <div className="relative">
                <ShieldCheck className="w-5 h-5 mb-0.5" />
                {pathname === '/admin' && (
                  <motion.span
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'الطلبات' : 'Orders'}
              </span>
            </Link>

            {/* Tab 2: Admin Analytics */}
            <Link
              href="/admin/analytics"
              className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors ${
                pathname.startsWith('/admin/analytics')
                  ? 'text-[#8B5CF6] dark:text-[#A78BFA] font-black'
                  : 'text-neutral-500 dark:text-neutral-400 font-semibold'
              }`}
            >
              <div className="relative">
                <TrendingUp className="w-5 h-5 mb-0.5" />
                {pathname.startsWith('/admin/analytics') && (
                  <motion.span
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'التحليلات' : 'Analytics'}
              </span>
            </Link>

            {/* Tab 3: Storefront Preview (Center Hero) */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push('/')}
              className="flex flex-col items-center -mt-4 cursor-pointer group"
              title={isRtl ? 'معاينة واجهة العميل' : 'Storefront Preview'}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] text-white flex items-center justify-center shadow-lg shadow-purple-500/35 ring-4 ring-white dark:ring-[#0e0c14] transition-transform group-hover:scale-105">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 mt-1">
                {isRtl ? 'المتجر' : 'Store'}
              </span>
            </motion.button>

            {/* Tab 4: Support */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onOpenSupport}
              className="flex flex-col items-center justify-center w-full py-1 text-center text-neutral-500 dark:text-neutral-400 font-semibold transition-colors cursor-pointer"
            >
              <Headphones className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'الدعم' : 'Support'}
              </span>
            </motion.button>

            {/* Tab 5: Admin Account */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onOpenAccount}
              className="flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer text-purple-700 dark:text-purple-300 font-bold"
            >
              <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-[#8B5CF6] flex items-center justify-center mb-0.5 ring-1 ring-purple-300">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'المشرف' : 'Admin'}
              </span>
            </motion.button>
          </>
        ) : (
          /* ================= CUSTOMER MOBILE TABS ================= */
          <>
            {/* Tab 1: Home / Extract Cart */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors ${
                pathname === '/'
                  ? 'text-[#8B5CF6] dark:text-[#A78BFA] font-black'
                  : 'text-neutral-500 dark:text-neutral-400 font-semibold'
              }`}
            >
              <div className="relative">
                <Sparkles className="w-5 h-5 mb-0.5" />
                {pathname === '/' && (
                  <motion.span
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'الرئيسية' : 'Home'}
              </span>
            </Link>

            {/* Tab 2: My Orders */}
            <Link
              href="/orders"
              className={`flex flex-col items-center justify-center w-full py-1 text-center transition-colors ${
                pathname.startsWith('/orders')
                  ? 'text-[#8B5CF6] dark:text-[#A78BFA] font-black'
                  : 'text-neutral-500 dark:text-neutral-400 font-semibold'
              }`}
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5 mb-0.5" />
                {orderCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[#8B5CF6] text-white text-[9px] font-black flex items-center justify-center tabular-nums shadow-xs">
                    {orderCount}
                  </span>
                )}
                {pathname.startsWith('/orders') && (
                  <motion.span
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'طلباتي' : 'Orders'}
              </span>
            </Link>

            {/* Tab 3: Hero Action (+ طلب جديد) */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleNewOrderClick}
              className="flex flex-col items-center -mt-4 cursor-pointer group"
              title={isRtl ? 'طلب جديد - استخراج سلة شي إن' : 'New Order - Extract Cart'}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] text-white flex items-center justify-center shadow-lg shadow-purple-500/35 ring-4 ring-white dark:ring-[#0e0c14] transition-transform group-hover:scale-105">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 mt-1">
                {isRtl ? 'طلب جديد' : 'New Order'}
              </span>
            </motion.button>

            {/* Tab 4: Support */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onOpenSupport}
              className="flex flex-col items-center justify-center w-full py-1 text-center text-neutral-500 dark:text-neutral-400 font-semibold transition-colors cursor-pointer"
            >
              <Headphones className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight leading-tight">
                {isRtl ? 'الدعم' : 'Support'}
              </span>
            </motion.button>

            {/* Tab 5: My Account / Login */}
            {user ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onOpenAccount}
                className="flex flex-col items-center justify-center w-full py-1 text-center transition-colors cursor-pointer"
              >
                <div className="relative mb-0.5">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                    alt={user.name}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-[#8B5CF6]"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-[#0e0c14]" />
                </div>
                <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 tracking-tight leading-tight max-w-[50px] truncate">
                  {user.name.split(' ')[0]}
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (onOpenAuth) onOpenAuth();
                  else onOpenAccount();
                }}
                className="flex flex-col items-center justify-center w-full py-1 text-center text-neutral-500 dark:text-neutral-400 font-semibold transition-colors cursor-pointer"
              >
                <LogIn className="w-5 h-5 mb-0.5 text-[#8B5CF6]" />
                <span className="text-[10px] tracking-tight leading-tight">
                  {isRtl ? 'دخول' : 'Sign In'}
                </span>
              </motion.button>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
