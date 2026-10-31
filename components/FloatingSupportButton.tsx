'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useThemeLang } from '@/lib/theme-lang-context';
import { SupportModal } from './SupportModal';

export function FloatingSupportButton() {
  const [open, setOpen] = useState(false);
  const { lang, dir } = useThemeLang();

  const isRtl = dir === 'rtl';

  return (
    <>
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-40 hidden md:block`}>
        <motion.button
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] text-white font-extrabold text-xs rounded-full shadow-xl shadow-purple-500/30 transition-all cursor-pointer border border-white/20 dark:border-white/10"
          title={isRtl ? 'تحتاج مساعدة؟ تواصل مع الدعم الفني' : 'Need help? Contact Concierge Support'}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isRtl ? 'خدمة العملاء' : 'Support Contact'}
          </span>
        </motion.button>
      </div>

      <SupportModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
