/**
 * Persistent database layer with multi-level fallback:
 *  1. Upstash Redis (shared across all Vercel serverless instances when env vars exist)
 *  2. Local /tmp file (on Vercel) initialized from bundled data/db.json
 *  3. data/db.json (local file system)
 *  4. In-memory cache
 */

import fs from 'fs';
import path from 'path';
import { Order, SystemSettings, User, GoodItem, Shipment, ShipmentStatus, OrderAuditEntry } from './types';
import { RELIABLE_FASHION_IMAGES, resolveItemPricing } from './shein-extractor';
import { normalizeOrderLinks } from './shein-links';
import { getSupabaseAdmin } from './supabase';
import { broadcastRealtimeEvent } from './realtime-events';

/* ─────────────────────────────── Types ─────────────────────────────── */

interface DatabaseSchema {
  users: (User & { password?: string })[];
  orders: Order[];
  shipments: Shipment[];
  settings: SystemSettings;
}

/* ─────────────────────────────── Defaults ─────────────────────────── */

const DEFAULT_SHIPMENTS: Shipment[] = [
  {
    id: 'SHP-202610-01',
    code: 'شحنة نهاية أكتوبر (دفعة 1)',
    status: 'PREPARING',
    maxItems: 40,
    maxOrders: 10,
    carrier: 'Aramex',
    trackingNumber: 'ARX-89302194EG',
    estimatedArrival: '2026-11-05',
    notes: 'تجميع طلبيات نهاية شهر أكتوبر - الشحن الجوي السريع',
    orderIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_SETTINGS: SystemSettings = {
  dynamicFeePercent: 0,
  profitMarginPercent: 10,
  flatShippingFee: 0,
  currency: 'EGP',
  sarToEgpRate: 15.0,
  usdToEgpRate: 50.0,
  showPaymentInSupport: true,
  enableInstapay: true,
  instapayAddress: 'anasashraf10@instapay',
  instapayAccountName: 'anasashraf10',
  instapayPaymentUrl: 'https://ipn.eg/S/anasashraf10/instapay/6OaEAR',
  enableVodafoneCash: true,
  vodafoneCashNumber: '01284947782',
  vodafoneCashInstructions:
    'أرسل المبلغ المطلوب إلى الرقم أعلاه عبر فودافون كاش، ثم أرفق لقطة الشاشة لتأكيد الدفع.',
  secondaryWalletNumber: '01284947782',
  secondaryWalletName: 'محفظة كاش إضافية',
  supportPhone: '+20 128 494 7782',
  supportWhatsapp: '+201284947782',
  supportEmail: 'gamallahmedd01@gmail.com',
  supportHours: 'يومياً من ٩:٠٠ صباحاً حتى ١١:٠٠ مساءً (بتوقيت القاهرة)',
  announcementEnabled: true,
  announcementText:
    'خدمة SHEIN Concierge — تسوق من شي إن والدفع بالجنيه المصري عبر InstaPay أو فودافون كاش وتوصيل لكافة محافظات مصر.',
  announcementBg: 'purple',
  heroBadge: 'الخدمة الرسمية والأسرع في مصر',
  heroTitle: 'استخرج سلة شي إن الخاصة بك وادفع بالجنيه المصري',
  heroSubtitle: 'الصق رابط سلة المشاركة، نتحقق من المقاسات والأسعار، وادفع بأمان عبر إنستاباي أو فودافون كاش مع شحن موثوق لباب بيتك.',
  howItWorksEnabled: true,
  step1Title: 'انسخ رابط السلة من شي إن',
  step1Desc: 'اضغط على زر المشاركة داخل تطبيق SHEIN وانسخ الرابط المختصر أو الرمز.',
  step2Title: 'مراجعة وتأكيد المقاسات',
  step2Desc: 'يقوم المشرف بفحص الأسعار، التخفيضات، وتوفر المقاسات في مصر.',
  step3Title: 'ادفع بالجنيه واستلم',
  step3Desc: 'سدد القيمة عبر إنستاباي أو فودافون كاش وتتبع شحنتك حتى باب المنزل.',
  trustMetricsEnabled: true,
  customSections: [
    {
      id: 'sec-payment-guarantee',
      title: 'ضمان الدفع الآمن والتوصيل في مصر',
      subtitle: 'حماية كاملة لأموالك ومرونة الدفع بالعملة المحلية مع فواتير تفصيلية',
      badge: 'ضمان وأمان 100%',
      type: 'cards',
      position: 'middle',
      theme: 'purple',
      enabled: true,
      cards: [
        {
          id: 'card-1',
          title: 'دفع بالجنيه المصري',
          desc: 'بدون بطاقات دولية أو حدود مصرفية عبر إنستاباي وفودافون كاش.',
          icon: 'ShieldCheck',
        },
        {
          id: 'card-2',
          title: 'فحص فوري للأصناف',
          desc: 'مراجعة دقيقة لتوفر المقاسات والألوان وتطبيق أحدث كوبونات شي إن.',
          icon: 'CheckCircle2',
        },
        {
          id: 'card-3',
          title: 'شحن سريع ومضمون',
          desc: 'توصيل لجميع محافظات مصر مع إشعارات مباشرة لحالة الشحنة.',
          icon: 'Truck',
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ],
};

const DEFAULT_USERS: (User & { password?: string })[] = [
  {
    id: 'user-admin',
    name: 'Admin Supervisor',
    email: 'admin@sheinextract.com',
    password: '$2b$10$XdSsrm.koBl9/5KrNmz5MudI1TlJ9ev8fgC9mx6XAjgVFRtmV61Be',
    role: 'admin',
    phone: '+20 100 000 0000',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin+Supervisor',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-sara',
    name: 'Sara Ahmed',
    email: 'sara@example.com',
    password: '$2b$10$9fkZ2LEzi64ml5Sgn60R.e8P89gqVI.y/mlA0f9A8XsMryuT0Vdj2',
    role: 'user',
    phone: '01019283746',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sara+Ahmed',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_ORDERS: Order[] = [
  {
    id: 'SH-19036',
    userId: 'user-sara',
    userName: 'Sara Ahmed',
    userEmail: 'sara@example.com',
    userPhone: '01019283746',
    shippingAddress: '5 Street 250, Degla, Maadi, Cairo',
    rawInput: 'https://onelink.shein.com/58/662zlco9zrsd?shc=2_RNmYr2Mxf4g',
    extractedLink: 'https://onelink.shein.com/58/662zlco9zrsd?shc=2_RNmYr2Mxf4g',
    items: [
      {
        id: 'item-1',
        name: 'SHEIN Frenchy Solid Notch Neck Long Sleeve Top & Trousers Set',
        image: RELIABLE_FASHION_IMAGES[0],
        originalPrice: 650,
        currency: 'EGP',
        quantity: 1,
        subtotal: 650,
        adminComment: 'Size M in Mocha Brown confirmed in stock at regional fulfillment center',
      },
    ],
    itemsCount: 1,
    itemsSubtotal: 650,
    dynamicFeePercent: 20,
    dynamicFeeAmount: 130,
    shippingFee: 0,
    totalCash: 780,
    currency: 'EGP',
    status: 'APPROVED_PENDING_PAYMENT',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    reviewedBy: 'Admin Supervisor',
    reviewedAt: new Date(Date.now() - 3600000).toISOString(),
    adminComment: 'Accurately verified by supervisor. Cart is ready for payment.',
    payment: {
      method: 'vodafone_cash',
      senderIdentifier: '01019283746',
      transactionReference: 'VF-9482109',
      submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      adminNote: 'Payment confirmed by admin',
    },
  },
  {
    id: 'SH-89421',
    userId: 'user-sara',
    userName: 'Sara Ahmed',
    userEmail: 'sara@example.com',
    userPhone: '01019283746',
    shippingAddress: 'Building 14, St 9, Maadi, Cairo, Egypt',
    rawInput:
      'I found some great items at SHEIN!\nThese items in my shopping cart are great. I highly recommend them to everyone!\nhttps://onelink.shein.com/58/662zlco9zrsd?shc=2_RNmYr2Mxf4g',
    extractedLink: 'https://m.shein.com/ar/cart/share/landing?group_id=912245215&shc=2_RNmYr2Mxf4g&local_country=SA&cart_share=1',
    cartShareCode: '2_RNmYr2Mxf4g',
    cartGroupId: '912245215',
    cartCoverImage: RELIABLE_FASHION_IMAGES[0],
    items: [
      {
        id: 'item-1',
        name: 'SHEIN Frenchy Solid Notch Neck Long Sleeve Top & Trousers Set',
        image: RELIABLE_FASHION_IMAGES[0],
        originalUrl: 'https://m.shein.com/ar/cart/share/landing?group_id=912245215&shc=2_RNmYr2Mxf4g&local_country=SA&cart_share=1',
        sku: 'sz240819129532890',
        color: 'Mocha Brown',
        size: 'M',
        originalPrice: 650,
        currency: 'EGP',
        quantity: 1,
        subtotal: 650,
        status: 'available',
      },
      {
        id: 'item-2',
        name: 'SHEIN EZwear Casual Drop Shoulder Ribbed Knit Cardigan',
        image: RELIABLE_FASHION_IMAGES[1],
        originalUrl: 'https://m.shein.com/ar/cart/share/landing?group_id=912245215&shc=2_RNmYr2Mxf4g&local_country=SA&cart_share=1',
        sku: 'sw23080447382910',
        color: 'Oatmeal Beige',
        size: 'L',
        originalPrice: 420,
        currency: 'EGP',
        quantity: 1,
        subtotal: 420,
        status: 'available',
      },
      {
        id: 'item-3',
        name: 'SHEIN Minimalist Quilted Shoulder Crossbody Bag With Chain',
        image: RELIABLE_FASHION_IMAGES[2],
        originalUrl: 'https://m.shein.com/ar/cart/share/landing?group_id=912245215&shc=2_RNmYr2Mxf4g&local_country=SA&cart_share=1',
        sku: 'sg2310118837190',
        color: 'Classic Black',
        size: 'One Size',
        originalPrice: 380,
        currency: 'EGP',
        quantity: 1,
        subtotal: 380,
        status: 'available',
      },
    ],
    itemsCount: 3,
    itemsSubtotal: 1450,
    dynamicFeePercent: 20,
    dynamicFeeAmount: 290,
    shippingFee: 0,
    totalCash: 1740,
    currency: 'EGP',
    status: 'PENDING_APPROVAL',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

/* ────────────────────────── Upstash Redis Layer ───────────────────── */

type RedisClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

let _redis: RedisClient | null = null;

function getRedis(): RedisClient | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token }) as RedisClient;
    return _redis;
  } catch {
    return null;
  }
}

const REDIS_KEY = 'shein_concierge_db_v2';

async function loadFromRedis(): Promise<DatabaseSchema | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(REDIS_KEY);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as DatabaseSchema);
    return {
      users: parsed.users && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
      orders: parsed.orders && parsed.orders.length > 0 ? parsed.orders.map(sanitizeOrderPricingLock) : DEFAULT_ORDERS.map(sanitizeOrderPricingLock),
      shipments: parsed.shipments && parsed.shipments.length > 0 ? parsed.shipments : DEFAULT_SHIPMENTS,
      settings: parsed.settings ?? DEFAULT_SETTINGS,
    };
  } catch (err) {
    console.warn('[DB] Redis read error:', err);
    return null;
  }
}

async function saveToRedis(data: DatabaseSchema): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(REDIS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[DB] Redis write error:', err);
  }
}

