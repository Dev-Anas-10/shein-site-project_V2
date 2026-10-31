'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, RefreshCw, CheckCircle2, Lock, Truck, HelpCircle } from 'lucide-react';
import { useThemeLang } from '@/lib/theme-lang-context';

export function TrustAndGuarantees() {
  const { dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  const guarantees = [
    {
      icon: RefreshCw,
      title: isRtl ? 'ضمان استرداد فوري ١٠٠٪' : '100% Instant Refund',
      desc: isRtl
        ? 'لو أي قطعة غير متاحة في شي إن، بنردلك المبلغ فوراً على حسابك أو محفظتك بـ InstaPay خلال دقائق.'
        : 'If an item is out of stock in SHEIN, we refund you instantly via InstaPay in minutes.',
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60',
    },
    {
      icon: CheckCircle2,
      title: isRtl ? 'فحص المقاسات والمخزون' : 'Size & Inventory Check',
      desc: isRtl
        ? 'المشرف بيتأكد من المقاس واللون وتطبيق كود الخصم الأنسب لسلتك قبل الدفع والتأكيد.'
        : 'Our team verifies your chosen sizes, colors, and applies the highest SHEIN coupon available.',
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60',
    },
    {
      icon: Lock,
      title: isRtl ? 'دفع محلي بدون كروت دولية' : 'Local Payment via InstaPay',
      desc: isRtl
        ? 'مش محتاجة فيزا دولية أو فتح حدود بنكية، ادفعي بالجنيه المصري بأمان على حساب موثق.'
        : 'No international credit cards needed. Pay in Egyptian Pounds securely via InstaPay.',
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60',
    },
    {
      icon: Truck,
      title: isRtl ? 'توصيل لباب بيتك وتتبع حي' : 'Doorstep Delivery & Tracking',
      desc: isRtl
        ? 'شحن آمن مع كبرى شركات الشحن (أرامكس ومحلياً) لجميع محافظات مصر وتتبع لحظي لشحنتك.'
        : 'Safe delivery across all Egyptian governorates with live SMS and web status updates.',
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <div className="text-center sm:text-start space-y-1 px-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isRtl ? 'ضمانات شي إن كونسيرج 🛡️' : 'Our Guarantees 🛡️'}</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          {isRtl ? 'تسوقي وأنتِ مطمئنة ١٠٠٪' : 'Shop with 100% Peace of Mind'}
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {isRtl
            ? 'صممنا الخدمة لتلغي كل مخاطر وعقبات الشراء الدولي من شي إن في مصر'
            : 'Designed to eliminate all frictions and anxieties of cross-border shopping'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {guarantees.map((g, idx) => {
          const Icon = g.icon;
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="p-5 rounded-3xl bg-white/90 dark:bg-[#14111d]/90 backdrop-blur-md border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs ${g.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                  {g.title}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {g.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-[#201b2d] flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{isRtl ? 'ضمان معتمد' : 'Guaranteed'}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
