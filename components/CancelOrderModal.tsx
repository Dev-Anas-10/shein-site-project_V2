'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeLang } from '@/lib/theme-lang-context';
import { AlertTriangle, X, Check, XCircle } from 'lucide-react';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  totalCash: number;
  onSuccess: () => void;
}

export function CancelOrderModal({
  isOpen,
  onClose,
  orderId,
  totalCash,
  onSuccess,
}: CancelOrderModalProps) {
  const { dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [reason, setReason] = useState<string>('غيرت رأيي ولا أرغب في الشراء حالياً');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickReasons = [
    { id: 'changed_mind', textAr: 'غيرت رأيي ولا أرغب في الشراء حالياً', textEn: 'Changed my mind / Not purchasing now' },
    { id: 'too_expensive', textAr: 'الأسعار أو التكلفة الإجمالية غير مناسبة لميزانيتي', textEn: 'Total price exceeds my budget' },
    { id: 'different_cart', textAr: 'أرغب في إنشاء سلة جديدة واستبدال المنتجات', textEn: 'Want to extract a different cart' },
    { id: 'other', textAr: 'سبب آخر (اكتب ملاحظتك)', textEn: 'Other reason' },
  ];

  const handleConfirmCancel = async () => {
    setLoading(true);
    setError(null);

    const finalReason = reason === 'other' && customReason.trim()
      ? customReason.trim()
      : isRtl
      ? quickReasons.find((r) => r.id === reason)?.textAr || reason
      : quickReasons.find((r) => r.id === reason)?.textEn || reason;

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || (isRtl ? 'فشل إلغاء الطلب' : 'Failed to cancel order'));
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error cancelling order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#13101c] rounded-[32px] p-6 sm:p-8 shadow-2xl border border-neutral-200/80 dark:border-[#2a243a] text-start overflow-hidden"
        >
          {/* Top Close Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute top-5 end-5 w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#1f1a2d] hover:bg-neutral-200 dark:hover:bg-[#2b243b] text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Warning Icon */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-13 h-13 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60 shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-neutral-950 dark:text-white tracking-tight">
                {isRtl ? 'تأكيد إلغاء الطلب' : 'Confirm Order Cancellation'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                {isRtl ? `طلب شي إن #${orderId}` : `SHEIN Order #${orderId}`} • {totalCash.toLocaleString()} EGP
              </p>
            </div>
          </div>

          {/* Warning Message Box */}
          <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-1 mb-5">
            <p className="font-black text-xs text-rose-950 dark:text-rose-100">
              {isRtl ? 'تنبيه هام قبل الإلغاء:' : 'Important Notice:'}
            </p>
            <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed font-normal">
              {isRtl
                ? 'عند إلغاء هذا الطلب، سيتم إنهاء مهلة السداد وإلغاء حجز الأسعار المعتمدة نهائياً. لن تتمكن من الدفع لاحقاً بهذا السعر، وسيتعين عليك إنشاء طلب جديد واستخراج سلة حديثة في حال رغبت في الشراء.'
                : 'Cancelling this order will forfeit approved pricing and clear the checkout lock. You will not be able to pay for this cart later and must create a new order.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold mb-4 flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-3 mb-6">
            <label className="block text-xs font-black text-neutral-800 dark:text-neutral-200">
              {isRtl ? 'ما سبب رغبتك في إلغاء الطلب؟' : 'Why would you like to cancel?'}
            </label>

            <div className="space-y-2">
              {quickReasons.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    reason === item.id
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-200 shadow-2xs'
                      : 'bg-neutral-50 dark:bg-[#181423] border-neutral-200/80 dark:border-[#2a243b] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-[#1f1a2d]'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                    className="accent-purple-600"
                  />
                  <span>{isRtl ? item.textAr : item.textEn}</span>
                </label>
              ))}
            </div>

            {reason === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder={isRtl ? 'اكتب سبب الإلغاء هنا...' : 'State your reason here...'}
                  className="w-full px-4 py-2.5 text-xs bg-neutral-50 dark:bg-[#181423] border border-neutral-200 dark:border-[#2b243b] rounded-xl focus:bg-white dark:focus:bg-[#1f1a2d] focus:outline-none focus:ring-2 focus:ring-purple-500 text-neutral-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-[#221c30]">
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={loading}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-rose-600/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>{isRtl ? 'تأكيد إلغاء الطلب' : 'Confirm Cancel'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-3.5 bg-neutral-100 dark:bg-[#1e192c] hover:bg-neutral-200 dark:hover:bg-[#28223a] text-neutral-800 dark:text-neutral-200 font-black text-xs rounded-2xl transition-all flex items-center justify-center cursor-pointer"
            >
              {isRtl ? 'تراجع / الإبقاء على الطلب' : 'Keep Order / Go Back'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