/* ────────────────────────── Supabase Layer ───────────────────────── */

/* ────────────────────────── Concurrency & Merging ──────────────────────── */

function mergeAuditLogs(a?: OrderAuditEntry[], b?: OrderAuditEntry[]): OrderAuditEntry[] {
  const combined = [...(a || []), ...(b || [])];
  return combined
    .filter((v, i, arr) => arr.findIndex((t) => t.timestamp === v.timestamp && t.action === v.action) === i)
    .sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
}

let dbMutationQueue: Promise<any> = Promise.resolve();
function runWithDbMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbMutationQueue.then(fn, fn);
  dbMutationQueue = next.then(() => {}, () => {});
  return next;
}

function mergeOrderLists(primary: Order[], secondary: Order[]): Order[] {
  const map = new Map<string, Order>();

  const hasLockedPricing = (o: Order) => Boolean(
    o.isPriceLocked ||
    o.lockedPricingSnapshot ||
    (o.status && o.status !== 'PENDING_APPROVAL')
  );

  // 1. Seed with secondary (local state)
  for (const o of secondary) {
    if (o && o.id) {
      map.set(o.id, { ...o });
    }
  }

  // 2. Non-destructively merge primary (e.g. Supabase response)
  for (const o of primary) {
    if (!o || !o.id) continue;
    const existing = map.get(o.id);
    if (!existing) {
      map.set(o.id, sanitizeOrderPricingLock({ ...o }));
    } else {
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(o.updatedAt || o.createdAt || 0).getTime();
      const primaryIsNewer = newTime >= existingTime;

      const base = primaryIsNewer ? o : existing;
      const fallback = primaryIsNewer ? existing : o;

      // SAFEGUARD 1: Shipment assignment (NEVER drop shipmentId/Code if either has it)
      const shipmentId = base.shipmentId || fallback.shipmentId || undefined;
      const shipmentCode = base.shipmentCode || fallback.shipmentCode || undefined;

      // SAFEGUARD 2: Price locking immutability
      const isPriceLocked = Boolean(
        existing.isPriceLocked || o.isPriceLocked || hasLockedPricing(existing) || hasLockedPricing(o)
      );
      const lockedPricingSnapshot = existing.lockedPricingSnapshot || o.lockedPricingSnapshot || undefined;
      const exchangeRateUsed = existing.exchangeRateUsed ?? o.exchangeRateUsed ?? undefined;
      const profitMarginPercentUsed = existing.profitMarginPercentUsed ?? o.profitMarginPercentUsed ?? undefined;

      // SAFEGUARD 3: Price preservation (Never overwrite reviewed/locked prices with unreviewed/stale numbers)
      let items = base.items;
      let itemsCount = base.itemsCount;
      let itemsSubtotal = base.itemsSubtotal;
      let dynamicFeePercent = base.dynamicFeePercent;
      let dynamicFeeAmount = base.dynamicFeeAmount;
      let shippingFee = base.shippingFee;
      let totalCash = base.totalCash;

      if (hasLockedPricing(existing) && !hasLockedPricing(o)) {
        items = existing.items;
        itemsCount = existing.itemsCount;
        itemsSubtotal = existing.itemsSubtotal;
        dynamicFeePercent = existing.dynamicFeePercent;
        dynamicFeeAmount = existing.dynamicFeeAmount;
        shippingFee = existing.shippingFee;
        totalCash = existing.totalCash;
      } else if (existing.lockedPricingSnapshot && !o.lockedPricingSnapshot) {
        items = existing.lockedPricingSnapshot.items || existing.items;
        itemsCount = items.length;
        itemsSubtotal = existing.lockedPricingSnapshot.itemsSubtotal ?? existing.itemsSubtotal;
        dynamicFeePercent = existing.lockedPricingSnapshot.dynamicFeePercent ?? existing.dynamicFeePercent;
        dynamicFeeAmount = existing.lockedPricingSnapshot.dynamicFeeAmount ?? existing.dynamicFeeAmount;
        shippingFee = existing.lockedPricingSnapshot.shippingFee ?? existing.shippingFee;
        totalCash = existing.lockedPricingSnapshot.totalCash ?? existing.totalCash;
      }

      // SAFEGUARD 4: Payment details
      const payment = (base.payment && (base.payment.submittedAt || base.payment.senderIdentifier || base.payment.method))
        ? base.payment
        : fallback.payment || base.payment;

      // SAFEGUARD 5: Audit Log accumulation
      const combinedAudit = mergeAuditLogs(existing.auditLog, o.auditLog);

      // SAFEGUARD 6: Cancellation info
      const cancelledAt = base.cancelledAt || fallback.cancelledAt || undefined;
      const cancelledBy = base.cancelledBy || fallback.cancelledBy || undefined;
      const cancellationReason = base.cancellationReason || fallback.cancellationReason || undefined;
      const pricingExpiresAt = base.pricingExpiresAt || fallback.pricingExpiresAt || undefined;
      const customerNotes = base.customerNotes || fallback.customerNotes || undefined;

      const mergedOrder: Order = {
        ...fallback,
        ...base,
        items,
        itemsCount,
        itemsSubtotal,
        dynamicFeePercent,
        dynamicFeeAmount,
        shippingFee,
        totalCash,
        shipmentId,
        shipmentCode,
        isPriceLocked,
        lockedPricingSnapshot,
        exchangeRateUsed,
        profitMarginPercentUsed,
        payment,
        auditLog: combinedAudit.length > 0 ? combinedAudit : undefined,
        cancelledAt,
        cancelledBy,
        cancellationReason,
        pricingExpiresAt,
        customerNotes,
      };

      map.set(o.id, sanitizeOrderPricingLock(normalizeOrderLinks(mergedOrder)));
    }
  }

  return Array.from(map.values())
    .map(sanitizeOrderPricingLock)
    .map(normalizeOrderLinks)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sanitizeOrderPricingLock(order: Order): Order {
  const isApprovedStatus = [
    'APPROVED_PENDING_PAYMENT',
    'PAYMENT_UNDER_REVIEW',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ].includes(order.status);

  if (isApprovedStatus || order.reviewedAt || order.isPriceLocked) {
    order.isPriceLocked = true;
    if (!order.exchangeRateUsed) {
      order.exchangeRateUsed = 15.0;
    }
    if (!order.profitMarginPercentUsed) {
      order.profitMarginPercentUsed = 10.0;
    }
    if (!order.lockedPricingSnapshot && Array.isArray(order.items)) {
      order.lockedPricingSnapshot = {
        lockedAt: order.reviewedAt || order.updatedAt || order.createdAt,
        lockedBy: order.reviewedBy || 'Admin',
        exchangeRateUsed: order.exchangeRateUsed,
        profitMarginPercentUsed: order.profitMarginPercentUsed,
        dynamicFeePercent: order.dynamicFeePercent,
        dynamicFeeAmount: order.dynamicFeeAmount,
        shippingFee: order.shippingFee,
        itemsSubtotal: order.itemsSubtotal,
        totalCash: order.totalCash,
        items: JSON.parse(JSON.stringify(order.items || [])),
      };
    }
  }
  return order;
}

function mapRowToOrder(row: any): Order {
  const paymentRaw = row.payment;
  const meta = paymentRaw?._orderMeta || {};

  let cleanPayment = undefined;
  if (paymentRaw) {
    const { _orderMeta, ...rest } = paymentRaw;
    if (Object.keys(rest).length > 0) {
      cleanPayment = rest;
    }
  }

  return sanitizeOrderPricingLock(normalizeOrderLinks({
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ''),
    userName: String(row.user_name ?? row.userName ?? ''),
    userEmail: String(row.user_email ?? row.userEmail ?? ''),
    userPhone: String(row.user_phone ?? row.userPhone ?? ''),
    shippingAddress: row.shipping_address ?? row.shippingAddress ?? undefined,
    rawInput: String(row.raw_input ?? row.rawInput ?? ''),
    extractedLink: String(row.extracted_link ?? row.extractedLink ?? ''),
    cartShareCode: row.cart_share_code ?? row.cartShareCode ?? undefined,
    cartGroupId: row.cart_group_id ?? row.cartGroupId ?? undefined,
    cartCoverImage: row.cart_cover_image ?? row.cartCoverImage ?? undefined,
    items: Array.isArray(row.items)
      ? row.items.map((it: any) => ({
          ...it,
          originalPrice: Number(it.originalPrice) || 0,
          originalPriceBeforeDiscount:
            typeof it.originalPriceBeforeDiscount === 'number'
              ? it.originalPriceBeforeDiscount
              : it.originalPriceBeforeDiscount
              ? Number(it.originalPriceBeforeDiscount)
              : undefined,
          discountPercent:
            typeof it.discountPercent === 'number'
              ? it.discountPercent
              : it.discountPercent
              ? Number(it.discountPercent)
              : undefined,
        }))
      : [],
    itemsCount: Number(row.items_count ?? row.itemsCount ?? (Array.isArray(row.items) ? row.items.length : 0)),
    itemsSubtotal: Number(row.items_subtotal ?? row.itemsSubtotal ?? 0),
    dynamicFeePercent: Number(row.dynamic_fee_percent ?? row.dynamicFeePercent ?? 0),
    dynamicFeeAmount: Number(row.dynamic_fee_amount ?? row.dynamicFeeAmount ?? 0),
    shippingFee: Number(row.shipping_fee ?? row.shippingFee ?? 0),
    totalCash: Number(row.total_cash ?? row.totalCash ?? 0),
    currency: String(row.currency ?? 'EGP'),
    status: row.status ?? 'PENDING_APPROVAL',
    customerNotes: row.customer_notes ?? row.customerNotes ?? meta.customerNotes ?? undefined,
    shipmentId: row.shipment_id ?? row.shipmentId ?? meta.shipmentId ?? undefined,
    shipmentCode: row.shipment_code ?? row.shipmentCode ?? meta.shipmentCode ?? undefined,
    adminComment: row.admin_comment ?? row.adminComment ?? undefined,
    payment: cleanPayment,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? undefined,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? undefined,
    pricingExpiresAt: row.pricing_expires_at ?? row.pricingExpiresAt ?? meta.pricingExpiresAt ?? undefined,
    cancelledAt: row.cancelled_at ?? row.cancelledAt ?? meta.cancelledAt ?? undefined,
    cancelledBy: row.cancelled_by ?? row.cancelledBy ?? meta.cancelledBy ?? undefined,
    cancellationReason: row.cancellation_reason ?? row.cancellationReason ?? meta.cancellationReason ?? undefined,
    auditLog: Array.isArray(row.audit_log ?? row.auditLog ?? meta.auditLog) ? (row.audit_log ?? row.auditLog ?? meta.auditLog) : undefined,
    isPriceLocked:
      typeof row.is_price_locked === 'boolean'
        ? row.is_price_locked
        : typeof row.isPriceLocked === 'boolean'
        ? row.isPriceLocked
        : typeof meta.isPriceLocked === 'boolean'
        ? meta.isPriceLocked
        : ['APPROVED_PENDING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(row.status),
    exchangeRateUsed: row.exchange_rate_used ?? row.exchangeRateUsed ?? meta.exchangeRateUsed ?? undefined,
    profitMarginPercentUsed: row.profit_margin_percent_used ?? row.profitMarginPercentUsed ?? meta.profitMarginPercentUsed ?? undefined,
    lockedPricingSnapshot: row.locked_pricing_snapshot ?? row.lockedPricingSnapshot ?? meta.lockedPricingSnapshot ?? undefined,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  }));
}

function mapRowToUser(row: any): User & { password?: string } {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email).toLowerCase(),
    password: row.password ?? undefined,
    role: (row.role === 'admin' ? 'admin' : 'user'),
    phone: row.phone ?? '',
    address: row.address ?? row.shipping_address ?? '',
    city: row.city ?? '',
    avatar: row.avatar ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name || 'User')}`,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    lastLoginAt: row.last_login_at ?? row.lastLoginAt ?? undefined,
  };
}

async function loadFromSupabase(): Promise<DatabaseSchema | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const [ordersRes, usersRes] = await Promise.all([
      sb.from('orders').select('*').order('created_at', { ascending: false }),
      sb.from('users').select('*'),
    ]);

    if (usersRes.error) {
      console.warn('[Supabase] Users read error:', usersRes.error.message);
    }
    if (ordersRes.error) {
      console.warn('[Supabase] Orders read error:', ordersRes.error.message);
    }

    const users = usersRes.data && usersRes.data.length > 0 ? usersRes.data.map(mapRowToUser) : DEFAULT_USERS;
    const fileFallback = loadFromFile();
    const localOrders = fileFallback?.orders || memoryDb?.orders || DEFAULT_ORDERS;
    const supabaseOrders = ordersRes.data && ordersRes.data.length > 0 ? ordersRes.data.map(mapRowToOrder) : [];
    // Bi-directional merge: Never lose local orders if Supabase has not yet synced or lagged!
    const orders = mergeOrderLists(supabaseOrders, localOrders);
    const shipments = fileFallback && fileFallback.shipments && fileFallback.shipments.length > 0 ? fileFallback.shipments : DEFAULT_SHIPMENTS;
    const settings = fileFallback?.settings ?? DEFAULT_SETTINGS;

    return {
      users,
      orders,
      shipments,
      settings,
    };
  } catch (err) {
    console.warn('[Supabase] Read note:', err);
    return null;
  }
}

const IS_PRODUCTION = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

async function syncUserToSupabase(user: User & { password?: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    if (IS_PRODUCTION) {
      throw new Error('[Database Error] Supabase is not configured in production. User cannot be persisted.');
    }
    return;
  }
  try {
    const payload: any = {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase(),
      password: user.password,
      role: user.role,
      phone: user.phone || '',
      avatar: user.avatar,
      created_at: user.createdAt,
    };
    if (user.address) payload.address = user.address;
    if (user.city) payload.city = user.city;
    if (user.lastLoginAt) {
      payload.last_login_at = user.lastLoginAt;
    }
    const { error } = await sb.from('users').upsert(payload);
    if (error) {
      console.error('[Supabase] Critical User upsert error:', error.message);
      if (IS_PRODUCTION) {
        throw new Error(`[Database Error] Failed to persist user in Supabase: ${error.message}`);
      }
    } else {
      console.log('[Supabase] User synced successfully:', user.email);
    }
  } catch (err: any) {
    console.error('[Supabase] User upsert exception:', err);
    if (IS_PRODUCTION) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

async function syncOrderToSupabase(order: Order): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    if (IS_PRODUCTION) {
      throw new Error('[Database Error] Supabase is not configured in production. Order cannot be persisted.');
    }
    return;
  }
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase sync timeout (8s)')), 8000)
    );
    const syncPromise = sb.from('orders').upsert({
      id: order.id,
      user_id: order.userId,
      user_name: order.userName,
      user_email: order.userEmail,
      user_phone: order.userPhone,
      shipping_address: order.shippingAddress || null,
      raw_input: order.rawInput,
      extracted_link: order.extractedLink,
      items: order.items,
      items_count: order.itemsCount,
      items_subtotal: order.itemsSubtotal,
      dynamic_fee_percent: order.dynamicFeePercent,
      dynamic_fee_amount: order.dynamicFeeAmount,
      shipping_fee: order.shippingFee || 0,
      total_cash: order.totalCash,
      currency: order.currency || 'EGP',
      status: order.status,
      admin_comment: order.adminComment || null,
      payment: {
        ...(order.payment || {}),
        _orderMeta: {
          shipmentId: order.shipmentId || null,
          shipmentCode: order.shipmentCode || null,
          isPriceLocked: order.isPriceLocked ?? null,
          exchangeRateUsed: order.exchangeRateUsed ?? null,
          profitMarginPercentUsed: order.profitMarginPercentUsed ?? null,
          lockedPricingSnapshot: order.lockedPricingSnapshot || null,
          pricingExpiresAt: order.pricingExpiresAt || null,
          cancelledAt: order.cancelledAt || null,
          cancelledBy: order.cancelledBy || null,
          cancellationReason: order.cancellationReason || null,
          auditLog: order.auditLog || null,
          customerNotes: order.customerNotes || null,
        },
      },
      reviewed_by: order.reviewedBy || null,
      reviewed_at: order.reviewedAt || null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    });
    const result: any = await Promise.race([syncPromise, timeoutPromise]);
    if (result && result.error) {
      console.error('[Supabase] Critical Order upsert error:', result.error.message);
      if (IS_PRODUCTION) {
        throw new Error(`[Database Error] Failed to persist order in Supabase: ${result.error.message}`);
      }
    } else {
      console.log('[Supabase] Order synced successfully:', order.id);
    }
  } catch (err: any) {
    console.error('[Supabase] Upsert exception:', err);
    if (IS_PRODUCTION) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

async function deleteOrderFromSupabase(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    if (IS_PRODUCTION) {
      throw new Error('[Database Error] Supabase is not configured in production. Order cannot be deleted.');
    }
    return;
  }
  try {
    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) {
      console.error('[Supabase] Critical Delete error:', error.message);
      if (IS_PRODUCTION) {
        throw new Error(`[Database Error] Failed to delete order in Supabase: ${error.message}`);
      }
    }
  } catch (err: any) {
    console.error('[Supabase] Delete exception:', err);
    if (IS_PRODUCTION) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

/* ──────────────────────────── File-based Layer ────────────────────── */

const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function getDbFilePath(): string {
  if (process.env.VERCEL) {
    return '/tmp/shein_db.json';
  }
  return LOCAL_DB_PATH;
}

function loadFromFile(): DatabaseSchema | null {
  const targetPath = getDbFilePath();

  // Try active target file first (e.g. /tmp/shein_db.json on Vercel)
  try {
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed) {
        return {
          users: parsed.users && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
          orders: parsed.orders && parsed.orders.length > 0 ? parsed.orders.map(sanitizeOrderPricingLock) : DEFAULT_ORDERS.map(sanitizeOrderPricingLock),
          shipments: parsed.shipments && parsed.shipments.length > 0 ? parsed.shipments : DEFAULT_SHIPMENTS,
          settings: parsed.settings ?? DEFAULT_SETTINGS,
        };
      }
    }
  } catch (err) {
    console.warn('[DB] Target file read error:', err);
  }

  // Fallback to bundled data/db.json (seeds initial data on fresh serverless cold starts)
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed) {
        return {
          users: parsed.users && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
          orders: parsed.orders && parsed.orders.length > 0 ? parsed.orders.map(sanitizeOrderPricingLock) : DEFAULT_ORDERS.map(sanitizeOrderPricingLock),
          shipments: parsed.shipments && parsed.shipments.length > 0 ? parsed.shipments : DEFAULT_SHIPMENTS,
          settings: parsed.settings ?? DEFAULT_SETTINGS,
        };
      }
    }
  } catch (err) {
    console.warn('[DB] Bundled DB read error:', err);
  }

  return null;
}

function saveToFile(data: DatabaseSchema): void {
  const targetPath = getDbFilePath();
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Unique temp file per write avoids Windows file locking conflicts across concurrent requests!
    const randSuffix = Math.random().toString(36).slice(2, 8);
    const tmp = `${targetPath}.${Date.now()}.${randSuffix}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    try {
      fs.renameSync(tmp, targetPath);
    } catch {
      fs.copyFileSync(tmp, targetPath);
      try { fs.unlinkSync(tmp); } catch {}
    }
  } catch (err) {
    console.warn('[DB] File write note (kept in-memory):', err);
  }
}

