'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';

export interface Translations {
  // Navigation
  brandTitle: string;
  brandSubtitle: string;
  extractCart: string;
  myOrders: string;
  admin: string;
  newOrder: string;
  support: string;
  signIn: string;
  signOut: string;
  toggleTheme: string;
  toggleLang: string;

  // Home Page
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  extractorBadge: string;
  extractorTitle: string;
  extractorDesc: string;
  placeholder: string;
  chars: string;
  acceptsHint: string;
  extractBtn: string;
  extracting: string;
  validLinkDetected: string;
  ready: string;
  latestActivity: string;
  seeAll: string;
  howItWorks: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  autoLinkBadge: string;
  paymentBadge: string;
  adminVerifiedBadge: string;

  // Orders Page
  customerHub: string;
  myOrdersTitle: string;
  myOrdersDesc: string;
  refresh: string;
  extractNewCart: string;
  loadingOrders: string;
  noOrdersTitle: string;
  noOrdersDesc: string;
  extractNowBtn: string;
  loginRequiredTitle: string;
  loginRequiredDesc: string;
  privacyBadge: string;
  signInOrRegister: string;
  homeBtn: string;
  goodsCount: string;
  totalCashLabel: string;
  placedOn: string;
  feeLabel: string;

  // Order Details
  orderStatus: string;
  orderDetailsTitle: string;
  backToOrders: string;
  cartDetails: string;
  orderSummary: string;
  itemsSubtotal: string;
  serviceFee: string;
  shipping: string;
  freeShipping: string;
  totalAmountDue: string;
  adminNotes: string;
  paymentSection: string;

  // Statuses
  statusPending: string;
  statusApproved: string;
  statusPaymentReview: string;
  statusPaid: string;
  statusProcessing: string;
  statusShipped: string;
  statusDelivered: string;
  statusCompleted: string;
  statusRejected: string;
  statusCancelled: string;

  // Support Modal
  supportTitle: string;
  supportDesc: string;
  instapayTitle: string;
  vodafoneTitle: string;
  phoneHotline: string;
  whatsappChat: string;
  emailSupport: string;
  copySuccess: string;
  close: string;
}

