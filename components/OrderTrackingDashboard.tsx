'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Order, OrderStatus, TrackingInfo } from '@/lib/types';
import { SafeImage } from '@/components/SafeImage';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';

interface OrderTrackingDashboardProps {
  order: Order;
  dir: 'rtl' | 'ltr';
}

export function OrderTrackingDashboard({ order, dir }: OrderTrackingDashboardProps) {
  const isRtl = dir === 'rtl';
  const [copiedTracking, setCopiedTracking] = useState(false);

  const tracking = (order.tracking || {}) as Partial<TrackingInfo>;
  const trackingNumber = tracking.trackingNumber || `SH-EG-${order.id.replace(/\D/g, '') || '91823'}`;
  const carrier = tracking.carrier || (isRtl ? 'بوسطة للشحن السريع (Bosta)' : 'Bosta Express Delivery');

  // Stages calculation:
  // 1: PAID (Payment Confirmed)
  // 2: PROCESSING (Purchased from SHEIN)
  // 3: SHIPPED (In transit / With courier)
  // 4: DELIVERED / COMPLETED (Delivered to customer)
  let activeStep = 1;
  if (order.status === 'PAID') activeStep = 1;
  else if (order.status === 'PROCESSING') activeStep = 2;
  else if (order.status === 'SHIPPED') activeStep = 3;
  else if (order.status === 'DELIVERED' || order.status === 'COMPLETED') activeStep = 4;
  if (tracking.currentStep) activeStep = Math.max(activeStep, tracking.currentStep);

  const steps = [
    {
      num: 1,
      title: isRtl ? 'تم تأكيد الدفع' : 'Payment Confirmed',
      desc: isRtl ? 'تم التحقق من التحويل بنجاح' : 'Payment verified by Admin',
      icon: ShieldCheck,
      isDone: activeStep >= 1,
      isCurrent: activeStep === 1,
    },
    {
      num: 2,
      title: isRtl ? 'جاري الشراء من شي إن' : 'Purchasing from SHEIN',
      desc: isRtl ? 'يتم الآن طلب المنتجات وتجهيزها' : 'Order placed & packing on SHEIN',
      icon: ShoppingBag,
      isDone: activeStep >= 2,
      isCurrent: activeStep === 2,
    },
    {
      num: 3,
      title: isRtl ? 'تم الشحن مع المندوب' : 'In Transit / Shipped',
      desc: isRtl ? `في الطريق إليك عبر ${carrier}` : `On the way via ${carrier}`,
      icon: Truck,
      isDone: activeStep >= 3,
      isCurrent: activeStep === 3,
    },
    {
      num: 4,
      title: isRtl ? 'تم التوصيل للعميل' : 'Delivered to Customer',
      desc: isRtl ? 'تم تسليم الطلب لك بنجاح' : 'Delivered to your address',
      icon: CheckCircle2,
      isDone: activeStep >= 4,
      isCurrent: activeStep === 4,
    },
  ];

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(trackingNumber);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/95 dark:bg-[#13101c]/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-7"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100 dark:border-[#201a2d]">
        <div className="space-y-1.5 text-start">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-200/70 dark:border-emerald-800/70">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              {isRtl ? 'تتبع مباشر للطلب' : 'Live Order Tracking'}
            </span>
            <span className="text-xs font-mono text-neutral-400">
              #{order.id}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
            {isRtl ? 'متابعة مسار شحنتك خطوة بخطوة' : 'Track Your SHEIN Shipment'}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {isRtl
              ? 'تم التحقق من دفع الطلب، وجاري متابعة شحنه حتى باب بيتك بالتعاون مع شركات الشحن المصرية.'
              : 'Payment is confirmed. Track your order status in real-time until delivery.'}
          </p>
        </div>

        {/* Tracking Number Badge */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200/80 dark:border-[#2b243b] text-start sm:text-end shrink-0">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            {isRtl ? 'رقم بوليصة الشحن' : 'Tracking Number'}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-sm font-black text-[#8B5CF6]">
              {trackingNumber}
            </span>
            <button
              onClick={handleCopyTracking}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors cursor-pointer"
              title={isRtl ? 'نسخ رقم التتبع' : 'Copy tracking number'}
            >
              {copiedTracking ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
            {carrier}
          </span>
        </div>
      </div>

      {/* 4-Step Interactive Tracking Bar */}
      <div className="py-2">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className={`p-4 rounded-2xl border transition-all duration-200 text-start ${
                  st.isCurrent
                    ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 ring-2 ring-purple-500/20 shadow-sm'
                    : st.isDone
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-neutral-50/50 dark:bg-[#181423] border-neutral-200/60 dark:border-[#241e30] opacity-50'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      st.isCurrent
                        ? 'bg-[#8B5CF6] text-white animate-pulse'
                        : st.isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-200 dark:bg-[#282136] text-neutral-500'
                    }`}
                  >
                    {st.isDone ? <Check className="w-4 h-4" /> : st.num}
                  </div>
                  <Icon
                    className={`w-4 h-4 ${
                      st.isCurrent
                        ? 'text-[#8B5CF6]'
                        : st.isDone
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-neutral-400'
                    }`}
                  />
                </div>
                <h4 className="font-black text-xs text-neutral-900 dark:text-white leading-tight">
                  {st.title}
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Updates & Admin Tracking Notes */}
      {(tracking.adminTrackingNote || order.adminComment) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200/80 dark:border-purple-800/60 text-start space-y-1">
          <div className="flex items-center gap-2 text-xs font-black text-[#6D28D9] dark:text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>{isRtl ? 'آخر تحديث من المشرف:' : 'Latest Supervisor Note:'}</span>
          </div>
          <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium leading-relaxed pl-5">
            {tracking.adminTrackingNote || order.adminComment}
          </p>
        </div>
      )}

      {/* Shipping Address & Contact Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-start">
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/70 dark:border-[#262035] space-y-1.5">
          <div className="flex items-center gap-2 font-black text-neutral-900 dark:text-white text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>{isRtl ? 'عنوان التوصيل' : 'Delivery Address'}</span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-300 pl-5 leading-relaxed">
            {order.shippingAddress || (isRtl ? 'سيتم التنسيق هاتفياً لتحديد موعد التسليم' : 'Will coordinate via phone call for delivery')}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/70 dark:border-[#262035] space-y-1.5">
          <div className="flex items-center gap-2 font-black text-neutral-900 dark:text-white text-[11px]">
            <Phone className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>{isRtl ? 'بيانات المستلم' : 'Recipient Info'}</span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-300 pl-5">
            {order.userName} • <span className="font-mono">{order.userPhone || '—'}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