/* ──────────────────────────── In-memory Cache ─────────────────────── */

let memoryDb: DatabaseSchema | null = null;

function defaultDb(): DatabaseSchema {
  return {
    users: DEFAULT_USERS,
    orders: DEFAULT_ORDERS,
    shipments: DEFAULT_SHIPMENTS,
    settings: DEFAULT_SETTINGS,
  };
}

/* ────────────────────────── Public async API ───────────────────────── */

async function ensureDb(forceRefresh = false): Promise<DatabaseSchema> {
  if (memoryDb && !forceRefresh) return memoryDb;

  // 1. Try Supabase (primary source of truth for multi-user sync)
  const fromSupabase = await loadFromSupabase();
  if (fromSupabase) {
    memoryDb = fromSupabase;
    // Task 13: READ PURITY. Never write to file on read requests!
    return memoryDb;
  }

  // 2. Try Redis
  const fromRedis = await loadFromRedis();
  if (fromRedis) {
    memoryDb = fromRedis;
    return memoryDb;
  }

  // 3. Try file
  const fromFile = loadFromFile();
  if (fromFile) {
    memoryDb = fromFile;
    return memoryDb;
  }

  // 4. Defaults
  memoryDb = defaultDb();
  await persistDb(memoryDb);
  return memoryDb;
}