const TRANSLATIONS: Record<Language, Translations> = {
  ar: {
    // Navigation
    brandTitle: 'SHEIN كونسيرج',
    brandSubtitle: 'فرع القاهرة • مصر',
    extractCart: 'استخراج السلة',
    myOrders: 'طلباتي',
    admin: 'لوحة المشرف',
    newOrder: 'طلب جديد',
    support: 'خدمة العملاء',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    toggleTheme: 'تغيير المظهر',
    toggleLang: 'English',

    // Home Page
    heroBadge: 'وسيط شي إن في مصر 🇪🇬 • الدفع بـ InstaPay',
    heroTitle: 'استخرجي سلتك من SHEIN وادفعي بالجنيه المصري',
    heroSubtitle:
      'معاكي سلة أو فستان من شي إن؟ الصقي الرابط في الصندوق بالأسفل، وهنحسبهولك بالجنيه المصري بسعر الصرف الرسمي، ونشتريها ونوصلها لحد باب بيتك في مصر!',
    extractorBadge: 'مستخرج سلات شي إن الذكي',
    extractorTitle: 'ألصق رابط أو رسالة السلة هنا',
    extractorDesc:
      'انسخ نص المشاركة من تطبيق SHEIN مباشرة. نقوم باستخراج المنتجات وحساب الإجمالي ورسوم الخدمة والتوصيل.',
    placeholder:
      'ألصق هنا رابط أو مشاركة سلتك بعد اختيار المنتجات المراد شراؤها من تطبيق شي إن...\n(افتح السلة في تطبيق SHEIN ➔ اضغط "مشاركة السلة" ➔ الصق الرابط أو الرسالة هنا)',
    chars: 'حرف',
    acceptsHint: 'يقبل روابط onelink.shein.com وروابط المنتجات المباشرة',
    extractBtn: 'استخراج السلة وحساب الإجمالي',
    extracting: 'جاري قراءة المنتجات وتحديث الأسعار...',
    validLinkDetected: 'تم استخراج رابط شي إن صالح بنجاح:',
    ready: 'جاهز للاستخراج',
    latestActivity: 'آخر طلباتك ومعاملاتك',
    seeAll: 'عرض الكل',
    howItWorks: 'كيف تعمل الخدمة في ٣ خطوات بسيطة',
    step1Title: '١. انسخي رابط السلة أو المنتج',
    step1Desc: 'من تطبيق SHEIN، ادخلي السلة واضغطي أيقونة المشاركة (Share) وانسخي الرابط.',
    step2Title: '٢. الصقي الرابط واستخرجي السعر',
    step2Desc: 'اضغطي "لصق من الحافظة" وهنحسبلك الإجمالي بالجنيه المصري فوراً مع فحص المقاسات.',
    step3Title: '٣. ادفعي بـ InstaPay واستلمي',
    step3Desc: 'ادفعي بالجنيه عبر إنستاباي أو فودافون كاش واستلمي شحنتك حتى باب بيتك في أي محافظة بمصر.',
    autoLinkBadge: 'استخراج تلقائي فوري',
    paymentBadge: 'إنستاباي وفودافون كاش',
    adminVerifiedBadge: 'فحص يدوي دقيق',

    // Orders Page
    customerHub: 'لوحة العميل',
    myOrdersTitle: 'طلباتي وشحناتي',
    myOrdersDesc:
      'تتبع حالة الموافقة وملاحظات المشرف على منتجاتك، وسدّد الدفع بسهولة عبر إنستاباي أو فودافون كاش.',
    refresh: 'تحديث الطلبات',
    extractNewCart: 'استخراج سلة جديدة',
    loadingOrders: 'جاري تحميل طلباتك...',
    noOrdersTitle: 'لا توجد طلبات سابقة حتى الآن',
    noOrdersDesc:
      'ألصق أي رابط لسلة شي إن في الصفحة الرئيسية لاستخراج منتجاتك وتقديم طلبك الأول.',
    extractNowBtn: 'استخراج سلة شي إن الآن',
    loginRequiredTitle: 'تسجيل الدخول مطلوب لعرض طلباتك',
    loginRequiredDesc:
      'للحفاظ على خصوصية معاملاتك وأمان بياناتك، يرجى تسجيل الدخول أو إنشاء حساب لعرض ومتابعة شحناتك السابقة.',
    privacyBadge: 'حماية الخصوصية والمعاملات',
    signInOrRegister: 'تسجيل الدخول / إنشاء حساب',
    homeBtn: 'الرئيسية',
    goodsCount: 'منتجات',
    totalCashLabel: 'إجمالي المبلغ بالجنيه',
    placedOn: 'تاريخ الطلب:',
    feeLabel: 'رسوم الخدمة والتوصيل:',

    // Order Details
    orderStatus: 'حالة الطلب',
    orderDetailsTitle: 'تفاصيل الطلب',
    backToOrders: 'العودة لجميع الطلبات',
    cartDetails: 'محتويات السلة والمنتجات',
    orderSummary: 'ملخص الحساب المالي',
    itemsSubtotal: 'سعر المنتجات في شي إن',
    serviceFee: 'رسوم الخدمة والتوصيل',
    shipping: 'الشحن المحلي',
    freeShipping: 'مجاناً',
    totalAmountDue: 'المبلغ المطلوب سداده',
    adminNotes: 'ملاحظات المشرف على الطلب',
    paymentSection: 'بيانات تأكيد الدفع المحلي',

    // Statuses
    statusPending: 'قيد مراجعة المشرف',
    statusApproved: 'تمت الموافقة • بانتظار الدفع',
    statusPaymentReview: 'جاري التحقق من إيصال الدفع',
    statusPaid: 'تم تأكيد الدفع • جاري الشراء',
    statusProcessing: 'جاري الشحن والتجهيز',
    statusShipped: 'الشحنة في الطريق إليك',
    statusDelivered: 'تم التوصيل للعميل',
    statusCompleted: 'تم التسليم بنجاح',
    statusRejected: 'تم رفض الطلب',
    statusCancelled: 'ملغي',

    // Support Modal
    supportTitle: 'خدمة العملاء والدعم الفني',
    supportDesc:
      'فريق الدعم متاح يومياً لمساعدتك في أي استفسار حول طلباتك ومشتريات شي إن وطرق الدفع.',
    instapayTitle: 'حساب إنستاباي الرسمي (InstaPay)',
    vodafoneTitle: 'محفظة فودافون كاش الرسمية',
    phoneHotline: 'الخط الساخن والمكالمات',
    whatsappChat: 'محادثة مباشرة عبر واتساب',
    emailSupport: 'البريد الإلكتروني للدعم الفني',
    copySuccess: 'تم النسخ بنجاح!',
    close: 'إغلاق',
  },
  en: {
    // Navigation
    brandTitle: 'SHEIN Concierge',
    brandSubtitle: 'Cairo Hub • Egypt',
    extractCart: 'Extract Cart',
    myOrders: 'My Orders',
    admin: 'Admin Panel',
    newOrder: 'New Order',
    support: 'Support',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    toggleTheme: 'Toggle Theme',
    toggleLang: 'العربية',

    // Home Page
    heroBadge: 'SHEIN Egypt Service • Cairo',
    heroTitle: 'Extract your cart & pay locally in EGP',
    heroSubtitle:
      'Paste your SHEIN cart share link, and we calculate accurate totals in EGP, confirm stock, apply discounts, and deliver to your doorstep.',
    extractorBadge: 'Smart SHEIN Cart Extractor',
    extractorTitle: 'Paste your cart link or message',
    extractorDesc:
      'Copy the share text directly from the SHEIN app. Our parser extracts the items, calculates total cash with fee, and forwards to admin for review.',
    placeholder:
      'Paste your SHEIN cart share link or message here after selecting the items you wish to purchase...\n(Open your cart in SHEIN App ➔ Tap "Share Cart" ➔ Paste link or text here)',
    chars: 'chars',
    acceptsHint: 'Accepts onelink.shein.com or product URLs',
    extractBtn: 'Extract Goods & Preview Total',
    extracting: 'Extracting goods & parsing prices...',
    validLinkDetected: 'Valid link isolated successfully:',
    ready: 'Ready',
    latestActivity: 'Your Recent Orders & Activity',
    seeAll: 'See all',
    howItWorks: 'How it works in 3 simple steps',
    step1Title: '1. Share Your Cart',
    step1Desc: 'Copy the share link from your SHEIN cart and paste it here.',
    step2Title: '2. Admin Review & Discounts',
    step2Desc: 'Our supervisor confirms stock, sizes, and applies the best coupons.',
    step3Title: '3. Local Payment & Delivery',
    step3Desc: 'Pay in EGP via InstaPay or Vodafone Cash and receive at your address.',
    autoLinkBadge: 'Auto Link Extraction',
    paymentBadge: 'InstaPay & Vodafone Cash',
    adminVerifiedBadge: 'Admin Verified',

    // Orders Page
    customerHub: 'Customer Hub',
    myOrdersTitle: 'My Orders & Carts',
    myOrdersDesc:
      'Track approval status, review admin item notes, and settle via InstaPay or Vodafone Cash.',
    refresh: 'Refresh orders',
    extractNewCart: 'Extract New Cart',
    loadingOrders: 'Loading your orders...',
    noOrdersTitle: 'No Orders Saved Yet',
    noOrdersDesc:
      'Paste any SHEIN cart share link on the home page to extract your goods and submit your order.',
    extractNowBtn: 'Extract SHEIN Cart Now',
    loginRequiredTitle: 'Sign In Required to View Orders',
    loginRequiredDesc:
      'To protect your privacy and isolate your data, please sign in or register to view and track your previous orders.',
    privacyBadge: 'Private & Secure',
    signInOrRegister: 'Sign In / Register',
    homeBtn: 'Home',
    goodsCount: 'goods',
    totalCashLabel: 'Total Cash (EGP)',
    placedOn: 'Placed on:',
    feeLabel: 'Service & Delivery Fee:',

    // Order Details
    orderStatus: 'Order Status',
    orderDetailsTitle: 'Order Details',
    backToOrders: 'Back to all orders',
    cartDetails: 'Cart Items & Goods',
    orderSummary: 'Order Financial Summary',
    itemsSubtotal: 'SHEIN Items Subtotal',
    serviceFee: 'Service & Delivery Fee',
    shipping: 'Domestic Delivery',
    freeShipping: 'FREE',
    totalAmountDue: 'Total Cash Required',
    adminNotes: 'Admin Review Notes',
    paymentSection: 'Local Payment Settlement',

    // Statuses
    statusPending: 'Pending Admin Review',
    statusApproved: 'Approved • Pay Now',
    statusPaymentReview: 'Payment Receipt Under Review',
    statusPaid: 'Payment Confirmed • Purchasing',
    statusProcessing: 'Processing & Preparing',
    statusShipped: 'Shipped & Out for Delivery',
    statusDelivered: 'Delivered to Customer',
    statusCompleted: 'Delivered Successfully',
    statusRejected: 'Order Rejected',
    statusCancelled: 'Order Cancelled',

    // Support Modal
    supportTitle: 'Customer Support & Hotline',
    supportDesc:
      'Our Cairo fulfillment team is available daily to assist with your SHEIN orders, inquiries, and payments.',
    instapayTitle: 'Official InstaPay Address',
    vodafoneTitle: 'Official Vodafone Cash Number',
    phoneHotline: 'Customer Service Hotline',
    whatsappChat: 'Direct WhatsApp Support',
    emailSupport: 'Official Support Email',
    copySuccess: 'Copied to clipboard!',
    close: 'Close',
  },
};

