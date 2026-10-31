'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractSheinUrl } from '@/lib/shein-extractor';
import { ExtractedCartResult } from '@/lib/types';
import { useThemeLang } from '@/lib/theme-lang-context';
import { SheinLinkGuide } from './SheinLinkGuide';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Link2,
  ClipboardPaste,
  ClipboardCheck,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Zap,
  RotateCcw,
  Shirt,
} from 'lucide-react';

interface CartExtractorCardProps {
  onExtracted: (result: ExtractedCartResult) => void;
  currentDynamicFeePercent: number;
}

export function CartExtractorCard({ onExtracted, currentDynamicFeePercent }: CartExtractorCardProps) {
  const { t, dir } = useThemeLang();
  const isRtl = dir === 'rtl';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'new' || window.location.hash === '#cart-extractor-card') {
        const el = document.getElementById('cart-extractor-card');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (textareaRef.current) {
          setTimeout(() => textareaRef.current?.focus(), 450);
        }
      }
    }
  }, []);

  const handleTextChange = (val: string) => {
    setInputText(val);
    setError(null);
    const link = extractSheinUrl(val);
    setDetectedUrl(link);
  };

  // One-click clipboard paste handler
  const handlePasteClipboard = async () => {
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          handleTextChange(clipText.trim());
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 2500);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read error or not permitted:', err);
    }

    // Fallback: focus input and inform user
    if (textareaRef.current) {
      textareaRef.current.focus();
      setError(
        isRtl
          ? 'المربع جاهز للكتابة أو اللصق! اضغطي ضغطة مطولة داخل المربع واختاري لصق (Paste).'
          : 'Input is focused! Long press inside the box and choose Paste.'
      );
    }
  };

  const handleClear = () => {
    setInputText('');
    setDetectedUrl(null);
    setError(null);
  };

  const handleExtract = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) {
      setError(
        isRtl
          ? 'من فضلكِ الصقي رابط السلة أو المنتج أولاً في المربع المخصص بالأسفل.'
          : 'Please paste your SHEIN cart share text or URL first.'
      );
      if (textareaRef.current) textareaRef.current.focus();
      return;
    }

    const cleanUrl = extractSheinUrl(inputText);
    if (!cleanUrl) {
      setError(
        isRtl
          ? 'لم نتمكن من العثور على رابط شي إن صالح. تأكدي أن النص يحتوي على رابط مثل onelink.shein.com أو shein.com'
          : 'No valid SHEIN URL detected. Make sure your message contains a SHEIN link.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          dynamicFeePercent: currentDynamicFeePercent > 0 ? currentDynamicFeePercent : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error ||
            (isRtl
              ? 'تعذر استخراج المنتجات من رابط شي إن.'
              : 'Failed to extract goods from SHEIN link.')
        );
      }

      onExtracted(json.data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while connecting to SHEIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      id="cart-extractor-card"
      className="relative rounded-[36px] p-6 sm:p-10 bg-white/95 dark:bg-[#13101c]/95 backdrop-blur-2xl border-2 border-purple-200/80 dark:border-[#2f2742] shadow-[0_16px_50px_rgb(124,58,237,0.08)] dark:shadow-[0_16px_50px_rgb(0,0,0,0.6)] space-y-7 transition-colors overflow-hidden"
    >
      {/* Decorative ambient gradient backdrop */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-500/15 dark:bg-purple-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-pink-500/10 dark:bg-pink-600/10 blur-3xl pointer-events-none" />

      {/* Top Graphic Header */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 pb-2">
        <div className="space-y-2 text-center sm:text-start">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-100/90 dark:bg-purple-950/70 text-[#7C3AED] dark:text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-200 dark:border-purple-800">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              {isRtl ? 'المستخرج الذكي لسلات شي إن' : t.extractorBadge}
            </span>
            {currentDynamicFeePercent > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-[#201a2d] text-neutral-600 dark:text-neutral-400 text-[11px] font-semibold border border-neutral-200/60 dark:border-[#2f2742]">
                +{currentDynamicFeePercent}% {t.feeLabel}
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-neutral-950 dark:text-white tracking-tight text-balance">
            {isRtl ? 'معاكي سلة أو فستان من شي إن؟' : t.extractorTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 max-w-lg leading-relaxed font-medium text-balance">
            {isRtl
              ? 'الصقي الرابط في الصندوق بالأسفل، وسنقوم بحساب الإجمالي بالجنيه المصري ومراجعة المقاسات والشراء والتوصيل لباب بيتك!'
              : t.extractorDesc}
          </p>
        </div>

        {/* Fashion Cart Visual Badge */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: 2 }}
          transition={{ duration: 0.3 }}
          className="relative w-28 h-28 shrink-0 flex items-center justify-center cursor-default"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/70 to-pink-200/50 dark:from-purple-900/40 dark:to-pink-950/20 rounded-3xl scale-95 blur-xs" />
          <div className="relative z-10 w-24 h-24 rounded-3xl bg-white dark:bg-[#1b1726] border-2 border-purple-200 dark:border-purple-800 flex flex-col items-center justify-center gap-1 shadow-md">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-purple-700 dark:text-purple-300">SHEIN EG</span>
          </div>
        </motion.div>
      </div>

      {/* Pill Feature Badges */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-neutral-100/90 dark:bg-[#1a1626] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-[#2f2742]">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          {isRtl ? 'حساب فوري بسعر الصرف الرسمي' : t.autoLinkBadge}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-neutral-100/90 dark:bg-[#1a1626] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-[#2f2742]">
          <CreditCard className="w-3.5 h-3.5 text-purple-500" />
          {isRtl ? 'الدفع بـ InstaPay وفودافون كاش' : t.paymentBadge}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-neutral-100/90 dark:bg-[#1a1626] text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-[#2f2742]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          {isRtl ? 'فحص المقاسات والجمارك مجاناً' : t.adminVerifiedBadge}
        </span>
      </div>

      {/* 1. Visual Guide / Walkthrough on How to get the SHEIN Link */}
      <div className="relative z-10">
        <SheinLinkGuide />
      </div>

      {/* 2. THE MAIN HERO DROPZONE: "الصندوق المخصص للرابط" */}
      <form onSubmit={handleExtract} className="relative z-10 space-y-4 pt-1">
        {/* Visual Callout Heading with pointer arrow */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xl animate-bounce">👇</span>
            <label
              htmlFor="shein-cart-input"
              className="text-sm sm:text-base font-black text-neutral-950 dark:text-white flex items-center gap-2"
            >
              <span>{isRtl ? 'الصقي رابط سلتك أو منتجك هنا في هذا الصندوق:' : 'Paste your SHEIN link here:'}</span>
            </label>
          </div>

          {/* Quick Action Buttons (Paste & Clear) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                pasteSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/70 dark:hover:bg-purple-900/80 text-[#7C3AED] dark:text-purple-300 border border-purple-300 dark:border-purple-800'
              }`}
              title={isRtl ? 'لصق الرابط من الحافظة مباشرة' : 'Paste from clipboard'}
            >
              {pasteSuccess ? (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{isRtl ? 'تم اللصق! ✨' : 'Pasted!'}</span>
                </>
              ) : (
                <>
                  <ClipboardPaste className="w-4 h-4" />
                  <span>{isRtl ? 'لصق من الحافظة (Paste)' : 'Paste from Clipboard'}</span>
                </>
              )}
            </button>

            {inputText.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title={isRtl ? 'مسح الرابط' : 'Clear'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Input Box Container with prominent glowing focus border */}
        <div className="relative rounded-3xl border-2 border-purple-300/80 dark:border-purple-700/80 focus-within:border-[#7C3AED] dark:focus-within:border-[#9333EA] focus-within:ring-4 focus-within:ring-purple-500/20 transition-all bg-[#FAF8FE] dark:bg-[#161224] shadow-sm overflow-hidden">
          {/* Header indicator inside the box */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-2 border-b border-purple-100 dark:border-purple-950/60 bg-purple-50/50 dark:bg-purple-950/30">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              <span className="text-xs font-black text-purple-900 dark:text-purple-200">
                {isRtl ? 'مربع استخراج سلة شي إن الذكي' : 'SHEIN Cart Extractor Input'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
              <Shirt className="w-3 h-3 text-pink-500" />
              <span>{isRtl ? 'يقبل السلة أو أي منتج منفرد' : 'Cart or single item'}</span>
            </div>
          </div>

          <textarea
            id="shein-cart-input"
            ref={textareaRef}
            rows={4}
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              isRtl
                ? 'الصقي هنا رابط السلة (مثال: https://onelink.shein.com/... أو رابط أي فستان/منتج) أو رسالة المشاركة كاملة كما نسختيها من تطبيق شي إن...'
                : 'Paste your SHEIN cart link (https://onelink.shein.com/...) or single item link here...'
            }
            className="w-full px-4 sm:px-5 py-3.5 text-xs sm:text-sm text-neutral-900 dark:text-white bg-transparent focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-sans resize-y leading-relaxed font-medium"
          />

          {/* Bottom Bar inside the box */}
          <div className="px-4 sm:px-5 py-2.5 bg-neutral-100/60 dark:bg-[#130f1e] border-t border-purple-100 dark:border-purple-950/60 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isRtl ? 'جاهز لاستقبال الروابط' : 'Ready for links'}</span>
            </span>
            <span className="font-mono tabular-nums text-[11px]">
              {inputText.length} {t.chars}
            </span>
          </div>
        </div>

        {/* Real-time Link Detection Celebration Banner */}
        <AnimatePresence>
          {detectedUrl && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-purple-50 to-emerald-50 dark:from-emerald-950/40 dark:via-purple-950/40 dark:to-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 text-neutral-900 dark:text-white text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="font-black text-emerald-800 dark:text-emerald-300 block text-xs">
                    {isRtl ? '🎉 ممتاز! تم التعرف على رابط شي إن بنجاح' : 'Great! Valid SHEIN Link Detected'}
                  </span>
                  <span className="truncate font-mono text-[11px] text-neutral-600 dark:text-neutral-300 block mt-0.5 max-w-sm sm:max-w-md">
                    {detectedUrl}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 animate-pulse">
                  {isRtl ? 'اضغطي الزر البنفسجي بالأسفل ⬇️' : 'Click the button below ⬇️'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Feedback */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Supported formats pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
          <span className="font-black text-neutral-700 dark:text-neutral-300">
            {isRtl ? 'صيغ الروابط المقبولة:' : 'Accepted formats:'}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-[#1d1728] border border-neutral-200/60 dark:border-neutral-700">
            🛒 {isRtl ? 'سلة كاملة (onelink.shein.com)' : 'Full Cart'}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-[#1d1728] border border-neutral-200/60 dark:border-neutral-700">
            👗 {isRtl ? 'رابط منتج أو فستان منفرد' : 'Single Item'}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-[#1d1728] border border-neutral-200/60 dark:border-neutral-700">
            💬 {isRtl ? 'رسالة مشاركة منسوجة كاملة' : 'Full WhatsApp Share'}
          </span>
        </div>

        {/* Submit Button & Payment Trust Logos */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-200/70 dark:border-[#201a2d]">
          {/* Payment Logos Badge */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
              {isRtl ? 'الدفع متاح عبر:' : 'Payment via:'}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-7 px-2.5 py-0.5 rounded-xl bg-white dark:bg-[#1b1726] border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 shadow-2xs">
                <img src="/images/instapay.png" alt="InstaPay" className="h-4 object-contain" />
                <span className="text-[10px] font-black text-purple-700 dark:text-purple-300">InstaPay</span>
              </div>
              <div className="h-7 px-2.5 py-0.5 rounded-xl bg-white dark:bg-[#1b1726] border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 shadow-2xs">
                <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="h-4 object-contain" />
                <span className="text-[10px] font-black text-rose-700 dark:text-rose-300">Vodafone Cash</span>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            type="submit"
            disabled={loading}
            className={`relative overflow-hidden group w-full sm:w-auto px-8 py-4 text-white font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-[0.98] ${
              detectedUrl
                ? 'bg-gradient-to-r from-purple-600 via-[#7C3AED] to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-500/40 ring-4 ring-purple-500/25 animate-pulse'
                : 'bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] shadow-purple-500/25'
            } disabled:opacity-50`}
          >
            {/* Subtle transition sheen sweep on hover (transitions.dev & make-interfaces-feel-better) */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isRtl ? 'جاري قراءة المنتجات وتحديث الأسعار...' : t.extracting}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" />
                <span>{isRtl ? 'استخراج السلة وحساب الإجمالي بالجنيه 🚀' : t.extractBtn}</span>
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
