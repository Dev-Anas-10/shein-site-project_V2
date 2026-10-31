'use client';

import React, { useState } from 'react';
import { Order, SystemSettings } from '@/lib/types';
import { saveClientOrder } from '@/lib/order-storage';
import { useThemeLang } from '@/lib/theme-lang-context';
import {
  CreditCard,
  Copy,
  Check,
  Phone,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { PricingExpiryTimer } from './PricingExpiryTimer';

interface PaymentSectionProps {
  order: Order;
  settings: SystemSettings;
  onPaymentSubmitted: () => void;
  onCancelClick?: () => void;
}

export function PaymentSection({ order, settings, onPaymentSubmitted, onCancelClick }: PaymentSectionProps) {
  const { dir, lang } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [method, setMethod] = useState<'instapay' | 'vodafone_cash'>('instapay');
  const [senderIdentifier, setSenderIdentifier] = useState(order.userPhone || '');
  const [transactionReference, setTransactionReference] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderIdentifier.trim()) {
      setError(
        isRtl
          ? 'يرجى إدخال رقم الهاتف أو عنوان إنستاباي المحول منه.'
          : 'Please enter your sender mobile number or InstaPay address.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          senderIdentifier: senderIdentifier.trim(),
          transactionReference: transactionReference.trim() || undefined,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || (isRtl ? 'فشل إرسال بيانات الدفع' : 'Payment submission failed'));
      }

      if (resJson.data) {
        saveClientOrder(resJson.data);
      }

      onPaymentSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group">
      {/* Decorative ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-purple-500/20 rounded-3xl blur-xl opacity-75 pointer-events-none" />

      <div className="relative bg-white dark:bg-[#13101c] rounded-3xl p-6 sm:p-10 shadow-2xl border-2 border-emerald-500/30 dark:border-emerald-500/40 text-start">
        {/* Step 2 Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-neutral-100 dark:border-[#221c30]">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {isRtl
                ? 'الخطوة 2 من 2: طرق الدفع المعتمدة — السداد بالجنيه المصري'
                : 'Step 2 of 2: Approved Payment Channels — Pay in EGP'}
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-neutral-950 dark:text-white tracking-tight">
              {isRtl ? 'سداد قيمة الطلب عبر إنستاباي أو فودافون كاش' : 'Pay with InstaPay or Vodafone Cash'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed">
              {isRtl
                ? 'بعد مراجعة المنتجات والأسعار المعتمدة أعلاه، يرجى اختيار وسيلة الدفع المناسبة وتحويل إجمالي المبلغ المعتمد أدناه.'
                : 'Select your preferred payment method below, transfer the approved total, and confirm your payment details.'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 text-start sm:text-end shadow-xs shrink-0">
            <span className="text-[11px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider block">
              {isRtl ? 'المبلغ المطلوب سداده' : 'Approved Total Cash'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-200 tracking-tight font-mono">
              {order.totalCash.toLocaleString()}{' '}
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">EGP</span>
            </div>
          </div>
        </div>

        {/* Approved Pricing Expiry Countdown Timer */}
        <div className="mt-6">
          <PricingExpiryTimer
            expiresAt={order.pricingExpiresAt}
            createdAt={order.createdAt}
            reviewedAt={order.reviewedAt}
          />
        </div>

        {/* Payment Channels Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
          {/* InstaPay Option */}
          <button
            type="button"
            onClick={() => setMethod('instapay')}
            className={`p-5 rounded-3xl border-2 transition-all duration-200 flex items-center gap-4 text-start cursor-pointer ${
              method === 'instapay'
                ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 shadow-lg shadow-purple-600/10 ring-2 ring-purple-600/20'
                : 'border-neutral-200/80 dark:border-[#282138] bg-neutral-50/60 dark:bg-[#181423] hover:bg-neutral-100/70 dark:hover:bg-[#1f1a2d]'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 border border-purple-200 shadow-md shadow-purple-600/10 flex items-center justify-center shrink-0">
              <img src="/images/instapay.png" alt="InstaPay" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-neutral-950 dark:text-white text-base">
                  {isRtl ? 'إنستاباي (InstaPay)' : 'InstaPay'}
                </span>
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-full shrink-0">
                  {isRtl ? 'تحويل لحظي' : 'Instant EBC'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isRtl ? 'تحويل بنكي لحظي عبر شبكة IPN' : 'Direct Egyptian Bank Transfer'}
              </p>
            </div>
          </button>

          {/* Vodafone Cash Option */}
          <button
            type="button"
            onClick={() => setMethod('vodafone_cash')}
            className={`p-5 rounded-3xl border-2 transition-all duration-200 flex items-center gap-4 text-start cursor-pointer ${
              method === 'vodafone_cash'
                ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 shadow-lg shadow-rose-600/10 ring-2 ring-rose-600/20'
                : 'border-neutral-200/80 dark:border-[#282138] bg-neutral-50/60 dark:bg-[#181423] hover:bg-neutral-100/70 dark:hover:bg-[#1f1a2d]'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-rose-200 shadow-md shadow-rose-600/10 flex items-center justify-center shrink-0">
              <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-neutral-950 dark:text-white text-base">
                  {isRtl ? 'فودافون كاش (Vodafone Cash)' : 'Vodafone Cash'}
                </span>
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full shrink-0">
                  {isRtl ? 'محفظة إلكترونية' : 'Mobile Wallet'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isRtl ? 'تحويل فوري من أي محفظة كاش' : 'Instant Mobile Wallet Transfer'}
              </p>
            </div>
          </button>
        </div>

        {/* Selected Channel Interactive Details Card */}
        <div className="mt-6 p-5 sm:p-6 rounded-3xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/80 dark:border-[#282138] space-y-4">
          {method === 'instapay' ? (
            <div className="space-y-4">
              {/* Direct InstaPay Link Button */}
              <a
                href={settings.instapayPaymentUrl || 'https://ipn.eg/S/anasashraf10/instapay/6OaEAR'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-5 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black rounded-2xl shadow-lg shadow-purple-600/25 hover:shadow-xl transition-all flex items-center justify-between group active:scale-[0.99] border border-purple-400/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md">
                    <img src="/images/instapay.png" alt="InstaPay" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-start">
                    <div className="flex items-center gap-2">
                      <span className="block text-sm sm:text-base font-black">
                        {isRtl ? 'اضغط الرابط لإرسال نقود عبر إنستاباي' : 'Tap link to pay via InstaPay'}
                      </span>
                      <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Direct Link
                      </span>
                    </div>
                    <span className="text-[11px] text-purple-100 font-medium block mt-0.5">
                      {isRtl
                        ? 'فتح تطبيق InstaPay مباشرة على هاتفك للتحويل فوراً'
                        : 'Open InstaPay mobile app directly to complete payment'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-white/30 transition-all shrink-0">
                  <span>{isRtl ? 'فتح التطبيق' : 'Open App'}</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>

              {/* InstaPay IPA Details Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1f1a2d] border border-purple-100/80 dark:border-purple-900/40 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 p-1 flex items-center justify-center">
                      <img src="/images/instapay.png" alt="InstaPay" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isRtl ? 'عنوان الدفع اللحظي (IPA):' : 'InstaPay Payment Address (IPA):'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black tracking-wide text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/80 border border-purple-200/60 dark:border-purple-800 px-2.5 py-0.5 rounded-full">
                    Powered by InstaPay
                  </span>
                </div>

                <div className="bg-neutral-50 dark:bg-[#15121f] p-3.5 rounded-xl border border-neutral-200 dark:border-[#2b243b] font-mono text-base sm:text-lg font-black text-neutral-900 dark:text-white tracking-tight flex items-center justify-between shadow-inner">
                  <span dir="ltr">{settings.instapayAddress || 'anasashraf10@instapay'}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(settings.instapayAddress || 'anasashraf10@instapay', 'ipa')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    {copiedField === 'ipa' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>
                      {copiedField === 'ipa' ? (isRtl ? 'تم النسخ ✓' : 'Copied ✓') : isRtl ? 'نسخ العنوان' : 'Copy IPA'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-[#272136]">
                  <span>{isRtl ? 'اسم صاحب الحساب:' : 'Account Holder Name:'}</span>
                  <strong className="text-neutral-950 dark:text-white font-bold">
                    {settings.instapayAccountName || 'anasashraf10'}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white p-0.5 border border-rose-200 shadow-2xs flex items-center justify-center">
                    <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isRtl ? 'رقم محفظة فودافون كاش:' : 'Vodafone Cash Wallet Number:'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(settings.vodafoneCashNumber, 'vfc')}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  {copiedField === 'vfc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copiedField === 'vfc' ? (isRtl ? 'تم النسخ ✓' : 'Copied') : isRtl ? 'نسخ الرقم' : 'Copy Number'}
                  </span>
                </button>
              </div>

              <div className="bg-white dark:bg-[#1f1a2d] p-4 rounded-2xl border border-neutral-200 dark:border-[#2b243b] font-mono text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight flex items-center justify-between shadow-inner">
                <span dir="ltr">{settings.vodafoneCashNumber}</span>
                <span className="text-xs font-normal text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/80 px-2.5 py-1 rounded-md font-sans">
                  {isRtl ? 'محفظة نشطة ومفعلة' : 'Active Wallet'}
                </span>
              </div>

              {/* USSD Dialing shortcut */}
              <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-3">
                <Phone className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-start">
                  <p className="font-black text-rose-950 dark:text-rose-100">
                    {isRtl ? 'كود التحويل السريع عبر الهاتف:' : 'Quick USSD Dialing Guide:'}
                  </p>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                    {isRtl ? 'اطلب الكود التالي من هاتفك المحمول:' : 'Dial:'}{' '}
                    <code className="bg-white dark:bg-[#14101e] px-2 py-0.5 rounded font-bold font-mono text-neutral-900 dark:text-white border border-rose-200 dark:border-rose-900">
                      *9*7*{settings.vodafoneCashNumber}*{order.totalCash}#
                    </code>{' '}
                    {isRtl
                      ? 'ثم أدخل الرقم السري لمحفظتك لتأكيد التحويل فوراً.'
                      : 'on your mobile phone, confirm with your Vodafone PIN, and capture the receipt.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transfer Confirmation Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="flex items-center gap-2 pb-1 border-b border-neutral-100 dark:border-[#221c30]">
            <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-black text-neutral-950 dark:text-white uppercase tracking-wider">
              {isRtl ? 'تأكيد بيانات عملية التحويل' : 'Confirm Payment Transfer'}
            </h4>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 text-start">
                {isRtl ? 'رقم الهاتف أو حساب إنستاباي المحول منه' : 'Sender Mobile / InstaPay ID'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={senderIdentifier}
                onChange={(e) => setSenderIdentifier(e.target.value)}
                placeholder={method === 'instapay' ? 'name@instapay / 01XXXXXXXXX' : '010XXXXXXXX'}
                className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-[#181423] border border-neutral-200 dark:border-[#2b243b] rounded-2xl focus:bg-white dark:focus:bg-[#1f1a2d] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5 text-start">
                {isRtl ? 'كود العملية أو الرقم المرجعي (اختياري / من الرسالة)' : 'Transaction ID / Reference (Optional)'}
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder={isRtl ? 'مثال: TXN-1928301' : 'e.g. TXN-1928301'}
                className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-[#181423] border border-neutral-200 dark:border-[#2b243b] rounded-2xl focus:bg-white dark:focus:bg-[#1f1a2d] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          {/* No Image Upload Reassurance Badge */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div className="text-start">
              <p className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                {isRtl ? 'لا حاجة لرفع صورة إيصال أو لقطة شاشة' : 'No screenshot upload required'}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                {isRtl
                  ? 'يكتفي المشرف برقم الهاتف المحول منه أو كود العملية للتحقق من وصول المبلغ وتأكيد الطلب فوراً.'
                  : 'Our supervisor verifies your transfer instantly using the sender phone number or reference.'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/20 hover:shadow-2xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isRtl ? 'تأكيد إرسال بيانات الدفع للمشرف' : 'Confirm & Submit Payment Details to Admin'}</span>
              </>
            )}
          </button>

          {onCancelClick && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onCancelClick}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors py-1.5 px-4 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>
                  {isRtl
                    ? 'لا ترغب في إكمال الشراء بهذا السعر؟ اضغط هنا لإلغاء الطلب'
                    : 'Do not want to proceed with this price? Click here to cancel order'}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
