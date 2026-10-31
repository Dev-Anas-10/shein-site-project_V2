'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useThemeLang } from '@/lib/theme-lang-context';
import { Clock, AlertTriangle } from 'lucide-react';

interface PricingExpiryTimerProps {
  expiresAt?: string;
  createdAt?: string;
  reviewedAt?: string;
  onExpire?: () => void;
  compact?: boolean;
}

export function PricingExpiryTimer({
  expiresAt,
  createdAt,
  reviewedAt,
  onExpire,
  compact = false,
}: PricingExpiryTimerProps) {
  const { dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  // Calculate target expiration timestamp (1 hour from review/approval or expiresAt)
  const targetTime = useMemo(() => {
    if (expiresAt) {
      const exp = new Date(expiresAt).getTime();
      if (!isNaN(exp)) return exp;
    }
    const baseTime = reviewedAt || createdAt;
    if (baseTime) {
      const base = new Date(baseTime).getTime();
      if (!isNaN(base)) return base + 60 * 60 * 1000;
    }
    return Date.now() + 60 * 60 * 1000;
  }, [expiresAt, createdAt, reviewedAt]);

  const [timeLeft, setTimeLeft] = useState<number>(() => Math.max(0, targetTime - Date.now()));

  // Ref for onExpire callback to prevent timer re-instantiation
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // CRITICAL FIX: If already expired when mounted, flag as triggered so we never enter an infinite reload loop!
  const hasTriggeredRef = useRef(targetTime <= Date.now());

  useEffect(() => {
    // If targetTime resets to a future point, allow triggering again
    if (targetTime > Date.now()) {
      hasTriggeredRef.current = false;
      setTimeLeft(targetTime - Date.now());
    } else {
      setTimeLeft(0);
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      setTimeLeft(remaining);

      // Only fire when the timer genuinely expires in real-time while the user is actively viewing the page
      if (remaining <= 0 && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        if (onExpireRef.current) {
          try {
            onExpireRef.current();
          } catch (e) {
            console.warn('[Timer] onExpire error:', e);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpired = timeLeft <= 0;
  const isUrgent = totalSeconds < 15 * 60; // Less than 15 minutes remaining
  const isCritical = totalSeconds < 5 * 60; // Less than 5 minutes remaining

  const formatDigits = (num: number) => num.toString().padStart(2, '0');

  if (compact) {
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 text-xs font-black border border-rose-300 dark:border-rose-800">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{isRtl ? 'انتهت صلاحية السعر' : 'Pricing Expired'}</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono border transition-colors ${
          isCritical
            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse'
            : isUrgent
            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
            : 'bg-purple-100 dark:bg-purple-950/70 text-[#7C3AED] dark:text-purple-300 border-purple-200 dark:border-purple-800'
        }`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span dir="ltr">
          {formatDigits(minutes)}:{formatDigits(seconds)}
        </span>
      </span>
    );
  }

  if (isExpired) {
    return (
      <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-200 text-xs flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-start">
          <p className="font-black text-xs text-rose-900 dark:text-rose-200">
            {isRtl ? 'انتهت مهلة سداد السعر المعتمد (ساعة واحدة)' : 'Approved Pricing Has Expired (1-Hour Limit)'}
          </p>
          <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed font-normal">
            {isRtl
              ? 'انتهت فترة الـ 60 دقيقة المحددة لصلاحية الأسعار المعتمدة. تم إلغاء الطلب تلقائياً ولا يمكن الدفع بالأسعار القديمة لضمان دقة أسعار شي إن ومخزونها. يرجى استخراج سلة جديدة.'
              : 'The 60-minute window for approved pricing has elapsed. The order has expired and cannot be paid at stale prices. Please extract a fresh cart.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl border transition-colors flex items-center justify-between gap-4 ${
        isCritical
          ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200 shadow-sm'
          : isUrgent
          ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 shadow-sm'
          : 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200'
      }`}
    >
      <div className="flex items-center gap-3 text-start min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
            isCritical
              ? 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 animate-pulse'
              : isUrgent
              ? 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              : 'bg-purple-200/80 dark:bg-purple-900/60 text-[#7C3AED] dark:text-purple-300'
          }`}
        >
          <Clock className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs font-black truncate">
            {isRtl ? 'مهلة صلاحية السعر المعتمد للسداد' : 'Approved Pricing Validity Period'}
          </p>
          <p className="text-[11px] opacity-80 leading-tight">
            {isRtl
              ? 'صلاحية هذا السعر 60 دقيقة فقط من لحظة الاعتماد لضمان ثبات أسعار ومقاسات شي إن.'
              : 'Approved rates are locked for 60 mins from review time to prevent stock & exchange shifts.'}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-end">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-black border shadow-xs ${
            isCritical
              ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
              : isUrgent
              ? 'bg-amber-600 text-white border-amber-700'
              : 'bg-purple-700 text-white border-purple-800'
          }`}
          dir="ltr"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>
            {formatDigits(minutes)}:{formatDigits(seconds)}
          </span>
        </div>
        <span className="block text-[10px] font-bold opacity-75 mt-0.5 text-center sm:text-end">
          {isRtl ? 'متبقي للسداد' : 'Time Left'}
        </span>
      </div>
    </div>
  );
}
