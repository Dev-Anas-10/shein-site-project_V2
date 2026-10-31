'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { Order } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { SafeImage } from '@/components/SafeImage';
import {
  getClientOrders,
  mergeAndDeduplicateOrders,
  syncClientOrdersWithServer,
  saveClientOrder,
  removeClientOrder,
} from '@/lib/order-storage';
import { useRealtimeSubscription } from '@/lib/use-realtime';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CreditCard,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Lock,
  User,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';

export default function UserOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, dir } = useThemeLang();
  const [authOpen, setAuthOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => ['PENDING_APPROVAL', 'PAYMENT_UNDER_REVIEW'].includes(o.status)).length,
      awaitingPayment: orders.filter((o) => o.status === 'APPROVED_PENDING_PAYMENT').length,
      paid: orders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
      delivered: orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    if (statusFilter === 'PENDING') {
      return orders.filter((o) => ['PENDING_APPROVAL', 'PAYMENT_UNDER_REVIEW'].includes(o.status));
    }
    if (statusFilter === 'AWAITING_PAYMENT') {
      return orders.filter((o) => o.status === 'APPROVED_PENDING_PAYMENT');
    }
    if (statusFilter === 'PAID') {
      return orders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED'].includes(o.status));
    }
    if (statusFilter === 'DELIVERED') {
      return orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
    }
    if (statusFilter === 'CANCELLED' || statusFilter === 'REJECTED') {
      return orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED');
    }
    return orders;
  }, [orders, statusFilter]);

  useEffect(() => {
    if (user?.role === 'admin') {
      router.replace('/admin');
    }
  }, [user, router]);

  const fetchOrders = async (showLoadingSpinner = false) => {
    // Strict multi-user privacy: Never fetch or show orders if not logged in!
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (showLoadingSpinner || orders.length === 0) {
      setLoading(true);
    }
    const clientSaved = getClientOrders(user.id, user.email);
    try {
      const url = `/api/orders?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || '')}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Server database is the Single Source of Truth
        setOrders(json.data);
        syncClientOrdersWithServer(user.id, user.email, json.data);
      } else {
        setOrders(clientSaved);
      }
    } catch (err) {
      console.warn('API fetch orders error, falling back to client storage:', err);
      setOrders(clientSaved);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchOrdersSilently = React.useCallback(async () => {
    if (!user) return;
    const clientSaved = getClientOrders(user.id, user.email);
    try {
      const url = `/api/orders?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || '')}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const serverData: Order[] = json.data;
        syncClientOrdersWithServer(user.id, user.email, serverData);
        setOrders((prev) => {
          const prevSig = prev.map((o) => `${o.id}:${o.status}:${o.totalCash}:${o.shipmentId || ''}:${o.updatedAt}`).join('|');
          const newSig = serverData.map((o) => `${o.id}:${o.status}:${o.totalCash}:${o.shipmentId || ''}:${o.updatedAt}`).join('|');
          if (prevSig !== newSig) {
            return serverData;
          }
          return prev;
        });
      }
    } catch {
      // background silent poll
    }
  }, [user]);

  // Real-time live updates subscription (Task 14 & 15)
  useRealtimeSubscription({
    channel: 'orders',
    onOrderChange: (incoming) => {
      if (!user) return;
      if (incoming.userId === user.id || incoming.userEmail?.toLowerCase() === user.email?.toLowerCase()) {
        saveClientOrder(incoming);
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === incoming.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = incoming;
            return next;
          }
          return [incoming, ...prev];
        });
      }
    },
    onOrderDelete: (deletedOrderId) => {
      removeClientOrder(deletedOrderId);
      setOrders((prev) => prev.filter((o) => o.id !== deletedOrderId));
    },
    onRefresh: fetchOrdersSilently,
    pollIntervalMs: 5000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            {t.statusPending}
          </span>
        );
      case 'APPROVED_PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-50 dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <CreditCard className="w-3.5 h-3.5" />
            {t.statusApproved}
          </span>
        );
      case 'PAYMENT_UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <FileCheck className="w-3.5 h-3.5" />
            {t.statusPaymentReview}
          </span>
        );
      case 'PAID':
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status === 'PAID' ? t.statusPaid : t.statusProcessing}
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Truck className="w-3.5 h-3.5" />
            {t.statusShipped}
          </span>
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status === 'DELIVERED' ? t.statusDelivered : t.statusCompleted}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            {t.statusCancelled}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            {t.statusRejected}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white pb-32 md:pb-24 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-purple-400/8 to-transparent dark:from-purple-600/10 dark:to-transparent pointer-events-none blur-3xl -z-10" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2"
        >
          <div className="space-y-1 text-center sm:text-start">
            <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
              {t.customerHub}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-neutral-950 dark:text-white tracking-tight">
              {t.myOrdersTitle}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              {t.myOrdersDesc}
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchOrders(false)}
              className="p-3 bg-white/90 dark:bg-[#151120] border border-neutral-200/80 dark:border-[#2a243a] text-neutral-600 dark:text-neutral-300 rounded-2xl hover:bg-neutral-50 dark:hover:bg-[#201a2e] transition-colors shadow-xs cursor-pointer"
              title={t.refresh}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/"
                className="px-5 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white font-black text-xs rounded-2xl shadow-sm transition-all inline-flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t.extractNewCart}</span>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Orders List / Login Gate */}
        <div className="space-y-3.5">
          {!user ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="bg-white/90 dark:bg-[#13101c]/90 backdrop-blur-2xl rounded-[32px] p-10 sm:p-14 text-center border border-neutral-200/70 dark:border-[#2a243a] shadow-xs space-y-6 max-w-lg mx-auto"
            >
              <div className="w-18 h-18 rounded-3xl bg-purple-100/70 dark:bg-purple-950/50 text-[#8B5CF6] flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/70 dark:bg-purple-950/60 text-[#8B5CF6] dark:text-purple-300 text-[11px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t.privacyBadge}</span>
                </div>
                <h3 className="text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
                  {t.loginRequiredTitle}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  {t.loginRequiredDesc}
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setAuthOpen(true)}
                  className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-500/25 transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  <span>{t.signInOrRegister}</span>
                </motion.button>
                <Link
                  href="/"
                  className="w-full sm:w-auto px-6 py-3.5 bg-neutral-100 dark:bg-[#1f1a2c] hover:bg-neutral-200/80 dark:hover:bg-[#2b243b] text-neutral-700 dark:text-neutral-300 rounded-2xl text-xs font-bold transition-all text-center border border-neutral-200/60 dark:border-[#2e263d]"
                >
                  {t.homeBtn}
                </Link>
              </div>
            </motion.div>
          ) : loading ? (
            <div className="bg-white/90 dark:bg-[#13101c]/90 backdrop-blur-md rounded-[32px] p-14 text-center border border-neutral-200/70 dark:border-[#2a243a] shadow-xs text-neutral-500 dark:text-neutral-400">
              <div className="w-8 h-8 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {t.loadingOrders}
              </p>
            </div>
          ) : orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/90 dark:bg-[#13101c]/90 backdrop-blur-md rounded-[32px] p-14 text-center border border-neutral-200/70 dark:border-[#2a243a] shadow-xs space-y-5"
            >
              <div className="w-16 h-16 rounded-3xl bg-purple-100/70 dark:bg-purple-950/40 text-[#8B5CF6] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-neutral-950 dark:text-white">
                  {t.noOrdersTitle}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                  {t.noOrdersDesc}
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="inline-block">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-2xl text-xs font-black shadow-md shadow-purple-500/20 transition-all"
                >
                  <span>{t.extractNowBtn}</span>
                  {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Order Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { key: 'ALL', label: dir === 'rtl' ? 'الكل' : 'All', count: counts.all },
                  { key: 'PENDING', label: dir === 'rtl' ? '🟡 قيد المراجعة' : '🟡 Under Review', count: counts.pending },
                  { key: 'AWAITING_PAYMENT', label: dir === 'rtl' ? '🔵 في انتظار الدفع' : '🔵 Awaiting Payment', count: counts.awaitingPayment },
                  { key: 'PAID', label: dir === 'rtl' ? '🟢 مدفوع' : '🟢 Paid', count: counts.paid },
                  { key: 'DELIVERED', label: dir === 'rtl' ? '📦 تم التوصيل' : '📦 Delivered', count: counts.delivered },
                  { key: 'CANCELLED', label: dir === 'rtl' ? '🔴 ملغي' : '🔴 Cancelled', count: counts.cancelled },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                      statusFilter === tab.key
                        ? 'bg-[#8B5CF6] text-white shadow-xs'
                        : 'bg-white/80 dark:bg-[#151120] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#201a2e] border border-neutral-200/60 dark:border-[#2a243a]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white/80 dark:bg-[#13101c]/80 rounded-3xl p-8 text-center border border-neutral-200/60 dark:border-[#2a243a]">
                  <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                    {dir === 'rtl' ? 'لا توجد طلبات تطابق هذه التصفية حالياً.' : 'No orders match this filter.'}
                  </p>
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
                  }}
                  className="space-y-3"
                >
                  {filteredOrders.map((order) => (
                <motion.div
                  key={order.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href={`/orders/${order.id}`}
                    className="block bg-white/90 dark:bg-[#13101c]/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-neutral-200/70 dark:border-[#2a243a] shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-colors group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Item preview thumbnails with SafeImage */}
                        <div className="flex -space-x-3 overflow-hidden p-1 shrink-0">
                          {order.items.slice(0, 3).map((it, idx) => (
                            <div
                              key={idx}
                              className="h-16 w-14 rounded-2xl overflow-hidden ring-2 ring-white dark:ring-[#13101c] shadow-xs bg-purple-50 dark:bg-purple-950/40 shrink-0"
                            >
                              <SafeImage
                                src={it.image}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base sm:text-lg text-neutral-950 dark:text-white group-hover:text-[#8B5CF6] transition-colors">
                              {order.id}
                            </span>
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                              • {order.items.length} {t.goodsCount}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>
                              {t.placedOn} {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                            {(order.dynamicFeeAmount || 0) > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  {t.feeLabel} {order.dynamicFeePercent}% ({order.dynamicFeeAmount} EGP)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#221c2d]">
                        <div className="text-start sm:text-end">
                          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block">
                            {t.totalCashLabel}
                          </span>
                          <div className="font-black text-lg sm:text-xl text-neutral-950 dark:text-white font-mono">
                            {order.totalCash.toLocaleString()}{' '}
                            <span className="text-xs font-black text-[#8B5CF6]">EGP</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {getStatusBadge(order.status)}
                          <div className="text-neutral-400 group-hover:text-[#8B5CF6] group-hover:translate-x-1 transition-all">
                            {dir === 'rtl' ? (
                              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1" />
                            ) : (
                              <ChevronRight className="w-5 h-5 group-hover:translate-x-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
