'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Order, SystemSettings } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { OrderTimeline } from '@/components/OrderTimeline';
import { PaymentSection } from '@/components/PaymentSection';
import { OrderTrackingDashboard } from '@/components/OrderTrackingDashboard';
import { SafeImage } from '@/components/SafeImage';
import { PricingExpiryTimer } from '@/components/PricingExpiryTimer';
import { CancelOrderModal } from '@/components/CancelOrderModal';
import { useThemeLang } from '@/lib/theme-lang-context';
import { getClientOrders, saveClientOrder } from '@/lib/order-storage';
import { toUsableSheinUrl } from '@/lib/shein-links';
import { useRealtimeSubscription } from '@/lib/use-realtime';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  Percent,
  CreditCard,
  ShieldCheck,
  User,
  Phone,
  Sparkles,
  Receipt,
  FileCheck,
  Lock,
  Truck,
  XCircle,
  Check,
  Tag,
  Info,
} from 'lucide-react';
import Link from 'next/link';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { dir, lang, t } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const fetchOrder = async (forceLoading = false) => {
    if (!id) return;
    if (forceLoading) {
      setLoading(true);
    }
    try {
      const [orderRes, settingsRes] = await Promise.all([
        fetch(`/api/orders/${id}?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/settings?_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const orderJson = await orderRes.json();
      const settingsJson = await settingsRes.json();

      if (orderJson.success) {
        setOrder(orderJson.data);
        saveClientOrder(orderJson.data);
      } else {
        // Fallback to client localStorage so order data is preserved on temporary network glitch
        const local = getClientOrders().find((o) => o.id === id);
        if (local) {
          setOrder(local);
        }
      }

      if (settingsJson.success) setSettings(settingsJson.data);
    } catch (err) {
      console.warn('Order fetch error, checking local storage:', err);
      const local = getClientOrders().find((o) => o.id === id);
      if (local) setOrder(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder(!order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchOrderSilently = React.useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/orders/${id}?_t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setOrder((prev) => {
          if (!prev) return json.data;
          const prevSig = `${prev.status}:${prev.totalCash}:${prev.updatedAt}:${prev.tracking?.currentStep}:${prev.payment?.submittedAt}`;
          const newSig = `${json.data.status}:${json.data.totalCash}:${json.data.updatedAt}:${json.data.tracking?.currentStep}:${json.data.payment?.submittedAt}`;
          if (prevSig !== newSig) {
            saveClientOrder(json.data);
            return json.data;
          }
          return prev;
        });
      }
    } catch {
      // background silent poll
    }
  }, [id]);

  // Real-time live updates subscription (Task 14)
  useRealtimeSubscription({
    orderId: id,
    channel: 'customer',
    onOrderChange: (incoming) => {
      if (incoming && incoming.id === id) {
        setOrder(incoming);
        saveClientOrder(incoming);
      }
    },
    onRefresh: fetchOrderSilently,
    pollIntervalMs: 3500, // Fast 3.5s adaptive poll fallback
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] flex items-center justify-center transition-colors">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-3 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {isRtl ? `جاري تحميل تفاصيل الطلب #${id}...` : `Loading SHEIN Order #${id}...`}
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] flex flex-col text-neutral-900 dark:text-white transition-colors">
        <Navbar onOpenAuth={() => setAuthOpen(true)} />
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-100/70 dark:bg-purple-950/40 text-[#8B5CF6] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-neutral-950 dark:text-white">
            {isRtl ? 'لم يتم العثور على الطلب' : 'Order Not Located'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {isRtl
              ? `تعذر العثور على الطلب رقم #${id}. قد يكون تم إنشاؤه في جلسة أخرى.`
              : `We couldn't find order #${id}. It may have been created in another browser session.`}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-2xl text-xs font-black shadow-md shadow-purple-500/20"
          >
            {isRtl ? 'استخراج سلة جديدة' : 'Extract a New Cart'}
          </Link>
        </div>
      </div>
    );
  }

  const acceptedItems = order.items.filter(
    (it) => it.status !== 'rejected' && it.status !== 'out_of_stock'
  );
  const rejectedItems = order.items.filter(
    (it) => it.status === 'rejected' || it.status === 'out_of_stock'
  );
  const acceptedCount = acceptedItems.length;
  const rejectedCount = rejectedItems.length;

  const totalOrderSavings = acceptedItems.reduce((sum, it) => {
    if (it.originalPriceBeforeDiscount && it.originalPriceBeforeDiscount > it.originalPrice) {
      return sum + (it.originalPriceBeforeDiscount - it.originalPrice) * it.quantity;
    }
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white pb-32 md:pb-24 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-purple-400/8 to-transparent dark:from-purple-600/10 dark:to-transparent pointer-events-none blur-3xl -z-10" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6"
      >
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/orders"
            className="w-10 h-10 rounded-full border border-neutral-200/80 dark:border-[#2a243a] bg-white/90 dark:bg-[#151120] flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-[#201a2e] transition-colors shadow-xs"
            title={isRtl ? 'الرجوع إلى كل الطلبات' : 'Back to all orders'}
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </Link>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchOrder(false)}
              className="w-10 h-10 rounded-full border border-neutral-200/80 dark:border-[#2a243a] bg-white/90 dark:bg-[#151120] flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white transition-colors shadow-xs cursor-pointer"
              title={isRtl ? 'تحديث حالة الطلب' : 'Refresh order status'}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Master Status & Timeline Card */}
        <div className="bg-white/90 dark:bg-[#13101c]/90 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 border border-neutral-200/70 dark:border-[#2a243a] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-neutral-100 dark:border-[#201a2d]">
            <div className="space-y-1.5 text-start">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-2xl sm:text-3xl font-black text-neutral-950 dark:text-white tracking-tight">
                  {order.id}
                </span>

                {order.status === 'PENDING_APPROVAL' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {t.statusPending}
                  </span>
                )}
                {order.status === 'APPROVED_PENDING_PAYMENT' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-purple-50 dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {t.statusApproved}
                  </span>
                )}
                {order.status === 'PAYMENT_UNDER_REVIEW' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {t.statusPaymentReview}
                  </span>
                )}
                {order.status === 'PAID' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {t.statusPaid}
                  </span>
                )}
                {order.status === 'PROCESSING' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {t.statusProcessing}
                  </span>
                )}
                {order.status === 'SHIPPED' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {t.statusShipped}
                  </span>
                )}
                {order.status === 'DELIVERED' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    {t.statusDelivered}
                  </span>
                )}
                {order.status === 'COMPLETED' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    {t.statusCompleted}
                  </span>
                )}
                {order.status === 'REJECTED' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {t.statusRejected}
                  </span>
                )}
                {order.status === 'CANCELLED' && (
                  <span className="px-3.5 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {t.statusCancelled}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {isRtl ? 'تم الإنشاء في' : 'Created on'} {new Date(order.createdAt).toLocaleDateString()} • {order.userName}
              </p>
              {order.shippingAddress && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  📍 {order.shippingAddress}
                </p>
              )}
              {order.customerNotes && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                  📝 {isRtl ? 'ملاحظاتك:' : 'Your Notes:'} {order.customerNotes}
                </p>
              )}
            </div>

            <div className="text-start sm:text-end bg-neutral-50 dark:bg-[#1a1626] sm:bg-transparent p-4 sm:p-0 rounded-2xl">
              <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                {t.totalCashLabel}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-neutral-950 dark:text-white tracking-tight font-mono">
                {order.totalCash > 0 ? (
                  <>
                    {order.totalCash.toLocaleString()}{' '}
                    <span className="text-xs font-black text-[#8B5CF6]">EGP</span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {isRtl ? 'قيد تسعير المشرف' : 'Pending Admin Pricing'}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Stepper Timeline */}
          <OrderTimeline status={order.status} />

          {/* Live Notice Banners */}
          {order.status === 'PENDING_APPROVAL' && (
            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-start">
                <p className="font-black text-xs">
                  {isRtl ? 'الطلب قيد مراجعة وتدقيق المشرف' : 'Cart is with Admin for Verification'}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-normal">
                  {isRtl
                    ? 'يقوم المشرف حالياً بالتأكد من توفر جميع المنتجات والمقاسات على شي إن وتحديد الأسعار المعتمدة. بمجرد الموافقة، ستفتح لك شاشة مراجعة المنتجات وسداد المبلغ عبر إنستاباي أو فودافون كاش.'
                    : 'Our concierge supervisor is verifying stock and pricing on SHEIN. Once approved, you can review approved items and pay using InstaPay or Vodafone Cash.'}
                </p>
              </div>
            </div>
          )}

          {order.status === 'APPROVED_PENDING_PAYMENT' && (
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300/80 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-start">
                <p className="font-black text-xs text-emerald-900 dark:text-emerald-200">
                  {isRtl
                    ? 'تمت مراجعة الطلب واعتماد الأسعار النهائية — جاهز للسداد'
                    : 'Order Approved by Admin — Ready for Payment'}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-normal">
                  {isRtl
                    ? 'راجع المشرف منتجاتك واعتمد الأسعار والمبالغ النهائية. يرجى مراجعة تفاصيل المنتجات المقبولة والمستبعدة وإجمالي المبلغ أدناه، ثم المتابعة لاختيار وسيلة الدفع.'
                    : 'The admin reviewed your cart and approved final unit prices. Please review the itemized breakdown and approved total below, then proceed with payment.'}
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black text-emerald-900 dark:text-emerald-100">
                  <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
                  <span>
                    {isRtl
                      ? 'الأسعار المعتمدة مثبتة ومحمية من تقلبات سعر الصرف طوال فترة السداد'
                      : 'Approved prices are locked and protected from exchange rate fluctuations'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {order.status === 'PAYMENT_UNDER_REVIEW' && (
            <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200 text-xs flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-start">
                <p className="font-black text-xs text-[#6D28D9] dark:text-purple-300">
                  {isRtl ? 'تم استلام إيصال الدفع بنجاح — قيد المطابقة' : 'Payment Receipt Received — Under Verification'}
                </p>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed font-normal">
                  {isRtl
                    ? `لقد قمت بإرسال بيانات التحويل عبر ${order.payment?.method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}. المشرف يقوم بمطابقة الحساب وسيتم تأكيد الطلب فوراً.`
                    : `You submitted payment proof via ${order.payment?.method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}. The admin is verifying the transfer and will confirm shortly.`}
                </p>
              </div>
            </div>
          )}

          {order.status === 'REJECTED' && (
            <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200 text-xs flex items-start gap-3">
              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-start">
                <p className="font-black text-xs text-rose-900 dark:text-rose-200">
                  {isRtl ? 'تم رفض الطلب من قبل الإدارة' : 'Order Rejected by Supervisor'}
                </p>
                <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed font-normal">
                  {order.rejectionReason ||
                    (isRtl
                      ? 'نعتذر، لم نتمكن من قبول هذا الطلب نظراً لعدم توفر المنتجات أو المقاسات المطلوبة في مخازن شي إن حالياً.'
                      : 'We were unable to approve this order due to unavailable items or stock limitations.')}
                </p>
              </div>
            </div>
          )}

          {order.status === 'CANCELLED' && (
            <div className="p-5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-200 text-xs space-y-2 text-start">
              <div className="flex items-center gap-2 font-black text-sm text-rose-900 dark:text-rose-200">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{isRtl ? 'تم إلغاء هذا الطلب (ملغي)' : 'This Order is Cancelled'}</span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-normal">
                {order.cancellationReason ||
                  (isRtl
                    ? 'تم إلغاء هذا الطلب ولم تعد أسعاره المعتمدة سارية. لا يمكن سداد هذا الطلب حالياً.'
                    : 'This order has been cancelled and pricing is no longer valid.')}
              </p>
              {order.cancelledAt && (
                <p className="text-[11px] text-rose-700/80 dark:text-rose-400 font-medium">
                  {isRtl ? 'وقت الإلغاء:' : 'Cancelled at:'} {new Date(order.cancelledAt).toLocaleString()} •{' '}
                  {order.cancelledBy === 'customer'
                    ? isRtl
                      ? 'تم الإلغاء بطلب من العميل'
                      : 'Cancelled by customer'
                    : order.cancelledBy === 'system'
                    ? isRtl
                      ? 'تم الإلغاء تلقائياً لانتهاء مهلة السداد (ساعة واحدة)'
                      : 'Auto-expired (1-hour window elapsed)'
                    : isRtl
                    ? 'تم الإلغاء بواسطة الإدارة'
                    : 'Cancelled by admin'}
                </p>
              )}
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-black text-xs shadow-sm transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isRtl ? 'استخراج سلة جديدة بأسعار محدثة' : 'Extract a New Cart with Fresh Pricing'}</span>
                </Link>
              </div>
            </div>
          )}

          {/* Admin Order Comment */}
          {order.adminComment && (
            <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs text-neutral-900 dark:text-neutral-100 space-y-1 text-start">
              <div className="flex items-center gap-1.5 font-black text-[#6D28D9] dark:text-purple-300 text-[11px]">
                <MessageSquare className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{isRtl ? 'ملاحظة المشرف العامة:' : 'Admin Supervisor Note:'}</span>
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 italic pl-5">
                &ldquo;{order.adminComment}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* 1. TRACKING DASHBOARD (For already paid / shipped orders) */}
        {['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) && (
          <OrderTrackingDashboard order={order} dir={dir} />
        )}

        {/* 2. PRIMARY ITEM-BY-ITEM BREAKDOWN & APPROVED PRICING (Always above payment!) */}
        <div className="bg-white/95 dark:bg-[#13101c]/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-6 text-start">
          {/* Card Header with Step Indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-[#201a2d]">
            <div className="space-y-1">
              {order.status === 'APPROVED_PENDING_PAYMENT' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/70 text-[#7C3AED] dark:text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-200 dark:border-purple-800 mb-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>
                    {isRtl
                      ? 'الخطوة 1 من 2: مراجعة المنتجات والأسعار المعتمدة قبل السداد'
                      : 'Step 1 of 2: Review Approved Products & Pricing Before Payment'}
                  </span>
                </div>
              ) : null}

              <h3 className="font-black text-neutral-950 dark:text-white text-lg sm:text-xl">
                {order.status === 'APPROVED_PENDING_PAYMENT'
                  ? isRtl
                    ? 'تفاصيل المنتجات والأسعار بعد مراجعة المشرف'
                    : 'Itemized Products & Final Approved Pricing'
                  : isRtl
                  ? `المنتجات المستخرجة من السلة (${order.items.length})`
                  : `Extracted Order Items (${order.items.length})`}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isRtl
                  ? 'راجع حالة كل منتج والسعر الفردي والإجمالي المعتمد قبل تحويل المبلغ.'
                  : 'Review each item status, unit price, and subtotal approved by the concierge admin.'}
              </p>
            </div>

            {/* Stat Badges */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {acceptedCount} {isRtl ? 'منتج معتمد' : 'Approved'}
                </span>
              </span>

              {rejectedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>
                    {rejectedCount} {isRtl ? 'مستبعد / غير متاح' : 'Excluded'}
                  </span>
                </span>
              )}
              {order.status === 'APPROVED_PENDING_PAYMENT' && (
                <>
                  <PricingExpiryTimer
                    expiresAt={order.pricingExpiresAt}
                    createdAt={order.createdAt}
                    reviewedAt={order.reviewedAt}
                    onExpire={fetchOrderSilently}
                    compact={true}
                  />
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'إلغاء الطلب' : 'Cancel Order'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            {order.items.map((item, idx) => {
              const isRejected = item.status === 'rejected' || item.status === 'out_of_stock';
              const itemUrl = item.url || item.originalUrl;
              const usableLink = toUsableSheinUrl(itemUrl, { goodsId: item.goodsId });

              return (
                <div
                  key={idx}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col gap-3.5 ${
                    isRejected
                      ? 'border-rose-200/90 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20'
                      : 'border-neutral-200/80 dark:border-[#251f35] bg-[#FAFAFC] dark:bg-[#181423] hover:border-purple-300 dark:hover:border-purple-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Left: Image & Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden bg-white dark:bg-[#1f1a2d] shrink-0 border border-neutral-200/80 dark:border-[#2b243b] relative shadow-2xs">
                        <SafeImage
                          src={item.image}
                          alt={item.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${
                            isRejected ? 'grayscale opacity-75' : ''
                          }`}
                        />
                        {isRejected ? (
                          <div className="absolute inset-0 bg-rose-950/20 flex items-center justify-center">
                            <span className="p-1 rounded-full bg-rose-600 text-white shadow-md">
                              <XCircle className="w-4 h-4" />
                            </span>
                          </div>
                        ) : (
                          <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 p-1 rounded-full bg-emerald-600 text-white shadow-xs">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 min-w-0 text-start">
                        {/* Status Tag */}
                        <div>
                          {isRejected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] sm:text-[11px] font-black border border-rose-300/80 dark:border-rose-800">
                              <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>{isRtl ? 'غير متوفر / مستبعد من الحساب' : 'Rejected / Out of Stock'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-[11px] font-black border border-emerald-300/80 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{isRtl ? 'منتج معتمد ومقبول' : 'Approved Item'}</span>
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-black text-neutral-950 dark:text-white text-xs sm:text-sm line-clamp-2 leading-snug">
                          {item.name}
                        </h4>

                        {/* Direct Link to SHEIN */}
                        {(usableLink || itemUrl) && (
                          <div>
                            <a
                              href={usableLink || itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:underline transition-colors"
                            >
                              <span>{isRtl ? 'عرض المنتج على شي إن' : 'View on SHEIN'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Variants: Color & Size */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 pt-0.5">
                          {item.color && (
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-[#201a2d] border border-neutral-200 dark:border-[#2f2742]">
                              {isRtl ? 'اللون:' : 'Color:'} <strong className="text-neutral-900 dark:text-white">{item.color}</strong>
                            </span>
                          )}
                          {item.size && (
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-[#201a2d] border border-neutral-200 dark:border-[#2f2742]">
                              {isRtl ? 'المقاس:' : 'Size:'} <strong className="text-neutral-900 dark:text-white">{item.size}</strong>
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-[#201a2d] border border-neutral-200 dark:border-[#2f2742]">
                            {isRtl ? 'الكمية:' : 'Qty:'} <strong className="text-neutral-900 dark:text-white">{item.quantity}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Pricing */}
                    <div className="text-start sm:text-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#201a2d] w-full sm:w-auto">
                      {isRejected ? (
                        <div className="space-y-0.5">
                          <span className="text-xs text-neutral-400 line-through block font-mono">
                            {item.quantity} × {item.originalPrice.toLocaleString()} EGP
                          </span>
                          <span className="font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-mono block">
                            {isRtl ? '0 ج.م (مستبعد من الحساب)' : '0 EGP (Excluded)'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {/* Strikethrough original price if discounted */}
                          {item.originalPriceBeforeDiscount && item.originalPriceBeforeDiscount > item.originalPrice ? (
                            <div className="flex items-center justify-start sm:justify-end gap-1.5 font-mono">
                              <span className="text-xs text-neutral-400 dark:text-neutral-500 line-through">
                                {item.quantity} × {item.originalPriceBeforeDiscount.toLocaleString()} EGP
                              </span>
                              {Boolean(item.discountPercent && item.discountPercent > 0) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-200 dark:border-rose-900">
                                  <Percent className="w-2.5 h-2.5" />
                                  <span>-{item.discountPercent}%</span>
                                </span>
                              )}
                            </div>
                          ) : null}

                          <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-mono">
                            {item.quantity} × {item.originalPrice.toLocaleString()} EGP
                          </span>
                          <div className="font-black text-base sm:text-lg text-neutral-950 dark:text-white font-mono">
                            {item.subtotal.toLocaleString()}{' '}
                            <span className="text-xs font-bold text-[#8B5CF6]">EGP</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">
                            {isRtl ? 'السعر المعتمد النهائي' : 'Approved Unit Price'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection Reason Callout Banner */}
                  {isRejected && (
                    <div className="mt-1 p-3.5 rounded-2xl bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900/60 text-xs">
                      <div className="flex items-center gap-1.5 font-black text-rose-950 dark:text-rose-200 text-[11px] mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{isRtl ? 'سبب الرفض والاستبعاد من الحساب:' : 'Reason for Exclusion:'}</span>
                      </div>
                      <p className="text-xs text-rose-900 dark:text-rose-200 font-medium pl-5 leading-relaxed">
                        {item.adminComment ||
                          order.rejectionReason ||
                          (isRtl
                            ? 'المنتج غير متوفر حالياً بمخازن شي إن أو نفدت المقاسات المطلوبة.'
                            : 'Product is currently out of stock on SHEIN or the selected size is sold out.')}
                      </p>
                    </div>
                  )}

                  {/* Admin Note for Accepted Item */}
                  {!isRejected && item.adminComment && (
                    <div className="mt-1 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0 mt-0.5" />
                      <div className="text-[11px] text-neutral-800 dark:text-neutral-200">
                        <span className="font-bold text-[#6D28D9] dark:text-purple-300">
                          {isRtl ? 'ملاحظة المشرف:' : 'Supervisor Note:'}
                        </span>{' '}
                        {item.adminComment}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Approved Financial Math Bar */}
          <div className="p-5 sm:p-6 rounded-3xl bg-neutral-100/80 dark:bg-[#181423] border border-neutral-200/80 dark:border-[#2f2742] space-y-4">
            {totalOrderSavings > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
                <span className="flex items-center gap-2 font-bold">
                  <Percent className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{isRtl ? 'إجمالي وفر الخصم من شي إن المطبق على منتجاتك:' : 'Total SHEIN Discount Savings Applied:'}</span>
                </span>
                <span className="font-mono font-black text-sm text-rose-700 dark:text-rose-300">
                  -{totalOrderSavings.toLocaleString()} EGP
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1a2d] border border-neutral-200/60 dark:border-[#2a233b]">
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 block mb-0.5">
                  {isRtl ? 'مجموع المنتجات المقبولة' : 'Accepted Items Subtotal'}
                </span>
                <span className="text-base font-black text-neutral-950 dark:text-white font-mono">
                  {order.itemsSubtotal.toLocaleString()} EGP
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1a2d] border border-neutral-200/60 dark:border-[#2a233b] flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 block mb-0.5">
                    {isRtl
                      ? `رسوم الخدمة والتوصيل (${order.dynamicFeePercent || 0}%)`
                      : `Service & Delivery Fee (${order.dynamicFeePercent || 0}%)`}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block leading-tight mb-1">
                    {isRtl
                      ? `محسوبة بنسبة ${order.dynamicFeePercent || 0}% من إجمالي المنتجات المقبولة`
                      : `Calculated as ${order.dynamicFeePercent || 0}% of accepted items`}
                  </span>
                </div>
                <span className="text-base font-black text-[#8B5CF6] font-mono">
                  +{(order.dynamicFeeAmount || 0).toLocaleString()} EGP
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1f1a2d] border border-neutral-200/60 dark:border-[#2a233b]">
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 block mb-0.5">
                  {isRtl ? 'الشحن والتوصيل' : 'Shipping & Handling'}
                </span>
                <span className="text-base font-black text-teal-600 dark:text-teal-400 font-mono">
                  {order.shippingFee
                    ? `+${order.shippingFee.toLocaleString()} EGP`
                    : isRtl
                    ? 'شحن مجاني / مشمول'
                    : 'Included / Free'}
                </span>
              </div>
            </div>

            {/* Grand Total Highlight */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-purple-500/10 border-2 border-emerald-500/40 dark:border-emerald-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-black text-emerald-800 dark:text-emerald-300 tracking-wider block">
                  {isRtl ? 'المبلغ النهائي المطلوب سداده' : 'Final Approved Total Cash Due'}
                </span>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  {isRtl
                    ? '💡 هذا المبلغ محسوب بدقة للمنتجات المقبولة فقط، وتم استبعاد أي منتجات مرفوضة نهائياً (0 ج.م).'
                    : '💡 Calculated strictly for accepted goods. Excluded items are 0 EGP.'}
                </p>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-200 font-mono tracking-tight shrink-0">
                {order.totalCash.toLocaleString()}{' '}
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">EGP</span>
              </div>
            </div>

            {order.status === 'APPROVED_PENDING_PAYMENT' && (
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                <span>
                  {isRtl
                    ? '👇 الآن بعد مراجعة تفاصيل طلبك أعلاه، يرجى النزول أدناه لاختيار طريقة الدفع وإتمام التحويل.'
                    : '👇 Now that you reviewed your approved order, please proceed below to choose payment method and complete your transfer.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. PAYMENT UNLOCKED (Step 2: User pays via InstaPay or Vodafone Cash) */}
        {order.status === 'APPROVED_PENDING_PAYMENT' && settings && (
          <PaymentSection
            order={order}
            settings={settings}
            onPaymentSubmitted={() => fetchOrder(false)}
            onCancelClick={() => setCancelModalOpen(true)}
          />
        )}

        {/* 4. PAYMENT UNDER REVIEW (Locked screen - user cannot re-edit) */}
        {order.status === 'PAYMENT_UNDER_REVIEW' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 sm:p-8 rounded-[32px] bg-white/95 dark:bg-[#13101c]/95 border-2 border-purple-300 dark:border-purple-800/80 shadow-xl shadow-purple-500/5 space-y-6 text-start"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100 dark:border-[#221c30]">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800">
                  <Lock className="w-6 h-6 text-[#7C3AED]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase tracking-wider border border-blue-200/80 dark:border-blue-800/80">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping inline-block" />
                      {isRtl ? 'جاري مراجعة الدفع' : 'Payment Under Review'}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white mt-1">
                    {isRtl ? 'تم إرسال بيانات الدفع — قيد المطابقة' : 'Payment Submitted — Under Verification'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-400">
                  {isRtl ? 'المبلغ المحول:' : 'Amount Paid:'}
                </span>
                <span className="font-mono text-xl font-black text-[#8B5CF6]">
                  {order.totalCash.toLocaleString()} EGP
                </span>
              </div>
            </div>

            {/* Payment Details Locked Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/80 dark:border-[#272136]">
                <span className="text-neutral-400 text-[11px] block font-bold mb-1">
                  {isRtl ? 'طريقة التحويل' : 'Payment Method'}
                </span>
                <div className="flex items-center gap-2 font-black text-neutral-900 dark:text-white">
                  <div className="w-6 h-6 rounded-lg bg-white p-0.5 border border-neutral-200 shrink-0">
                    <img
                      src={
                        order.payment?.method === 'vodafone_cash'
                          ? '/images/vodafone-cash.png'
                          : '/images/instapay.png'
                      }
                      alt="Payment Method"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span>{order.payment?.method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي (InstaPay)'}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/80 dark:border-[#272136]">
                <span className="text-neutral-400 text-[11px] block font-bold mb-1">
                  {isRtl ? 'رقم / حساب المحول' : 'Sender Identifier'}
                </span>
                <span className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                  {order.payment?.senderIdentifier || '—'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/80 dark:border-[#272136]">
                <span className="text-neutral-400 text-[11px] block font-bold mb-1">
                  {isRtl ? 'الرقم المرجعي / كود العملية' : 'Transaction Ref'}
                </span>
                <span className="font-mono font-black text-sm text-[#8B5CF6]">
                  {order.payment?.transactionReference || (isRtl ? 'قيد المطابقة' : 'Verifying')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-950 dark:text-purple-200 leading-relaxed font-medium">
              {isRtl
                ? '🔒 تم قفل شاشة الدفع مؤقتاً لحين انتهاء المشرف من مطابقة التحويل. فور التأكيد، ستتحول الصفحة تلقائياً إلى صفحة تتبع الطلب (Tracking) ومتابعة خط سير الشحنة.'
                : '🔒 Payment screen is locked while our admin matches your transfer. Once verified, live tracking dashboard will automatically unlock here.'}
            </div>
          </motion.div>
        )}
      </motion.main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {order && (
        <CancelOrderModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          orderId={order.id}
          totalCash={order.totalCash}
          onSuccess={() => fetchOrder()}
        />
      )}
    </div>
  );
}
