'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeLang } from '@/lib/theme-lang-context';
import { SystemSettings } from '@/lib/types';
import {
  X,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Clock,
  ExternalLink,
  Mail,
  CreditCard,
  Wallet,
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  supportPhone?: string;
  supportWhatsapp?: string;
  supportEmail?: string;
  supportHours?: string;
  vodafoneNumber?: string;
  instapayAddress?: string;
  instapayPaymentUrl?: string;
  showPaymentInSupport?: boolean;
  enableInstapay?: boolean;
  enableVodafoneCash?: boolean;
  secondaryWalletNumber?: string;
  secondaryWalletName?: string;
}

export function SupportModal({
  isOpen,
  onClose,
  supportPhone: propPhone,
  supportWhatsapp: propWhatsapp,
  supportEmail: propEmail,
  supportHours: propHours,
  vodafoneNumber: propVodafone,
  instapayAddress: propInstapay,
  instapayPaymentUrl: propInstapayUrl,
  showPaymentInSupport: propShowPayment,
  enableInstapay: propEnableInstapay,
  enableVodafoneCash: propEnableVodafone,
  secondaryWalletNumber: propSecondaryWallet,
  secondaryWalletName: propSecondaryName,
}: SupportModalProps) {
  const { t, dir } = useThemeLang();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            setSettings(d.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve values: passed props take highest priority, then fetched live settings, then fallback defaults
  const supportPhone =
    propPhone ?? settings?.supportPhone ?? '+20 128 494 7782';
  const supportWhatsapp =
    propWhatsapp ?? settings?.supportWhatsapp ?? supportPhone;
  const supportEmail =
    propEmail ?? settings?.supportEmail ?? 'gamallahmedd01@gmail.com';
  const supportHours =
    propHours ??
    settings?.supportHours ??
    (dir === 'rtl'
      ? 'خدمة العملاء يومياً من ٩:٠٠ صباحاً حتى ١١:٠٠ مساءً (بتوقيت القاهرة)'
      : 'Daily support: 9:00 AM – 11:00 PM (Cairo Time)');

  const showPaymentInSupport =
    propShowPayment ?? settings?.showPaymentInSupport ?? true;
  const enableInstapay =
    propEnableInstapay ?? settings?.enableInstapay ?? true;
  const enableVodafoneCash =
    propEnableVodafone ?? settings?.enableVodafoneCash ?? true;

  const instapayAddress =
    propInstapay ?? settings?.instapayAddress ?? 'anasashraf10@instapay';
  const instapayPaymentUrl =
    propInstapayUrl ?? settings?.instapayPaymentUrl ?? 'https://ipn.eg/S/anasashraf10/instapay/6OaEAR';
  const vodafoneNumber =
    propVodafone ?? settings?.vodafoneCashNumber ?? '01284947782';
  const secondaryWallet =
    propSecondaryWallet ?? settings?.secondaryWalletNumber ?? '';
  const secondaryName =
    propSecondaryName ?? settings?.secondaryWalletName ?? 'محفظة كاش إضافية';

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cleanWhatsapp = (supportWhatsapp || supportPhone).replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    dir === 'rtl'
      ? 'مرحبا، أود الاستفسار بخصوص طلبي من شي إن والدفع عبر إنستاباي أو فودافون كاش.'
      : 'Hello, I would like to inquire about my SHEIN order and InstaPay / Vodafone Cash payment.'
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-white dark:bg-[#14121a] text-neutral-900 dark:text-white rounded-[32px] shadow-2xl border border-neutral-100 dark:border-[#2a2538] overflow-hidden transition-colors"
      >
        {/* Header */}
        <div className="p-6 bg-[#F5EDFF] dark:bg-purple-950/40 border-b border-purple-100 dark:border-[#2a2538] flex items-center justify-between">
          <div className="space-y-1 text-start">
            <span className="text-[11px] font-bold text-[#7C3AED] dark:text-purple-300 uppercase tracking-wider block">
              SHEIN Concierge
            </span>
            <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {t.supportTitle}
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {t.supportDesc}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 dark:bg-[#1e1a29] hover:bg-white text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channels */}
        <div className="p-6 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
          {/* WhatsApp Direct Chat */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-start">
                <h4 className="font-extrabold text-neutral-900 dark:text-white text-sm">
                  {t.whatsappChat}
                </h4>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  {dir === 'rtl' ? 'رد فوري لمتابعة الطلبات وتأكيد الدفع' : 'Instant response for orders & payments'}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
          </a>

          {/* Direct Phone Call */}
          <div className="p-4 rounded-2xl border border-neutral-100 dark:border-[#2a2538] bg-neutral-50 dark:bg-[#1a1722] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Phone className="w-4 h-4" />
              </div>
              <div className="text-start">
                <h4 className="font-extrabold text-neutral-900 dark:text-white text-sm">
                  {t.phoneHotline}
                </h4>
                <p className="font-mono text-xs text-neutral-700 dark:text-neutral-300 font-bold" dir="ltr">
                  {supportPhone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`tel:${supportPhone}`}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#221e2d] border border-neutral-200 dark:border-[#2a2538] text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100"
              >
                {dir === 'rtl' ? 'اتصال' : 'Call'}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(supportPhone, 'phone')}
                className="p-1.5 rounded-xl bg-white dark:bg-[#221e2d] border border-neutral-200 dark:border-[#2a2538] text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                title="Copy phone"
              >
                {copiedField === 'phone' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Email Support Contact */}
          <div className="p-4 rounded-2xl border border-neutral-100 dark:border-[#2a2538] bg-neutral-50 dark:bg-[#1a1722] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Mail className="w-5 h-5" />
              </div>
              <div className="text-start">
                <h4 className="font-extrabold text-neutral-900 dark:text-white text-sm">
                  {t.emailSupport}
                </h4>
                <p className="font-mono text-xs text-neutral-700 dark:text-neutral-300 font-bold" dir="ltr">
                  {supportEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`mailto:${supportEmail}`}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#221e2d] border border-neutral-200 dark:border-[#2a2538] text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100"
              >
                {dir === 'rtl' ? 'إرسال' : 'Email'}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(supportEmail, 'email')}
                className="p-1.5 rounded-xl bg-white dark:bg-[#221e2d] border border-neutral-200 dark:border-[#2a2538] text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                title="Copy email"
              >
                {copiedField === 'email' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Payment Accounts Quick Reference (Only shown if enabled by admin!) */}
          {showPaymentInSupport && (enableInstapay || enableVodafoneCash || secondaryWallet) && (
            <div className="p-4 rounded-2xl border border-purple-100 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#6D28D9] dark:text-purple-300 text-xs block text-start">
                  {dir === 'rtl' ? 'بيانات التحويل المعتمدة في مصر:' : 'Official Payment Targets (Egypt):'}
                </span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                  {dir === 'rtl' ? 'معتمد' : 'Verified'}
                </span>
              </div>

              {enableInstapay && (
                <div className="flex items-center justify-between text-[11px] bg-white dark:bg-[#1a1722] p-2.5 rounded-xl border border-purple-100 dark:border-[#2a2538]">
                  <div className="text-start">
                    <span className="text-neutral-400 dark:text-neutral-500 block font-medium flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-[#7C3AED]" />
                      {t.instapayTitle}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white" dir="ltr">
                      {instapayAddress}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {instapayPaymentUrl && (
                      <a
                        href={instapayPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 font-bold text-[10px] hover:bg-purple-200 transition-colors flex items-center gap-1"
                      >
                        <span>{dir === 'rtl' ? 'إرسال نقود' : 'Send'}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(instapayAddress, 'instapay')}
                      className="text-[11px] font-bold text-[#7C3AED] dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'instapay' ? 'تم النسخ ✓' : (dir === 'rtl' ? 'نسخ' : 'Copy')}
                    </button>
                  </div>
                </div>
              )}

              {enableVodafoneCash && (
                <div className="flex items-center justify-between text-[11px] bg-white dark:bg-[#1a1722] p-2.5 rounded-xl border border-purple-100 dark:border-[#2a2538]">
                  <div className="text-start">
                    <span className="text-neutral-400 dark:text-neutral-500 block font-medium flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-rose-500" />
                      {t.vodafoneTitle}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white" dir="ltr">
                      {vodafoneNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(vodafoneNumber, 'vodafone')}
                    className="text-[11px] font-bold text-[#7C3AED] dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedField === 'vodafone' ? 'تم النسخ ✓' : (dir === 'rtl' ? 'نسخ' : 'Copy')}
                  </button>
                </div>
              )}

              {secondaryWallet && (
                <div className="flex items-center justify-between text-[11px] bg-white dark:bg-[#1a1722] p-2.5 rounded-xl border border-purple-100 dark:border-[#2a2538]">
                  <div className="text-start">
                    <span className="text-neutral-400 dark:text-neutral-500 block font-medium flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-amber-500" />
                      {secondaryName || (dir === 'rtl' ? 'محفظة كاش إضافية' : 'Secondary Wallet')}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white" dir="ltr">
                      {secondaryWallet}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(secondaryWallet, 'secondaryWallet')}
                    className="text-[11px] font-bold text-[#7C3AED] dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedField === 'secondaryWallet' ? 'تم النسخ ✓' : (dir === 'rtl' ? 'نسخ' : 'Copy')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Operating hours */}
          <div className="flex items-center gap-2 pt-1 text-neutral-500 dark:text-neutral-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>{supportHours}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
