'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Order, SystemSettings, User } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import {
  TrendingUp,
  CreditCard,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileCheck,
  Users,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  DollarSign,
  Package,
  Calendar,
  Percent,
  CheckCheck,
  Printer,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

function formatLastSeen(dateString?: string, isRtl = true): { label: string; isOnline: boolean } {
  if (!dateString) return { label: isRtl ? 'لم يسجل دخول بعد' : 'Never logged in', isOnline: false };
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 15) {
    return { label: isRtl ? 'متصل الآن' : 'Online Now', isOnline: true };
  }
  if (diffMin < 60) {
    return { label: isRtl ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`, isOnline: false };
  }
  if (diffHours < 24) {
    return { label: isRtl ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`, isOnline: false };
  }
  if (diffDays === 1) {
    return { label: isRtl ? 'أمس' : 'Yesterday', isOnline: false };
  }
  if (diffDays < 7) {
    return { label: isRtl ? `منذ ${diffDays} أيام` : `${diffDays}d ago`, isOnline: false };
  }
  return { label: new Date(dateString).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US'), isOnline: false };
}

export default function AdminAnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { dir, lang } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [orders, setOrders] = useState<Order[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes, usersRes] = await Promise.all([
        fetch('/api/orders?admin=true'),
        fetch('/api/settings'),
        fetch('/api/users'),
      ]);

      const ordersJson = await ordersRes.json();
      const settingsJson = await settingsRes.json();
      const usersJson = await usersRes.json();

      if (ordersJson.success) setOrders(ordersJson.data);
      if (settingsJson.success) setSettings(settingsJson.data);
      if (usersJson.success) setRegisteredUsers(usersJson.data);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
    if (timeRange === 'all') return orders;
    const now = Date.now();
    const days = timeRange === '30d' ? 30 : 7;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  }, [orders, timeRange]);

  // Calculations
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const nonRejectedOrders = filteredOrders.filter((o) => o.status !== 'REJECTED');
    const paidOrDoneOrders = filteredOrders.filter((o) =>
      ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status)
    );

    // Financials
    const totalGmv = nonRejectedOrders.reduce((sum, o) => sum + (o.totalCash || 0), 0);
    const totalCommission = nonRejectedOrders.reduce((sum, o) => sum + (o.dynamicFeeAmount || 0), 0);
    const totalPaidGmv = paidOrDoneOrders.reduce((sum, o) => sum + (o.totalCash || 0), 0);
    const totalPaidCommission = paidOrDoneOrders.reduce((sum, o) => sum + (o.dynamicFeeAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalGmv / (nonRejectedOrders.length || 1)) : 0;

    // Items
    const totalItems = nonRejectedOrders.reduce((sum, o) => sum + (o.itemsCount || o.items?.length || 0), 0);
    const avgItemsPerOrder = nonRejectedOrders.length > 0 ? (totalItems / nonRejectedOrders.length).toFixed(1) : '0';

    // Status breakdown
    const pendingReview = filteredOrders.filter((o) => o.status === 'PENDING_APPROVAL').length;
    const awaitingPayment = filteredOrders.filter((o) => o.status === 'APPROVED_PENDING_PAYMENT').length;
    const paymentReview = filteredOrders.filter((o) => o.status === 'PAYMENT_UNDER_REVIEW').length;
    const paidAndFulfillment = filteredOrders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED'].includes(o.status)).length;
    const completed = filteredOrders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').length;
    const rejected = filteredOrders.filter((o) => o.status === 'REJECTED').length;

    // Payment methods
    const instapayOrders = filteredOrders.filter((o) => o.payment?.method === 'instapay');
    const vodafoneOrders = filteredOrders.filter((o) => o.payment?.method === 'vodafone_cash');
    const instapayVolume = instapayOrders.reduce((sum, o) => sum + (o.totalCash || 0), 0);
    const vodafoneVolume = vodafoneOrders.reduce((sum, o) => sum + (o.totalCash || 0), 0);

    // Customer aggregation
    const customerMap = new Map<
      string,
      { name: string; email: string; phone: string; count: number; totalSpent: number; lastOrder: string }
    >();

    filteredOrders.forEach((o) => {
      const key = (o.userEmail || o.userPhone || o.userName || 'unknown').toLowerCase();
      const existing = customerMap.get(key) || {
        name: o.userName || 'Customer',
        email: o.userEmail || '-',
        phone: o.userPhone || '-',
        count: 0,
        totalSpent: 0,
        lastOrder: o.createdAt,
      };

      existing.count += 1;
      if (o.status !== 'REJECTED') {
        existing.totalSpent += o.totalCash || 0;
      }
      if (new Date(o.createdAt).getTime() > new Date(existing.lastOrder).getTime()) {
        existing.lastOrder = o.createdAt;
      }

      customerMap.set(key, existing);
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    const conversionRate = totalOrders > 0 ? Math.round((paidOrDoneOrders.length / totalOrders) * 100) : 0;

    return {
      totalOrders,
      totalGmv,
      totalCommission,
      totalPaidGmv,
      totalPaidCommission,
      averageOrderValue,
      totalItems,
      avgItemsPerOrder,
      pendingReview,
      awaitingPayment,
      paymentReview,
      paidAndFulfillment,
      completed,
      rejected,
      instapayOrders: instapayOrders.length,
      instapayVolume,
      vodafoneOrders: vodafoneOrders.length,
      vodafoneVolume,
      topCustomers,
      conversionRate,
      uniqueCustomersCount: registeredUsers.length > 0 ? registeredUsers.length : customerMap.size,
    };
  }, [filteredOrders, registeredUsers]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] flex items-center justify-center">
        <div className="w-9 h-9 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-neutral-100/60 dark:bg-[#0c0a0f] text-neutral-900 dark:text-white">
        <Navbar onOpenAuth={() => setAuthOpen(true)} />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 p-4">
          <div className="p-8 bg-white dark:bg-[#14101e] rounded-3xl border border-neutral-200 dark:border-[#2a243a] shadow-xl text-center max-w-md space-y-4">
            <ShieldCheck className="w-12 h-12 text-rose-600 mx-auto" />
            <h2 className="text-2xl font-black">{isRtl ? 'صلاحيات المشرف مطلوبة' : 'Admin Access Required'}</h2>
            <p className="text-neutral-500 text-xs leading-relaxed">
              {isRtl
                ? 'يرجى تسجيل الدخول بحساب المشرف (Admin) للاطلاع على تحليلات وأرباح المنصة.'
                : 'Please sign in with your supervisor account to view analytics and revenue data.'}
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="w-full py-3 bg-neutral-950 dark:bg-purple-600 hover:bg-neutral-800 text-white font-black rounded-xl text-xs cursor-pointer shadow-md"
            >
              {isRtl ? 'تسجيل دخول المشرف' : 'Sign In as Admin'}
            </button>
          </div>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultRole="admin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white pb-32 md:pb-24 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 bg-gradient-to-b from-purple-400/8 via-pink-400/4 to-transparent dark:from-purple-600/10 dark:via-purple-900/5 dark:to-transparent pointer-events-none blur-3xl -z-10" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-1.5 text-start">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-200/60 dark:border-purple-800/60">
                <TrendingUp className="w-3.5 h-3.5 text-[#8B5CF6]" />
                {isRtl ? 'تحليلات المنصة والأرباح' : 'Business Intelligence Hub'}
              </span>
              <span className="text-[11px] font-mono text-neutral-500 bg-white dark:bg-[#1a1626] px-2.5 py-0.5 rounded-full border border-neutral-200 dark:border-[#2f2742]">
                {isRtl ? 'تحديث فوري' : 'Live Real-time'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-neutral-950 dark:text-white tracking-tight">
              {isRtl ? 'تحليلات مبيعات سلال شي إن' : 'SHEIN Orders & Revenue Intelligence'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
              {isRtl
                ? 'رؤية مالية وتشغيلية شاملة لحجم المبيعات بالجنيه المصري، بوابات الدفع، والعملاء الأكثر طلباً.'
                : 'Complete operational & financial visibility into EGP order volume, dynamic service fees, payment channels, and top client lifetime values.'}
            </p>
          </div>

          {/* Quick Actions & Range Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center p-1 bg-white dark:bg-[#14111d] rounded-2xl border border-neutral-200 dark:border-[#2a243a] shadow-xs text-xs font-bold">
              {[
                { key: 'all', label: isRtl ? 'الكل' : 'All Time' },
                { key: '30d', label: isRtl ? 'آخر 30 يوم' : '30 Days' },
                { key: '7d', label: isRtl ? 'آخر 7 أيام' : '7 Days' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTimeRange(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    timeRange === tab.key
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Link
              href="/admin"
              className="px-4 py-2.5 bg-white dark:bg-[#14111d] hover:bg-neutral-50 dark:hover:bg-[#1d1829] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#2a243a] rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>{isRtl ? 'إدارة الطلبات' : 'Orders Hub'}</span>
            </Link>

            <button
              onClick={fetchData}
              className="p-2.5 bg-white dark:bg-[#14111d] hover:bg-neutral-50 dark:hover:bg-[#1d1829] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-[#2a243a] rounded-2xl transition-all shadow-xs cursor-pointer"
              title={isRtl ? 'تحديث البيانات' : 'Refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 6 Key Financial & Operational Metric Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-6 gap-4"
        >
          {/* 1. Gross Volume */}
          <motion.div
            variants={itemVariants}
            className="col-span-2 bg-gradient-to-br from-purple-500 via-[#7C3AED] to-[#6D28D9] text-white p-6 rounded-3xl shadow-xl shadow-purple-500/20 relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-purple-200 text-xs font-bold mb-2">
              <span>{isRtl ? 'إجمالي حجم المبيعات (GMV)' : 'Gross Merchandise Value'}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">EGP</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight">
              {stats.totalGmv.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
            </div>
            <p className="text-[11px] text-purple-200 mt-2 font-medium">
              {isRtl
                ? `منها ${stats.totalPaidGmv.toLocaleString()} ج.م مدفوعة ومؤكدة`
                : `${stats.totalPaidGmv.toLocaleString()} EGP paid & verified`}
            </p>
          </motion.div>

          {/* 2. Platform Commission */}
          <motion.div
            variants={itemVariants}
            className="col-span-2 bg-white dark:bg-[#14111d] p-6 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs hover:shadow-md transition-shadow text-start"
          >
            <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 text-xs font-bold mb-2">
              <span>{isRtl ? 'أرباح ورسوم الخدمة' : 'Net Dynamic Commission'}</span>
              <Percent className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.totalCommission.toLocaleString()} <span className="text-xs font-bold text-neutral-400">ج.م</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
              {isRtl
                ? `${stats.totalPaidCommission.toLocaleString()} ج.م محصلة بالفعل`
                : `${stats.totalPaidCommission.toLocaleString()} EGP collected & fulfilled`}
            </p>
          </motion.div>

          {/* 3. Total Orders */}
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs text-start"
          >
            <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 text-xs font-bold mb-2">
              <span>{isRtl ? 'إجمالي الطلبات' : 'Total Orders'}</span>
              <Package className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-950 dark:text-white">
              {stats.totalOrders}
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-1">
              {stats.conversionRate}% {isRtl ? 'نسبة التحويل' : 'Conversion'}
            </div>
          </motion.div>

          {/* 4. Average Order Value */}
          <motion.div
            variants={itemVariants}
            className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs text-start"
          >
            <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 text-xs font-bold mb-2">
              <span>{isRtl ? 'متوسط السلة (AOV)' : 'Avg Order Value'}</span>
              <ShoppingBag className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-950 dark:text-white">
              {stats.averageOrderValue.toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {stats.avgItemsPerOrder} {isRtl ? 'قطع لكل سلة' : 'items / cart'}
            </div>
          </motion.div>
        </motion.div>

        {/* Status Pipeline & Payment Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Lifecycle Pipeline */}
          <div className="lg:col-span-2 bg-white dark:bg-[#14111d] p-6 sm:p-7 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-6 text-start">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-neutral-950 dark:text-white">
                  {isRtl ? 'مسار دورة حياة الطلبات (Order Lifecycle Funnel)' : 'Order Lifecycle Funnel'}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isRtl ? 'متابعة أداء السلال من لحظة الاستخراج حتى التسليم' : 'Status progression from cart extraction to delivery'}
                </p>
              </div>
              <span className="text-xs font-bold text-neutral-400">
                {stats.totalOrders} {isRtl ? 'طلب كلي' : 'orders'}
              </span>
            </div>

            {/* Pipeline Visual Bar */}
            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-[#1f1a2c] overflow-hidden flex">
              {stats.totalOrders > 0 && (
                <>
                  <div
                    style={{ width: `${(stats.pendingReview / stats.totalOrders) * 100}%` }}
                    className="bg-amber-400 h-full transition-all"
                    title={`Pending Review: ${stats.pendingReview}`}
                  />
                  <div
                    style={{ width: `${(stats.awaitingPayment / stats.totalOrders) * 100}%` }}
                    className="bg-blue-500 h-full transition-all"
                    title={`Awaiting Payment: ${stats.awaitingPayment}`}
                  />
                  <div
                    style={{ width: `${(stats.paymentReview / stats.totalOrders) * 100}%` }}
                    className="bg-purple-500 h-full transition-all"
                    title={`Receipt Review: ${stats.paymentReview}`}
                  />
                  <div
                    style={{ width: `${(stats.paidAndFulfillment / stats.totalOrders) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Paid: ${stats.paidAndFulfillment}`}
                  />
                  <div
                    style={{ width: `${(stats.completed / stats.totalOrders) * 100}%` }}
                    className="bg-neutral-800 dark:bg-neutral-300 h-full transition-all"
                    title={`Completed: ${stats.completed}`}
                  />
                  <div
                    style={{ width: `${(stats.rejected / stats.totalOrders) * 100}%` }}
                    className="bg-rose-500 h-full transition-all"
                    title={`Rejected: ${stats.rejected}`}
                  />
                </>
              )}
            </div>

            {/* Status Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'قيد مراجعة المشرف' : 'Pending Review'}</span>
                </div>
                <div className="text-xl font-black text-amber-900 dark:text-amber-200 mt-1">
                  {stats.pendingReview}
                </div>
                <p className="text-[10px] text-amber-700/80 mt-0.5">{isRtl ? 'تحتاج تأكيد الأسعار' : 'Awaiting pricing check'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-bold text-xs">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'بانتظار سداد العميل' : 'Awaiting Payment'}</span>
                </div>
                <div className="text-xl font-black text-blue-900 dark:text-blue-200 mt-1">
                  {stats.awaitingPayment}
                </div>
                <p className="text-[10px] text-blue-700/80 mt-0.5">{isRtl ? 'تمت الموافقة للعميل' : 'Customer notified'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-bold text-xs">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'فحص إيصال التحويل' : 'Verify Receipt'}</span>
                </div>
                <div className="text-xl font-black text-purple-900 dark:text-purple-200 mt-1">
                  {stats.paymentReview}
                </div>
                <p className="text-[10px] text-purple-700/80 mt-0.5">{isRtl ? 'تم رفع سكرين التحويل' : 'Uploaded screenshot'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مدفوع وجاري الشراء' : 'Paid & Processing'}</span>
                </div>
                <div className="text-xl font-black text-emerald-900 dark:text-emerald-200 mt-1">
                  {stats.paidAndFulfillment}
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-0.5">{isRtl ? 'تم التحقق من المبلغ' : 'Confirmed funds'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-[#1c1827] border border-neutral-200 dark:border-[#2f2742]">
                <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-bold text-xs">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مكتمل ومسلّم' : 'Completed'}</span>
                </div>
                <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                  {stats.completed}
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">{isRtl ? 'وصل لباب البيت' : 'Delivered to door'}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مرفوض / ملغي' : 'Rejected'}</span>
                </div>
                <div className="text-xl font-black text-rose-900 dark:text-rose-200 mt-1">
                  {stats.rejected}
                </div>
                <p className="text-[10px] text-rose-700/80 mt-0.5">{isRtl ? 'نفاد كمية أو إلغاء' : 'Out of stock or cancelled'}</p>
              </div>
            </div>
          </div>

          {/* Payment Methods Distribution */}
          <div className="bg-white dark:bg-[#14111d] p-6 sm:p-7 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-6 text-start">
            <div>
              <h3 className="text-lg font-black text-neutral-950 dark:text-white">
                {isRtl ? 'توزيع بوابات الدفع (Egypt)' : 'Payment Methods Share'}
              </h3>
              <p className="text-xs text-neutral-400">
                {isRtl ? 'حجم المعاملات عبر إنستاباي ومحافظ الكاش' : 'Transaction split across InstaPay vs Vodafone Cash'}
              </p>
            </div>

            <div className="space-y-4">
              {/* InstaPay */}
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1a1626] p-1 border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0">
                      <img src="/images/instapay.png" alt="InstaPay" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-neutral-900 dark:text-white">InstaPay (إنستاباي)</h4>
                      <span className="text-[10px] text-neutral-400">{stats.instapayOrders} {isRtl ? 'طلب مسدد' : 'orders'}</span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-sm text-purple-700 dark:text-purple-300">
                    {stats.instapayVolume.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-purple-200/60 dark:bg-purple-900/40 overflow-hidden">
                  <div
                    style={{
                      width: `${stats.totalGmv > 0 ? (stats.instapayVolume / stats.totalGmv) * 100 : 0}%`,
                    }}
                    className="h-full bg-purple-600 rounded-full"
                  />
                </div>
              </div>

              {/* Vodafone Cash */}
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1a1626] p-0.5 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                      <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-neutral-900 dark:text-white">فودافون كاش ومحافظ المحمول</h4>
                      <span className="text-[10px] text-neutral-400">{stats.vodafoneOrders} {isRtl ? 'طلب مسدد' : 'orders'}</span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-sm text-rose-700 dark:text-rose-300">
                    {stats.vodafoneVolume.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-rose-200/60 dark:bg-rose-900/40 overflow-hidden">
                  <div
                    style={{
                      width: `${stats.totalGmv > 0 ? (stats.vodafoneVolume / stats.totalGmv) * 100 : 0}%`,
                    }}
                    className="h-full bg-rose-600 rounded-full"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#1a1626] rounded-2xl border border-neutral-200 dark:border-[#2f2742] flex items-center justify-between text-xs font-bold">
              <span className="text-neutral-500">{isRtl ? 'العملاء الفريدين المسجلين' : 'Unique Customer Base'}</span>
              <span className="font-black text-neutral-950 dark:text-white font-mono">{stats.uniqueCustomersCount}</span>
            </div>
          </div>
        </div>

        {/* Top Customers Leaderboard */}
        <div className="bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs overflow-hidden text-start">
          <div className="p-6 border-b border-neutral-100 dark:border-[#241e33] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-neutral-950 dark:text-white">
                {isRtl ? 'قائمة العملاء الأكثر طلباً (Top Customer Leaderboard)' : 'Top Customer Leaderboard'}
              </h3>
              <p className="text-xs text-neutral-400">
                {isRtl ? 'أعلى العملاء من حيث إجمالي الإنفاق وتكرار الطلبات' : 'Highest lifetime spend and cart submissions'}
              </p>
            </div>
            <Users className="w-5 h-5 text-purple-600" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-[#1a1626] border-b border-neutral-200 dark:border-[#2a243a] text-[11px] font-black uppercase tracking-wider text-neutral-500">
                  <th className="py-3.5 px-6">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'الهاتف' : 'Phone'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'عدد الطلبات' : 'Orders Count'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'إجمالي المشتريات (LTV)' : 'Total Spend'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'آخر طلب' : 'Last Active'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#221c2e]">
                {stats.topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400 font-bold">
                      {isRtl ? 'لا توجد بيانات عملاء كافية حتى الآن' : 'No customer records yet'}
                    </td>
                  </tr>
                ) : (
                  stats.topCustomers.map((c, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-[#1a1626]/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/60 text-[#7C3AED] dark:text-purple-300 flex items-center justify-center font-mono text-[10px] font-black">
                          {i + 1}
                        </span>
                        <div>
                          <div>{c.name}</div>
                          <div className="text-[10px] text-neutral-400 font-normal">{c.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-neutral-600 dark:text-neutral-300" dir="ltr">
                        {c.phone}
                      </td>
                      <td className="py-4 px-6 font-black text-neutral-900 dark:text-white">
                        {c.count} {isRtl ? 'طلبات' : 'orders'}
                      </td>
                      <td className="py-4 px-6 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {c.totalSpent.toLocaleString()} ج.م
                      </td>
                      <td className="py-4 px-6 text-neutral-500 text-[11px]">
                        {new Date(c.lastOrder).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Directory & Last Login Activity */}
        <div className="bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs overflow-hidden text-start">
          <div className="p-6 border-b border-neutral-100 dark:border-[#241e33] flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-neutral-950 dark:text-white flex items-center gap-2">
                <span>{isRtl ? 'سجل تواجد ونشاط العملاء' : 'Customer Activity & Last Seen'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 font-mono font-bold">
                  {registeredUsers.length} {isRtl ? 'حساب مسجل' : 'Registered Users'}
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                {isRtl ? 'تتبع لحظي لآخر توقيت دخول لكل عميل مسجل وتاريخ إنشائه' : 'Real-time tracking of when each customer was last active'}
              </p>
            </div>
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-[#1a1626] border-b border-neutral-200 dark:border-[#2a243a] text-[11px] font-black uppercase tracking-wider text-neutral-500">
                  <th className="py-3.5 px-6">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'الرتبة' : 'Role'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'تاريخ التسجيل' : 'Joined'}</th>
                  <th className="py-3.5 px-6">{isRtl ? 'آخر ظهور / تسجيل دخول' : 'Last Active / Login'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#221c2e]">
                {registeredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400 font-bold">
                      {isRtl ? 'جاري تحميل سجل المستخدمين...' : 'Loading registered users...'}
                    </td>
                  </tr>
                ) : (
                  registeredUsers.map((u) => {
                    const lastSeen = formatLastSeen(u.lastLoginAt, isRtl);
                    return (
                      <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-[#1a1626]/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 object-cover border border-neutral-200 dark:border-neutral-700" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                              {u.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold">{u.name}</div>
                            <div className="text-[10px] text-neutral-400 font-normal">{u.email}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}>
                            {u.role === 'admin' ? (isRtl ? 'مشرف' : 'Admin') : (isRtl ? 'عميل' : 'Customer')}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-neutral-600 dark:text-neutral-300" dir="ltr">
                          {u.phone || '-'}
                        </td>
                        <td className="py-4 px-6 text-neutral-500 text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            lastSeen.isOnline
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}>
                            {lastSeen.isOnline && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            {lastSeen.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultRole="admin" />
    </div>
  );
}
