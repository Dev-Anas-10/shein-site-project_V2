'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CustomSection, CustomSectionCard } from '@/lib/types';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Truck,
  CreditCard,
  Heart,
  HelpCircle,
  AlertCircle,
  Info,
  Clock,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface CustomSectionRendererProps {
  section: CustomSection;
  dir?: 'rtl' | 'ltr';
}

function getIconComponent(iconName?: string) {
  switch (iconName?.toLowerCase()) {
    case 'shieldcheck':
    case 'shield':
      return <ShieldCheck className="w-5 h-5" />;
    case 'truck':
    case 'shipping':
      return <Truck className="w-5 h-5" />;
    case 'creditcard':
    case 'payment':
      return <CreditCard className="w-5 h-5" />;
    case 'sparkles':
    case 'star':
      return <Sparkles className="w-5 h-5" />;
    case 'heart':
      return <Heart className="w-5 h-5" />;
    case 'clock':
    case 'time':
      return <Clock className="w-5 h-5" />;
    case 'alert':
    case 'alertcircle':
      return <AlertCircle className="w-5 h-5" />;
    case 'help':
    case 'helpcircle':
      return <HelpCircle className="w-5 h-5" />;
    default:
      return <CheckCircle2 className="w-5 h-5" />;
  }
}

export function CustomSectionRenderer({ section, dir = 'rtl' }: CustomSectionRendererProps) {
  if (!section.enabled) return null;

  const isRtl = dir === 'rtl';

  // Theme styling
  const themeClasses = {
    purple: {
      container: 'bg-gradient-to-br from-purple-50/70 via-white to-purple-100/40 dark:from-purple-950/20 dark:via-[#14101e] dark:to-purple-950/10 border-purple-200/60 dark:border-purple-800/40',
      badge: 'bg-purple-100 dark:bg-purple-900/60 text-[#7C3AED] dark:text-purple-300',
      iconBox: 'bg-purple-100 dark:bg-purple-900/40 text-[#7C3AED] dark:text-purple-300',
    },
    amber: {
      container: 'bg-gradient-to-br from-amber-50/70 via-white to-amber-100/40 dark:from-amber-950/20 dark:via-[#14101e] dark:to-amber-950/10 border-amber-200/60 dark:border-amber-800/40',
      badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300',
      iconBox: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    },
    emerald: {
      container: 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-100/40 dark:from-emerald-950/20 dark:via-[#14101e] dark:to-emerald-950/10 border-emerald-200/60 dark:border-emerald-800/40',
      badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300',
      iconBox: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    },
    dark: {
      container: 'bg-[#0f0c18] border-[#29223a] text-white',
      badge: 'bg-purple-950/80 text-purple-300',
      iconBox: 'bg-purple-900/40 text-purple-300',
    },
    glass: {
      container: 'bg-white/80 dark:bg-[#14101e]/80 backdrop-blur-xl border-neutral-200/70 dark:border-[#2f2742]',
      badge: 'bg-purple-100/70 dark:bg-purple-950/50 text-[#7C3AED] dark:text-purple-300',
      iconBox: 'bg-neutral-100 dark:bg-[#201a2e] text-[#8B5CF6]',
    },
  }[section.theme || 'purple'];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className={`p-6 sm:p-8 rounded-[32px] border shadow-xs space-y-6 relative overflow-hidden ${themeClasses.container}`}
    >
      {/* Header */}
      <div className="space-y-2 text-start">
        {section.badge && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${themeClasses.badge}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{section.badge}</span>
          </div>
        )}
        <h3 className="text-xl sm:text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
          {section.title}
        </h3>
        {section.subtitle && (
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {section.subtitle}
          </p>
        )}
      </div>

      {/* Body Content by Type */}
      {section.type === 'cards' && section.cards && section.cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {section.cards.map((card, i) => (
            <motion.div
              key={card.id || i}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-5 rounded-2xl bg-white/90 dark:bg-[#1a1626]/90 backdrop-blur-md border border-neutral-200/70 dark:border-[#2e2640] shadow-xs space-y-2.5 text-start"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${themeClasses.iconBox}`}>
                {getIconComponent(card.icon)}
              </div>
              <h4 className="font-black text-sm text-neutral-950 dark:text-white">
                {card.title}
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {section.type === 'banner' && section.content && (
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-[#1a1626]/90 border border-neutral-200/70 dark:border-[#2e2640] text-start">
          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line">
            {section.content}
          </p>
        </div>
      )}

      {section.type === 'text' && section.content && (
        <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line text-start bg-white/50 dark:bg-[#161220]/50 p-5 rounded-2xl border border-neutral-100 dark:border-[#261f36]">
          {section.content}
        </div>
      )}

      {section.type === 'faq' && section.content && (
        <div className="space-y-3 pt-1">
          {section.content.split('\n\n').map((qa, index) => {
            const [q, ...aLines] = qa.split('\n');
            const a = aLines.join(' ');
            return (
              <details
                key={index}
                className="group p-4 rounded-2xl bg-white/80 dark:bg-[#1a1626]/80 border border-neutral-200/60 dark:border-[#2b243b] text-start cursor-pointer open:bg-white dark:open:bg-[#1e192c] transition-all"
              >
                <summary className="font-extrabold text-sm text-neutral-900 dark:text-white flex items-center justify-between list-none">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                    <span>{q.replace(/^[Q:\-?# ]+/, '')}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-neutral-400 group-open:rotate-180 transition-transform shrink-0" />
                </summary>
                {a && (
                  <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed pl-6 pr-6">
                    {a.replace(/^[A:\- ]+/, '')}
                  </p>
                )}
              </details>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
