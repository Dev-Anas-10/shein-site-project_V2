'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ExtractedCartResult, SystemSettings, Order } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import { Navbar } from '@/components/Navbar';
import { CartExtractorCard } from '@/components/CartExtractorCard';
import { ExtractedGoodsView } from '@/components/ExtractedGoodsView';
import { AuthModal } from '@/components/AuthModal';
import { FullPageLoginCard } from '@/components/FullPageLoginCard';
import { CustomSectionRenderer } from '@/components/CustomSectionRenderer';
import { getClientOrders, mergeAndDeduplicateOrders, syncClientOrdersWithServer } from '@/lib/order-storage';
import { SafeImage } from '@/components/SafeImage';
import { ShipmentBatchLiveNudge } from '@/components/marketing/ShipmentBatchLiveNudge';
import { TrustAndGuarantees } from '@/components/marketing/TrustAndGuarantees';
import { ObjectionsFaq } from '@/components/marketing/ObjectionsFaq';

import {
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t, dir } = useThemeLang();
  const [guestMode, setGuestMode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCartResult | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    // 1. Fetch system settings
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSettings(data.data);
      })
      .catch((err) => console.error(err));

    // 2. Fetch orders ONLY if logged in (strict privacy)
    if (!user) {
      setRecentOrders([]);
      setGuestMode(false);
      setExtractedData(null);
      return;
    }

    const clientSaved = getClientOrders(user.id, user.email);
    fetch(
      `/api/orders?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || '')}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          syncClientOrdersWithServer(user.id, user.email, data.data);
          setRecentOrders(data.data.slice(0, 3));
        } else if (clientSaved.length > 0) {
          setRecentOrders(clientSaved.slice(0, 3));
        }
      })
      .catch(() => {
        if (clientSaved.length > 0) {
          setRecentOrders(clientSaved.slice(0, 3));
        }
      });
  }, [user]);

  const handleOrderCreated = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const shouldReduceMotion = useReducedMotion();
  const travelY = shouldReduceMotion ? 0 : 12;
  const FARMER_EASING = [0.22, 1, 0.36, 1] as const;

  // Rule 3 & 4: Hero entrances 0.8s on mount, ease [0.22, 1, 0.36, 1], delay 0
  const heroEntrance = {
    initial: { opacity: 0, y: travelY },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: FARMER_EASING, delay: 0 },
  };

  // Rule 3 & 4: Scroll reveals 1.0s, delay 0.1s from entering view, threshold 0.15
  const scrollReveal = {
    initial: { opacity: 0, y: travelY },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 1.0, delay: 0.1, ease: FARMER_EASING },
  };

  // Rule 6: Interactive button & card feedback
  const interactiveFeedback = {
    whileHover: { scale: 1.01 },
    whileTap: { scale: 0.99 },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0713] flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !guestMode) {
    return <FullPageLoginCard onGuestContinue={() => setGuestMode(true)} />;
  }

  const topSections = settings?.customSections?.filter((s) => s.enabled && s.position === 'top') || [];
  const middleSections = settings?.customSections?.filter((s) => s.enabled && s.position === 'middle') || [];
  const bottomSections = settings?.customSections?.filter((s) => s.enabled && s.position === 'bottom') || [];

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white pb-32 md:pb-24 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 bg-gradient-to-b from-purple-400/8 via-pink-400/4 to-transparent dark:from-purple-600/10 dark:via-purple-900/5 dark:to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Optional Top Announcement Bar Configured by Admin */}
      {settings?.announcementEnabled !== false && settings?.announcementText && (
        <div
          className={`w-full py-2.5 px-4 text-center text-xs font-black shadow-xs transition-colors flex items-center justify-center gap-2 ${
            settings?.announcementBg === 'amber'
              ? 'bg-amber-400 text-amber-950'
              : settings?.announcementBg === 'emerald'
              ? 'bg-emerald-600 text-white'
              : settings?.announcementBg === 'rose'
              ? 'bg-rose-600 text-white'
              : 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-90" />
          <span>{settings.announcementText}</span>
        </div>
      )}

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        {!extractedData ? (
          <div className="space-y-10">
            {/* Header Title: Rule 3 & 4 (Hero entrance 0.8s on mount) */}
            <motion.div {...heroEntrance} className="text-center sm:text-start space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200/60 dark:border-purple-800/60 text-[#7C3AED] dark:text-purple-300 text-xs font-black uppercase tracking-wider shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{settings?.heroBadge || t.heroBadge}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-neutral-950 dark:text-white tracking-tight leading-tight text-balance">
                {settings?.heroTitle || t.heroTitle}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed text-balance">
                {settings?.heroSubtitle || t.heroSubtitle}
              </p>
            </motion.div>

            {/* Custom Sections: Top Position */}
            {topSections.map((sec) => (
              <motion.div key={sec.id} {...heroEntrance}>
                <CustomSectionRenderer section={sec} dir={dir} />
              </motion.div>
            ))}

            {/* Live Shipment Batch Nudge: Urgency & Scarcity */}
            <motion.div {...heroEntrance}>
              <ShipmentBatchLiveNudge />
            </motion.div>

            {/* Main Extractor Card: Hero Entrance */}
            <motion.div {...heroEntrance}>
              <CartExtractorCard
                onExtracted={(result) => setExtractedData(result)}
                currentDynamicFeePercent={settings?.dynamicFeePercent ?? 0}
              />
            </motion.div>

            {/* Trust Metrics Bar: Scroll Reveal with Rule 6 interactive feedback */}
            {settings?.trustMetricsEnabled !== false && (
              <motion.div
                {...scrollReveal}
                className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2"
              >
                <motion.div {...interactiveFeedback} className="p-4 rounded-2xl bg-white/70 dark:bg-[#14111d]/70 backdrop-blur-md border border-neutral-200/60 dark:border-[#2a243a] flex items-center gap-3 cursor-pointer">
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1b1726] p-1 border border-purple-200/80 dark:border-purple-800/80 shadow-xs flex items-center justify-center overflow-hidden">
                      <img src="/images/instapay.png" alt="InstaPay" className="w-full h-full object-contain" />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1b1726] p-0.5 border border-rose-200/80 dark:border-rose-800/80 shadow-xs flex items-center justify-center overflow-hidden">
                      <img src="/images/vodafone-cash.png" alt="Vodafone Cash" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">
                      {settings?.enableInstapay ? (dir === 'rtl' ? 'إنستاباي وفودافون كاش' : 'InstaPay & Vodafone') : 'Mobile Wallets'}
                    </h4>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{dir === 'rtl' ? 'دفع فوري بالجنيه المصري' : 'Instant EGP Transfer'}</p>
                  </div>
                </motion.div>

                <motion.div {...interactiveFeedback} className="p-4 rounded-2xl bg-white/70 dark:bg-[#14111d]/70 backdrop-blur-md border border-neutral-200/60 dark:border-[#2a243a] flex items-center gap-3 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">{dir === 'rtl' ? 'فحص ومراجعة دقيقة' : 'Supervisor Verified'}</h4>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{dir === 'rtl' ? 'ضمان توافر المقاسات' : 'Inventory & size check'}</p>
                  </div>
                </motion.div>

                <motion.div {...interactiveFeedback} className="p-4 rounded-2xl bg-white/70 dark:bg-[#14111d]/70 backdrop-blur-md border border-neutral-200/60 dark:border-[#2a243a] flex items-center gap-3 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">{dir === 'rtl' ? 'توصيل لباب بيتك' : 'Doorstep Delivery'}</h4>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{dir === 'rtl' ? 'كل محافظات مصر' : 'Across all Egypt'}</p>
                  </div>
                </motion.div>

                <motion.div {...interactiveFeedback} className="p-4 rounded-2xl bg-white/70 dark:bg-[#14111d]/70 backdrop-blur-md border border-neutral-200/60 dark:border-[#2a243a] flex items-center gap-3 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-blue-100/70 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">{dir === 'rtl' ? 'خصوصية كاملة' : '100% Privacy'}</h4>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{dir === 'rtl' ? 'طلباتك محمية وموثقة' : 'Strict user data security'}</p>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Risk Reversal & Trust Guarantees */}
            <motion.div {...scrollReveal}>
              <TrustAndGuarantees />
            </motion.div>

            {/* Custom Sections: Middle Position with Scroll Reveal */}
            {middleSections.map((sec) => (
              <motion.div key={sec.id} {...scrollReveal}>
                <CustomSectionRenderer section={sec} dir={dir} />
              </motion.div>
            ))}

            {/* Latest Orders Section with Scroll Reveal */}
            {user && recentOrders.length > 0 && (
              <motion.div {...scrollReveal} className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-black text-neutral-900 dark:text-white text-lg">
                    {t.latestActivity}
                  </h3>
                  <Link
                    href="/orders"
                    className="text-xs font-black text-[#8B5CF6] hover:text-[#7C3AED] transition-colors flex items-center gap-1 group"
                  >
                    <span>{t.seeAll}</span>
                    {dir === 'rtl' ? (
                      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    )}
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {recentOrders.map((ord, idx) => (
                    <motion.div
                      key={ord.id}
                      initial={{ opacity: 0, y: travelY }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{
                        duration: 1.0,
                        delay: 0.1 + idx * 0.1,
                        ease: FARMER_EASING,
                      }}
                      {...interactiveFeedback}
                      className="h-full"
                    >
                      <Link
                        href={`/orders/${ord.id}`}
                        className="bg-white/90 dark:bg-[#14111d]/90 backdrop-blur-md rounded-3xl p-5 border border-neutral-200/70 dark:border-[#2a243a] shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col justify-between gap-4 group h-full cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 overflow-hidden shrink-0 border border-neutral-100 dark:border-[#2a243a]">
                            {ord.items[0]?.image ? (
                              <SafeImage
                                src={ord.items[0].image}
                                alt={ord.items[0].name || ''}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-purple-400">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-0.5 overflow-hidden">
                            <span className="font-mono font-black text-xs text-neutral-900 dark:text-white block group-hover:text-[#8B5CF6] transition-colors">
                              {ord.id}
                            </span>
                            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block truncate">
                              {ord.items.length} {t.goodsCount} • {new Date(ord.createdAt).toLocaleDateString()}
                            </span>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300">
                              {ord.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 dark:border-[#221c2d] flex items-center justify-between text-xs">
                          <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">
                            {t.totalCashLabel}
                          </span>
                          <span className="font-black text-neutral-900 dark:text-white">
                            {ord.totalCash.toLocaleString()} EGP
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Three Step Workflow: Rule 5 (Sibling stagger 0.1s in reading order) */}
            {settings?.howItWorksEnabled !== false && (
              <motion.div {...scrollReveal} className="space-y-3 pt-2">
                <h3 className="font-black text-neutral-900 dark:text-white text-lg px-1">
                  {dir === 'rtl' ? 'كيف تعمل خدمة SHEIN Concierge؟' : 'How SHEIN Concierge Works'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { step: 1, title: settings?.step1Title || t.step1Title, desc: settings?.step1Desc || t.step1Desc },
                    { step: 2, title: settings?.step2Title || t.step2Title, desc: settings?.step2Desc || t.step2Desc },
                    { step: 3, title: settings?.step3Title || t.step3Title, desc: settings?.step3Desc || t.step3Desc },
                  ].map((s, idx) => (
                    <motion.div
                      key={s.step}
                      initial={{ opacity: 0, y: travelY }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{
                        duration: 1.0,
                        delay: 0.1 + idx * 0.1,
                        ease: FARMER_EASING,
                      }}
                      {...interactiveFeedback}
                      className="bg-white/90 dark:bg-[#14111d]/90 backdrop-blur-md p-6 rounded-3xl border border-neutral-200/70 dark:border-[#2a243a] shadow-xs space-y-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#C084FC] text-white flex items-center justify-center font-black text-sm shadow-sm shadow-purple-500/20">
                        {s.step}
                      </div>
                      <h4 className="font-black text-neutral-950 dark:text-white text-sm">
                        {s.title}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {s.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Pre-Purchase Objection Handling FAQ */}
            <motion.div {...scrollReveal}>
              <ObjectionsFaq />
            </motion.div>

            {/* Custom Sections: Bottom Position with Scroll Reveal */}
            {bottomSections.map((sec) => (
              <motion.div key={sec.id} {...scrollReveal}>
                <CustomSectionRenderer section={sec} dir={dir} />
              </motion.div>
            ))}
          </div>
        ) : (
          <ExtractedGoodsView
            data={extractedData}
            onBack={() => setExtractedData(null)}
            onOrderCreated={handleOrderCreated}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
