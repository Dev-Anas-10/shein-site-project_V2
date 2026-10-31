/**
 * PostgreSQL-backed database layer. Local JSON persistence is available only
 * for development when PostgreSQL environment variables are not configured.
 */

import fs from 'fs';
import path from 'path';
import { Order, SystemSettings, User, Shipment, OrderAuditEntry } from './types';
import { resolveItemPricing } from './shein-extractor';
import { normalizeOrderLinks } from './shein-links';
import { broadcastRealtimeEvent } from './realtime-events';
import { isPostgresConfigured, readPostgresState, writePostgresState } from './postgres';

/* ─────────────────────────────── Types ─────────────────────────────── */

interface DatabaseSchema {
  users: (User & { password?: string })[];
  orders: Order[];
  shipments: Shipment[];
  settings: SystemSettings;
}

/* ─────────────────────────────── Defaults ─────────────────────────── */

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

export class DuplicateUserError extends Error {
  readonly code = 'DUPLICATE_USER';

  constructor() {
    super('An account with this email already exists.');
    this.name = 'DuplicateUserError';
  }
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
          users: Array.isArray(parsed.users) ? parsed.users : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders.map(sanitizeOrderPricingLock) : [],
          shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
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
          users: Array.isArray(parsed.users) ? parsed.users : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders.map(sanitizeOrderPricingLock) : [],
          shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
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
    users: [],
    orders: [],
    shipments: [],
    settings: DEFAULT_SETTINGS,
  };
}

/* ────────────────────────── Public async API ───────────────────────── */

async function ensureDb(forceRefresh = false): Promise<DatabaseSchema> {
  if (memoryDb && !forceRefresh) return memoryDb;

  if (isPostgresConfigured()) {
    const state = await readPostgresState();
    if (state && typeof state === 'object') {
      const saved = state as Partial<DatabaseSchema>;
      memoryDb = {
        users: Array.isArray(saved.users) ? saved.users : [],
        orders: Array.isArray(saved.orders) ? saved.orders.map(sanitizeOrderPricingLock) : [],
        shipments: Array.isArray(saved.shipments) ? saved.shipments : [],
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
      };
      return memoryDb;
    }

    // New installs start with empty customer and order lists. Admin accounts
    // are created explicitly by scripts/create-admin.mjs.
    memoryDb = process.env.NODE_ENV === 'production' ? defaultDb() : loadFromFile() || defaultDb();
    await writePostgresState(memoryDb);
    return memoryDb;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL is required in production. Configure PGHOST, PGDATABASE, PGUSER, and PGPASSWORD.');
  }

  memoryDb = loadFromFile() || defaultDb();
  return memoryDb;
}

async function persistDb(data: DatabaseSchema): Promise<void> {
  if (isPostgresConfigured()) {
    await writePostgresState(data);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL is required in production. Refusing to save application data to local files.');
  } else {
    saveToFile(data);
  }
  memoryDb = data;
}

/* ──────────────────────────── Data Access ──────────────────────────── */

export const db = {
  getUsers: async (): Promise<(User & { password?: string })[]> => {
    return (await ensureDb()).users;
  },

  getUserByEmail: async (email: string): Promise<(User & { password?: string }) | undefined> => {
    const lower = email.toLowerCase().trim();
    return (await ensureDb()).users.find((u) => u.email.toLowerCase() === lower);
  },

  getUserById: async (id: string): Promise<(User & { password?: string }) | undefined> => {
    return (await ensureDb()).users.find((u) => u.id === id);
  },

  createUser: async (user: User & { password?: string }): Promise<User> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const email = user.email.toLowerCase().trim();
      if (data.users.some((existing) => existing.email.toLowerCase().trim() === email)) {
        throw new DuplicateUserError();
      }
      const savedUser = { ...user, email };
      data.users.push(savedUser);
      await persistDb(data);
      const { password, ...safe } = savedUser;
      return safe;
    });
  },

  updateUser: async (
    id: string,
    updates: Partial<User & { password?: string }>
  ): Promise<User | undefined> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const idx = data.users.findIndex((u) => u.id === id);
      if (idx === -1) return undefined;
      const updated = { ...data.users[idx], ...updates };
      data.users[idx] = updated;
      await persistDb(data);
      const { password, ...safe } = updated;
      return safe;
    });
  },

  recordUserLogin: async (id: string): Promise<string> => {
    return runWithDbMutex(async () => {
      const now = new Date().toISOString();
      const data = await ensureDb();
      const idx = data.users.findIndex((u) => u.id === id);
      if (idx !== -1) {
        data.users[idx].lastLoginAt = now;
        await persistDb(data);
      }
      return now;
    });
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
    let list = dbData.orders || [];

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
      broadcastRealtimeEvent('ORDER_UPDATED', { orderId: updated.id, order: updated });
      return updated;
    });
  },

  deleteOrder: async (id: string): Promise<boolean> => {
    return runWithDbMutex(async () => {
      const data = await ensureDb();
      const lenBefore = data.orders.length;
      data.orders = data.orders.filter((o) => o.id !== id);
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