interface ThemeLangContextType {
  lang: Language;
  dir: 'rtl' | 'ltr';
  setLang: (l: Language) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  t: Translations;
}

const ThemeLangContext = createContext<ThemeLangContextType>({
  lang: 'ar',
  dir: 'rtl',
  setLang: () => {},
  toggleLang: () => {},
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  t: TRANSLATIONS.ar,
});

const LANG_KEY = 'shein_app_language_v1';
const THEME_KEY = 'shein_app_theme_v1';

export function ThemeLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar'); // Default to Arabic RTL as requested
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    try {
      // 1. Language
      const storedLang = localStorage.getItem(LANG_KEY) as Language | null;
      const initialLang: Language = storedLang === 'en' ? 'en' : 'ar';
      setLangState(initialLang);
      document.documentElement.lang = initialLang;
      document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';

      // 2. Theme
      const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      let initialTheme: Theme = 'light';
      if (storedTheme === 'dark' || storedTheme === 'light') {
        initialTheme = storedTheme;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark';
      }
      setThemeState(initialTheme);
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    } catch (err) {
      console.warn('Theme/Lang init error:', err);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_KEY, newLang);
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    } catch {}
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    } catch {}
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = TRANSLATIONS[lang];

  return (
    <ThemeLangContext.Provider
      value={{
        lang,
        dir,
        setLang,
        toggleLang,
        theme,
        setTheme,
        toggleTheme,
        t,
      }}
    >
      {children}
    </ThemeLangContext.Provider>
  );
}

export function useThemeLang() {
  return useContext(ThemeLangContext);
}
