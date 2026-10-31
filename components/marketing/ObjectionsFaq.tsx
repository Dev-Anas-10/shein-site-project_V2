'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useThemeLang } from '@/lib/theme-lang-context';

export function ObjectionsFaq() {
  const { dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: isRtl ? 'إزاي بطلب وأدفع بالجنيه المصري؟' : 'How do I order and pay in EGP?',
      a: isRtl
        ? 'ببساطة بتنسخي رابط سلتك من تطبيق SHEIN وتلصقيه هنا، الموقع هيحسبلك الإجمالي بالجنيه المصري شامل كل شيء، وبعد المراجعة بتدفعي فوري عبر InstaPay أو فودافون كاش.'
        : 'Simply copy your cart share link from the SHEIN app and paste it here. We calculate the exact total in EGP, and you pay easily via InstaPay or Vodafone Cash.',
    },
    {
      q: isRtl ? 'هل فيه أي مصاريف جمركية مفاجئة عند الاستلام؟' : 'Are there any surprise customs fees on delivery?',
      a: isRtl
        ? 'إطلاقاً! الإجمالي المحسوب في سلتك شامل مصاريف الشراء والتخليص الجمركي والتوصيل. مفيش أي مليم إضافي بتدفعيه عند الاستلام لباب بيتك.'
        : 'Zero surprises! The total calculated in your cart covers everything including purchasing, customs, and delivery to your doorstep.',
    },
    {
      q: isRtl ? 'الشحنة بتاخد وقت قد إيه عشان توصل؟' : 'How long does delivery take?',
      a: isRtl
        ? 'الأوردرات بتتقسم في شحنات جوية أسبوعية منتظمة بتتحرك مباشرة، والشحنة بتوصل لباب بيتك في أي مكان في مصر خلال ١٠ إلى ١٤ يوم عمل مع إمكانية التتبع لحظة بلحظة.'
        : 'Orders are consolidated into weekly expedited air batches. Your package arrives at your doorstep across Egypt in 10-14 business days with live tracking.',
    },
    {
      q: isRtl ? 'لو فيه قطعة خلصت أو مقاسها نفد في شي إن، إيه اللي بيحصل؟' : 'What if an item goes out of stock on SHEIN?',
      a: isRtl
        ? 'المشرف بيتواصل معاكِ فوراً قبل الشراء، ولو حبيتي تلغي القطعة أو تبدليها، بنردلك كامل المبلغ بالجنيه فوراً على حسابك بـ InstaPay خلال دقائق وبدون أي خصومات.'
        : 'Our supervisor contacts you immediately before ordering. You can swap it or get an instant 100% refund via InstaPay in minutes.',
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <div className="text-center sm:text-start space-y-1 px-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 text-[11px] font-black uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{isRtl ? 'الأسئلة الشائعة والإجابات 💡' : 'Frequently Asked Questions 💡'}</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          {isRtl ? 'كل ما تحتاجين معرفته قبل الطلب' : 'Everything You Need to Know'}
        </h3>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-neutral-200/80 dark:border-[#2a243a] bg-white/80 dark:bg-[#14111d]/80 backdrop-blur-md overflow-hidden transition-all shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-start hover:bg-neutral-50 dark:hover:bg-[#1b1726] transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">Q:</span>
                  <span>{faq.q}</span>
                </span>
                <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#201a2d] flex items-center justify-center text-neutral-500 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-neutral-100 dark:border-[#201a2d]"
                  >
                    <p className="px-5 py-3.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