async function persistDb(data: DatabaseSchema): Promise<void> {
  memoryDb = data;
  if (getRedis()) {
    await saveToRedis(data);
  }
  saveToFile(data);
}

/* ──────────────────────────── Data Access ──────────────────────────── */

export const db = {
  getUsers: async (): Promise<(User & { password?: string })[]> => {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('users').select('*');
        if (data && !error && data.length > 0) {
          return data.map(mapRowToUser);
        }
      } catch (err) {
        console.warn('[DB] Supabase getUsers fallback:', err);
      }
    }
    return (await ensureDb()).users;
  },

  getUserByEmail: async (email: string): Promise<(User & { password?: string }) | undefined> => {
    const lower = email.toLowerCase().trim();
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('users').select('*').eq('email', lower).maybeSingle();
        if (data && !error) {
          const mapped = mapRowToUser(data);
          const currentData = await ensureDb();
          const idx = currentData.users.findIndex((u) => u.email.toLowerCase() === lower);
          if (idx >= 0) {
            currentData.users[idx] = mapped;
          } else {
            currentData.users.push(mapped);
          }
          return mapped;
        }
      } catch (err) {
        console.warn('[DB] Supabase user lookup fallback:', err);
      }
    }
    return (await ensureDb()).users.find((u) => u.email.toLowerCase() === lower);
  },

  getUserById: async (id: string): Promise<(User & { password?: string }) | undefined> => {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('users').select('*').eq('id', id).maybeSingle();
        if (data && !error) {
          return mapRowToUser(data);
        }
      } catch (err) {
        console.warn('[DB] Supabase getUserById fallback:', err);
      }
    }
    return (await ensureDb()).users.find((u) => u.id === id);
  },

  createUser: async (user: User & { password?: string }): Promise<User> => {
    const data = await ensureDb();
    data.users.push(user);
    await persistDb(data);
    await syncUserToSupabase(user);
    const { password, ...safe } = user;
    return safe;
  },

  updateUser: async (
    id: string,
    updates: Partial<User & { password?: string }>
  ): Promise<User | undefined> => {
    const data = await ensureDb();
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      const sb = getSupabaseAdmin();
      if (sb) {
        try {
          const payload: any = {};
          if (updates.name) payload.name = updates.name;
          if (updates.password) payload.password = updates.password;
          if (updates.phone) payload.phone = updates.phone;
          if (updates.address) payload.address = updates.address;
          if (updates.city) payload.city = updates.city;
          if (updates.lastLoginAt) payload.last_login_at = updates.lastLoginAt;
          await sb.from('users').update(payload).eq('id', id);
        } catch (e) {
          console.warn('[DB] Supabase updateUser direct fallback:', e);
        }
      }
      return undefined;
    }
    const updated = { ...data.users[idx], ...updates };
    data.users[idx] = updated;
    await persistDb(data);
    await syncUserToSupabase(updated);
    const { password, ...safe } = updated;
    return safe;
  },

  recordUserLogin: async (id: string): Promise<string> => {
    const now = new Date().toISOString();
    const data = await ensureDb();
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      data.users[idx].lastLoginAt = now;
      await persistDb(data);
      await syncUserToSupabase(data.users[idx]);
    } else {
      const sb = getSupabaseAdmin();
      if (sb) {
        try {
          await sb.from('users').update({ last_login_at: now }).eq('id', id);
        } catch (e) {
          console.warn('[DB] Supabase recordUserLogin error:', e);
        }
      }
    }
    return now;
  },

  getSettings: async (): Promise<SystemSettings> => {
    return (await ensureDb()).settings;
  },

  updateSettings: async (newSettings: Partial<SystemSettings>): Promise<SystemSettings> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
    const oldSettings = { ...data.settings };
    const mergedSettings = { ...data.settings, ...newSettings };
    data.settings = mergedSettings;

    const oldSarRate = Number(oldSettings.sarToEgpRate) || 15.0;
    const oldProfitMargin = Number(oldSettings.profitMarginPercent) ?? 10.0;
    const newSarRate = Number(mergedSettings.sarToEgpRate) || 15.0;
    const newProfitMargin = Number(mergedSettings.profitMarginPercent) ?? 10.0;
    const newFeePercent = Number(mergedSettings.dynamicFeePercent) || 0;
    const newShippingFee = Number(mergedSettings.flatShippingFee) || 0;

    const rateChanged = newSarRate !== oldSarRate;
    const marginChanged = newProfitMargin !== oldProfitMargin;
    const feeChanged = newFeePercent !== (Number(oldSettings.dynamicFeePercent) || 0);
    const shippingChanged = newShippingFee !== (Number(oldSettings.flatShippingFee) || 0);

    const oldMultiplier = oldSarRate * (1 + oldProfitMargin / 100);
    const newMultiplier = newSarRate * (1 + newProfitMargin / 100);

    // Task 10: Strict segregation between unreviewed and reviewed/approved orders.
    // Changing global rates or fees updates ONLY unreviewed orders (PENDING_APPROVAL and not price-locked).
    // All approved, payment-phase, and reviewed orders are STRICTLY PROTECTED and IMMUTABLE.
    if (rateChanged || marginChanged || feeChanged || shippingChanged) {
      for (const order of data.orders) {
        const isUnreviewed =
          order.status === 'PENDING_APPROVAL' &&
          !order.isPriceLocked &&
          !order.reviewedAt;

        if (!isUnreviewed) {
          // STRICT SAFEGUARD: Never touch approved/reviewed/locked orders
          continue;
        }

        // Recalculate item prices if exchange rate or profit margin changed
        if (rateChanged || marginChanged) {
          if (Array.isArray(order.items)) {
            for (const it of order.items) {
              const qty = Math.max(1, it.quantity || 1);
              if (it.sourcePrice) {
                const pricing = resolveItemPricing(
                  it.sourceOriginalPrice || it.originalPriceBeforeDiscount,
                  it.sourcePrice,
                  newSarRate,
                  newProfitMargin
                );
                it.originalPrice = pricing.salePriceEgp;
                it.originalPriceBeforeDiscount = pricing.retailPriceEgp;
                it.discountPercent = pricing.discountPercent;
                it.subtotal = qty * pricing.salePriceEgp;
              } else if (oldMultiplier > 0) {
                const estSar = it.originalPrice / oldMultiplier;
                it.originalPrice = Math.max(1, Math.round(estSar * newMultiplier));
                if (it.originalPriceBeforeDiscount) {
                  const estRetailSar = it.originalPriceBeforeDiscount / oldMultiplier;
                  it.originalPriceBeforeDiscount = Math.max(it.originalPrice, Math.round(estRetailSar * newMultiplier));
                  if (it.originalPriceBeforeDiscount > it.originalPrice) {
                    it.discountPercent = Math.round(
                      ((it.originalPriceBeforeDiscount - it.originalPrice) / it.originalPriceBeforeDiscount) * 100
                    );
                  } else {
                    it.discountPercent = undefined;
                  }
                }
                it.subtotal = qty * it.originalPrice;
              }
            }
          }
        }

        // Recalculate totals with dynamic fee and shipping
        const activeItems = (order.items || []).filter(
          (it) => it.status !== 'rejected' && it.status !== 'out_of_stock'
        );
        const itemsSubtotal = activeItems.reduce((s, it) => s + it.subtotal, 0);
        const dynamicFeeAmount = Math.round(itemsSubtotal * (newFeePercent / 100));
        order.itemsSubtotal = itemsSubtotal;
        order.dynamicFeePercent = newFeePercent;
        order.dynamicFeeAmount = dynamicFeeAmount;
        order.shippingFee = newShippingFee;
        order.totalCash = itemsSubtotal + dynamicFeeAmount + newShippingFee;
        order.itemsCount = activeItems.length;
        order.updatedAt = new Date().toISOString();

        await syncOrderToSupabase(order);
      }
    }

    await persistDb(data);
    broadcastRealtimeEvent('SETTINGS_UPDATED', { settings: data.settings });
    return data.settings;
    });
  },

  checkAndExpireOrders: async (): Promise<number> => {
    const data = await ensureDb();
    const now = Date.now();
    let expiredCount = 0;

    for (let i = 0; i < data.orders.length; i++) {
      const order = data.orders[i];
      if (order.status === 'APPROVED_PENDING_PAYMENT') {
        // Safe check: If payment was already submitted or recorded, NEVER expire!
        if (order.payment?.submittedAt || order.payment?.method) {
          continue;
        }

        // Expiration threshold: 1 hour (3600000 ms)
        const expiryTime = order.pricingExpiresAt
          ? new Date(order.pricingExpiresAt).getTime()
          : order.reviewedAt
          ? new Date(order.reviewedAt).getTime() + 60 * 60 * 1000
          : new Date(order.createdAt).getTime() + 60 * 60 * 1000;

        if (now > expiryTime) {
          order.status = 'CANCELLED';
          order.cancelledAt = new Date().toISOString();
          order.cancelledBy = 'system';
          order.cancellationReason = 'انتهت مهلة سداد السعر المعتمد (ساعة واحدة) دون إتمام الدفع';
          order.updatedAt = new Date().toISOString();
          expiredCount++;
          await syncOrderToSupabase(order);
        }
      }
    }

    if (expiredCount > 0) {
      await persistDb(data);
    }
    return expiredCount;
  },

  getOrders: async (filter?: {
    userId?: string;
    userEmail?: string;
    userPhone?: string;
    status?: string;
    search?: string;
  }): Promise<Order[]> => {
    // Task 13: Read purity - read requests never mutate order statuses or DB state
    const dbData = await ensureDb();
    let localOrders = dbData.orders || [];

    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        let query = sb.from('orders').select('*').order('created_at', { ascending: false });
        if (filter?.status && filter.status !== 'ALL') {
          query = query.eq('status', filter.status);
        }
        const { data, error } = await query;
        if (data && !error) {
          const fromSb = data.map(mapRowToOrder);
          // Bi-directional merge: Never omit any order that exists locally or in Supabase!
          localOrders = mergeOrderLists(fromSb, localOrders);
        }
      } catch (err) {
        console.warn('[DB] Supabase getOrders note:', err);
      }
    }

    let list = localOrders;

    if (filter?.userId || filter?.userEmail || filter?.userPhone) {
      list = list.filter((o) => {
        if (filter.userId && o.userId === filter.userId) return true;
        if (
          filter.userEmail &&
          o.userEmail &&
          o.userEmail.toLowerCase() === filter.userEmail.toLowerCase()
        )
          return true;
        if (filter.userPhone && o.userPhone && o.userPhone === filter.userPhone) return true;
        return false;
      });
    }

    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((o) => o.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.userName.toLowerCase().includes(q) ||
          o.userEmail.toLowerCase().includes(q) ||
          o.userPhone.toLowerCase().includes(q) ||
          o.extractedLink.toLowerCase().includes(q)
      );
    }

    return list.map(normalizeOrderLinks).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getOrderById: async (id: string): Promise<Order | undefined> => {
    // Task 13: Read purity - read requests never mutate order statuses or DB state
    const dbData = await ensureDb();
    const foundInMemory = (dbData.orders || []).find((o) => o.id === id);
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
        if (data && !error) {
          const fromSb = mapRowToOrder(data);
          const merged = normalizeOrderLinks({
            ...foundInMemory,
            ...fromSb,
            payment: fromSb.payment || foundInMemory?.payment,
            pricingExpiresAt: fromSb.pricingExpiresAt || foundInMemory?.pricingExpiresAt,
            cancelledAt: fromSb.cancelledAt || foundInMemory?.cancelledAt,
            cancelledBy: fromSb.cancelledBy || foundInMemory?.cancelledBy,
            cancellationReason: fromSb.cancellationReason || foundInMemory?.cancellationReason,
            isPriceLocked: fromSb.isPriceLocked ?? foundInMemory?.isPriceLocked,
            exchangeRateUsed: fromSb.exchangeRateUsed ?? foundInMemory?.exchangeRateUsed,
            profitMarginPercentUsed: fromSb.profitMarginPercentUsed ?? foundInMemory?.profitMarginPercentUsed,
            lockedPricingSnapshot: fromSb.lockedPricingSnapshot ?? foundInMemory?.lockedPricingSnapshot,
            auditLog: mergeAuditLogs(foundInMemory?.auditLog, fromSb.auditLog),
          });
          // Cache merged order in memory to guarantee immediate retrieval
          if (foundInMemory) {
            const idx = dbData.orders.findIndex((o) => o.id === id);
            if (idx >= 0) dbData.orders[idx] = merged;
          } else {
            dbData.orders.unshift(merged);
          }
          return merged;
        }
      } catch (err) {
        console.warn('[DB] Supabase getOrderById fallback:', err);
      }
    }

    return foundInMemory ? normalizeOrderLinks(foundInMemory) : undefined;
  },

  createOrder: async (order: Order): Promise<Order> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const existingIndex = data.orders.findIndex((o) => o.id === order.id);
      if (existingIndex >= 0) {
        const existing = data.orders[existingIndex];
        if (
          existing.isPriceLocked ||
          existing.status !== 'PENDING_APPROVAL' ||
          existing.reviewedAt
        ) {
          console.warn(`[DB] Refusing to overwrite approved/locked order ${order.id} with status ${existing.status}`);
          return existing;
        }
        data.orders[existingIndex] = order;
      } else {
        const initialAudit: OrderAuditEntry = {
          timestamp: new Date().toISOString(),
          action: 'ORDER_CREATED',
          toStatus: order.status || 'PENDING_APPROVAL',
          actor: order.userId || 'customer',
          note: 'Order submitted by customer',
        };
        order.auditLog = [initialAudit];
        data.orders.unshift(order);
      }
      await persistDb(data);
      await syncOrderToSupabase(order);
      broadcastRealtimeEvent('ORDER_CREATED', { orderId: order.id, order });
      return order;
    });
  },

  updateOrder: async (id: string, updates: Partial<Order>): Promise<Order | null> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const index = data.orders.findIndex((o) => o.id === id);
      if (index === -1) return null;

      const current = data.orders[index];
      const previousStatus = current.status;
      const targetStatus = updates.status || current.status;

      const updated: Order = {
        ...current,
        ...updates,
        payment: updates.payment ? { ...(current.payment || {}), ...updates.payment } : current.payment,
        updatedAt: new Date().toISOString(),
      };

      // State transition audit log (Task 12 & 15)
      if (updates.status && updates.status !== previousStatus) {
        let actor = updates.reviewedBy || updates.cancelledBy || (updates.payment ? 'customer' : 'admin');
        let action = `STATUS_CHANGE_${previousStatus}_TO_${targetStatus}`;
        let note = updates.adminComment || updates.cancellationReason || updates.payment?.adminNote || undefined;

        if (targetStatus === 'PAYMENT_UNDER_REVIEW' && updates.payment) {
          actor = 'customer';
          action = 'PAYMENT_SUBMITTED';
          note = `تم إرسال إشعار تحويل عبر ${updates.payment.method} (الراسل: ${updates.payment.senderIdentifier})`;
        } else if (previousStatus === 'PAYMENT_UNDER_REVIEW' && targetStatus === 'PAID') {
          actor = updates.reviewedBy || 'Admin';
          action = 'PAYMENT_VERIFIED';
          note = updates.payment?.adminNote || 'تم تأكيد التحويل واعتماد الدفع بنجاح';
        } else if (previousStatus === 'PAYMENT_UNDER_REVIEW' && targetStatus === 'APPROVED_PENDING_PAYMENT') {
          actor = updates.reviewedBy || 'Admin';
          action = 'PAYMENT_REJECTED';
          note = updates.payment?.adminNote || 'بيانات التحويل غير مطابقة أو لم تصل';
        } else if (targetStatus === 'CANCELLED') {
          action = 'ORDER_CANCELLED';
          note = updates.cancellationReason || 'تم إلغاء الطلب';
        }

        const auditEntry: OrderAuditEntry = {
          timestamp: new Date().toISOString(),
          action,
          fromStatus: previousStatus,
          toStatus: targetStatus,
          actor,
          note,
        };
        updated.auditLog = mergeAuditLogs(current.auditLog, [auditEntry]);
        console.log(`[ORDER AUDIT] ${id}: ${action} (${previousStatus} -> ${targetStatus}, actor: ${actor})`);
      }

      if (updates.items) {
        const activeItems = updates.items.filter((it) => it.status !== 'rejected' && it.status !== 'out_of_stock');
        const subtotal = activeItems.reduce((s, it) => s + it.subtotal, 0);
        const feePercent = updates.dynamicFeePercent ?? current.dynamicFeePercent;
        const feeAmount = Math.round(subtotal * (feePercent / 100));
        const shipping = updates.shippingFee ?? current.shippingFee;
        updated.itemsSubtotal = subtotal;
        updated.dynamicFeePercent = feePercent;
        updated.dynamicFeeAmount = feeAmount;
        updated.shippingFee = shipping;
        updated.totalCash = subtotal + feeAmount + shipping;
        updated.itemsCount = activeItems.length;
      }

      // Task 13 & 15: Audit log any price modifications
      if (typeof updated.totalCash === 'number' && updated.totalCash !== current.totalCash) {
        const actor = updates.reviewedBy || 'Admin';
        const priceAudit: OrderAuditEntry = {
          timestamp: new Date().toISOString(),
          action: 'PRICE_UPDATED',
          fromStatus: previousStatus,
          toStatus: targetStatus,
          actor,
          note: `تعديل السعر: السابق ${current.totalCash.toLocaleString()} EGP -> الجديد ${updated.totalCash.toLocaleString()} EGP`,
        };
        updated.auditLog = mergeAuditLogs(updated.auditLog || current.auditLog, [priceAudit]);
        console.log(`[ORDER AUDIT] ${id}: Price updated from ${current.totalCash} to ${updated.totalCash} by ${actor}`);
      }

      const isApprovedOrBeyond = [
        'APPROVED_PENDING_PAYMENT',
        'PAYMENT_UNDER_REVIEW',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
      ].includes(targetStatus);

      if (isApprovedOrBeyond) {
        updated.isPriceLocked = true;
        if (!updated.reviewedAt) {
          updated.reviewedAt = new Date().toISOString();
        }
        if (!updated.exchangeRateUsed) {
          updated.exchangeRateUsed = data.settings.sarToEgpRate ?? 15.0;
        }
        if (!updated.profitMarginPercentUsed) {
          updated.profitMarginPercentUsed = data.settings.profitMarginPercent ?? 10.0;
        }
        updated.lockedPricingSnapshot = {
          lockedAt: updated.reviewedAt,
          lockedBy: updated.reviewedBy || 'Admin',
          exchangeRateUsed: updated.exchangeRateUsed,
          profitMarginPercentUsed: updated.profitMarginPercentUsed,
          dynamicFeePercent: updated.dynamicFeePercent,
          dynamicFeeAmount: updated.dynamicFeeAmount,
          shippingFee: updated.shippingFee,
          itemsSubtotal: updated.itemsSubtotal,
          totalCash: updated.totalCash,
          items: JSON.parse(JSON.stringify(updated.items)),
        };
      }

      data.orders[index] = updated;
      await persistDb(data);
      await syncOrderToSupabase(updated);
      broadcastRealtimeEvent('ORDER_UPDATED', { orderId: updated.id, order: updated });
      return updated;
    });
  },

  deleteOrder: async (id: string): Promise<boolean> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const lenBefore = data.orders.length;
      data.orders = data.orders.filter((o) => o.id !== id);
      await deleteOrderFromSupabase(id);
      if (data.orders.length !== lenBefore) {
        await persistDb(data);
        broadcastRealtimeEvent('ORDER_DELETED', { orderId: id });
        return true;
      }
      broadcastRealtimeEvent('ORDER_DELETED', { orderId: id });
      return true;
    });
  },

  // ── Shipments / Consignments Operations ──
  getShipments: async (): Promise<Shipment[]> => {
    const data = await ensureDb();
    if (!data.shipments) data.shipments = [];
    return data.shipments;
  },

  getShipmentById: async (id: string): Promise<Shipment | undefined> => {
    const data = await ensureDb();
    return (data.shipments || []).find((s) => s.id === id);
  },

  createShipment: async (shipment: Shipment): Promise<Shipment> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      if (!data.shipments) data.shipments = [];
      const existingIndex = data.shipments.findIndex((s) => s.id === shipment.id);
      if (existingIndex >= 0) {
        data.shipments[existingIndex] = shipment;
      } else {
        data.shipments.unshift(shipment);
      }
      await persistDb(data);
      broadcastRealtimeEvent('SHIPMENT_CREATED', { shipmentId: shipment.id, shipment });
      return shipment;
    });
  },

  updateShipment: async (id: string, updates: Partial<Shipment>): Promise<Shipment | null> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      if (!data.shipments) data.shipments = [];
      const index = data.shipments.findIndex((s) => s.id === id);
      if (index === -1) return null;
      const current = data.shipments[index];
      const updated: Shipment = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // If shipment code changed, update code on all assigned orders
      if (updates.code && updates.code !== current.code) {
        data.orders.forEach((o) => {
          if (o.shipmentId === id) {
            o.shipmentCode = updates.code;
          }
        });
      }

      data.shipments[index] = updated;
      await persistDb(data);
      broadcastRealtimeEvent('SHIPMENT_UPDATED', { shipmentId: updated.id, shipment: updated });
      return updated;
    });
  },

  deleteShipment: async (id: string): Promise<boolean> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      if (!data.shipments) data.shipments = [];
      const beforeLen = data.shipments.length;
      data.shipments = data.shipments.filter((s) => s.id !== id);
      // Unassign orders that belonged to this shipment
      data.orders.forEach((o) => {
        if (o.shipmentId === id) {
          o.shipmentId = undefined;
          o.shipmentCode = undefined;
        }
      });
      if (data.shipments.length !== beforeLen) {
        await persistDb(data);
        broadcastRealtimeEvent('SHIPMENT_DELETED', { shipmentId: id });
        return true;
      }
      broadcastRealtimeEvent('SHIPMENT_DELETED', { shipmentId: id });
      return true;
    });
  },

  assignOrdersToShipment: async (
    shipmentId: string,
    orderIds: string[]
  ): Promise<{ shipment: Shipment; updatedOrdersCount: number } | null> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      if (!data.shipments) data.shipments = [];
      const shipment = data.shipments.find((s) => s.id === shipmentId);
      if (!shipment) return null;

      if (!shipment.orderIds) shipment.orderIds = [];
      const orderSet = new Set(shipment.orderIds);
      let updatedCount = 0;

      for (const oid of orderIds) {
        orderSet.add(oid);
        const order = data.orders.find((o) => o.id === oid);
        if (order) {
          order.shipmentId = shipment.id;
          order.shipmentCode = shipment.code;
          order.updatedAt = new Date().toISOString();
          const auditEntry: OrderAuditEntry = {
            timestamp: new Date().toISOString(),
            action: 'SHIPMENT_ASSIGNED',
            fromStatus: order.status,
            toStatus: order.status,
            actor: 'Admin',
            note: `تم تعيين الطلب إلى الشحنة #${shipment.code || shipment.id}`,
          };
          order.auditLog = mergeAuditLogs(order.auditLog, [auditEntry]);
          updatedCount++;
          await syncOrderToSupabase(order);
          broadcastRealtimeEvent('ORDER_UPDATED', { orderId: order.id, order });
        }
      }

      shipment.orderIds = Array.from(orderSet);
      shipment.updatedAt = new Date().toISOString();
      await persistDb(data);
      broadcastRealtimeEvent('SHIPMENT_UPDATED', { shipmentId: shipment.id, shipment });
      return { shipment, updatedOrdersCount: updatedCount };
    });
  },

  removeOrdersFromShipment: async (
    shipmentId: string,
    orderIds: string[]
  ): Promise<{ shipment: Shipment; removedCount: number } | null> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      if (!data.shipments) data.shipments = [];
      const shipment = data.shipments.find((s) => s.id === shipmentId);
      if (!shipment) return null;

      const toRemoveSet = new Set(orderIds);
      shipment.orderIds = (shipment.orderIds || []).filter((oid) => !toRemoveSet.has(oid));
      let removedCount = 0;

      for (const oid of orderIds) {
        const order = data.orders.find((o) => o.id === oid);
        if (order && order.shipmentId === shipmentId) {
          order.shipmentId = undefined;
          order.shipmentCode = undefined;
          order.updatedAt = new Date().toISOString();
          const auditEntry: OrderAuditEntry = {
            timestamp: new Date().toISOString(),
            action: 'SHIPMENT_REMOVED',
            fromStatus: order.status,
            toStatus: order.status,
            actor: 'Admin',
            note: `تم فصل الطلب من الشحنة #${shipment.code || shipment.id}`,
          };
          order.auditLog = mergeAuditLogs(order.auditLog, [auditEntry]);
          removedCount++;
          await syncOrderToSupabase(order);
          broadcastRealtimeEvent('ORDER_UPDATED', { orderId: order.id, order });
        }
      }

      shipment.updatedAt = new Date().toISOString();
      await persistDb(data);
      broadcastRealtimeEvent('SHIPMENT_UPDATED', { shipmentId: shipment.id, shipment });
      return { shipment, removedCount };
    });
  },

  invalidateCache: () => {
    memoryDb = null;
  },
};
