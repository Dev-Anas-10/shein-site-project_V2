export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  city?: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export type OrderStatus =
  | 'PENDING_APPROVAL'          // Submitted by user, awaiting admin review
  | 'REJECTED'                  // Rejected by admin
  | 'CANCELLED'                 // Cancelled by customer or expired automatically (ملغي)
  | 'APPROVED_PENDING_PAYMENT'  // Approved by admin, waiting for user to pay
  | 'PAYMENT_UNDER_REVIEW'      // User submitted InstaPay/Vodafone Cash proof, admin reviewing
  | 'PAID'                      // Payment verified by admin, items being purchased
  | 'PROCESSING'                // Items purchased from SHEIN
  | 'SHIPPED'                   // In transit to delivery address
  | 'DELIVERED'                 // Delivered to customer (تم التوصيل للعميل)
  | 'COMPLETED';                // Delivered / Completed (backward compatibility)

export type ShipmentStatus =
  | 'PREPARING'        // قيد التجهيز والتجميع
  | 'PURCHASED'        // تم الشراء من شي إن
  | 'IN_TRANSIT'       // في الشحن الدولي لمصر
  | 'CUSTOMS'          // في التخليص الجمركي
  | 'ARRIVED_LOCAL'    // وصلت المخزن في مصر
  | 'OUT_FOR_DELIVERY' // جاري التوزيع الداخلي للعملاء
  | 'COMPLETED';       // مكتملة ومسلمة بالكامل

export interface Shipment {
  id: string;                 // e.g. "SHP-202610-001"
  code: string;               // e.g. "شحنة 25 أكتوبر الرياض" or "SHP-NOV-01"
  status: ShipmentStatus;
  paymentStatus?: 'PAID' | 'UNPAID'; // حالة الدفع: مدفوعة أو غير مدفوعة
  maxItems?: number;          // الحد الأقصى لعدد القطع في الشحنة (مثلاً 50 قطعة)
  maxOrders?: number;         // الحد الأقصى لعدد الطلبات (مثلاً 15 طلب)
  carrier?: string;           // شركة الشحن (مثلاً SMSA, Aramex, DHL, البريد)
  trackingNumber?: string;    // رقم التتبع الدولي / المحلي
  trackingUrl?: string;       // رابط تتبع الشحنة
  estimatedArrival?: string;  // تاريخ الوصول المتوقع
  notes?: string;             // ملاحظات المشرف
  orderIds?: string[];        // IDs of orders assigned to this shipment
  createdAt: string;
  updatedAt: string;
}

export type ItemStatus = 'available' | 'out_of_stock' | 'price_changed' | 'approved' | 'rejected';

export interface TrackingUpdate {
  status: OrderStatus;
  title: string;
  description: string;
  timestamp: string;
  location?: string;
}

export interface TrackingInfo {
  trackingNumber?: string;
  carrier?: string; // e.g. Bosta, Aramex, مندوب خاص
  carrierUrl?: string;
  estimatedDelivery?: string;
  currentStep: number; // 1: تم الدفع, 2: جاري الشراء, 3: تم الشحن, 4: تم التوصيل
  history: TrackingUpdate[];
  adminTrackingNote?: string;
}

export interface SheinCartProduct {
  goods_id: string;
  goods_sn: string;
  name: string;
  image: string;
  original_price: string;
  sale_price: string;
  discount_percent?: number;
  currency: string;
  selected_variant: string;
  sku_code: string;
  sold_out: boolean;
}

export interface GoodItem {
  id: string;
  name: string;
  image: string;
  originalUrl?: string;
  url?: string;
  goodsId?: string | number;
  sku?: string;
  color?: string;
  size?: string;
  originalPrice: number;    // Base price in EGP (current price after discount)
  originalPriceBeforeDiscount?: number; // Retail price before discount in EGP (if discounted)
  discountPercent?: number; // Calculated discount percentage (e.g. 25 for 25% off)
  currency: string;         // 'EGP'
  quantity: number;
  subtotal: number;
  status?: ItemStatus;
  adminComment?: string;    // Comment by admin specifically for this good
  sourcePrice?: string;     // e.g. "35.20"
  sourceCurrency?: string;  // e.g. "SAR" or "USD"
  sourceOriginalPrice?: string; // e.g. "44.00"
}

export interface OrderAuditEntry {
  timestamp: string;
  action: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  actor: string;
  note?: string;
}

export interface LockedPricingSnapshot {
  lockedAt: string;
  lockedBy?: string;
  exchangeRateUsed: number;
  profitMarginPercentUsed: number;
  dynamicFeePercent: number;
  dynamicFeeAmount: number;
  shippingFee: number;
  itemsSubtotal: number;
  totalCash: number;
  items: GoodItem[];
}

export interface PaymentDetails {
  method: 'instapay' | 'vodafone_cash';
  senderIdentifier: string;  // Sender phone number or InstaPay address
  transactionReference?: string;
  receiptImage?: string;     // URL or base64 data
  submittedAt: string;
  adminNote?: string;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  shippingAddress?: string;
  
  // Extraction info
  rawInput: string;
  extractedLink: string;
  cartShareCode?: string;
  cartGroupId?: string;
  cartCoverImage?: string;
  
  // Goods and Pricing
  items: GoodItem[];
  itemsCount: number;
  itemsSubtotal: number;
  dynamicFeePercent: number; // e.g. 0%
  dynamicFeeAmount: number;  // itemsSubtotal * (dynamicFeePercent / 100)
  shippingFee: number;
  totalCash: number;         // itemsSubtotal + dynamicFeeAmount + shippingFee
  currency: string;          // 'EGP'
  
  // Workflow & Review
  status: OrderStatus;
  customerNotes?: string;    // Optional notes from customer upon checkout
  adminComment?: string;     // Admin's general review comment
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  pricingExpiresAt?: string;    // Expiration timestamp for approved pricing (e.g. 1 hour)
  cancelledAt?: string;
  cancelledBy?: 'customer' | 'admin' | 'system';
  cancellationReason?: string;
  
  // Payment Proof
  payment?: PaymentDetails;

  // Price Locking & Historical Rates (Task 10)
  isPriceLocked?: boolean;
  exchangeRateUsed?: number;
  profitMarginPercentUsed?: number;
  lockedPricingSnapshot?: LockedPricingSnapshot;

  // Order Tracking & Shipment Batch
  tracking?: TrackingInfo;
  shipmentId?: string;       // ID of assigned shipment batch
  shipmentCode?: string;     // Cached code / label of assigned shipment
  auditLog?: OrderAuditEntry[];
  
  createdAt: string;
  updatedAt: string;
}

export interface CustomSectionCard {
  id: string;
  title: string;
  desc: string;
  icon?: string;
  link?: string;
}

export interface CustomSection {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  content?: string;
  type: 'banner' | 'cards' | 'text' | 'faq';
  cards?: CustomSectionCard[];
  position: 'top' | 'middle' | 'bottom';
  theme?: 'purple' | 'amber' | 'emerald' | 'dark' | 'glass';
  enabled: boolean;
  createdAt?: string;
}

export interface SystemSettings {
  // Pricing & Fees
  dynamicFeePercent: number;    // Default 0
  profitMarginPercent?: number; // e.g. 10% (profit margin baked directly into product EGP price)
  flatShippingFee: number;      // Default 0 or 50 EGP
  currency: string;             // 'EGP'
  sarToEgpRate?: number;        // Exchange rate SAR to EGP (Default: 15.0)
  usdToEgpRate?: number;        // Exchange rate USD to EGP (Default: 50.0)

  // Payment Options & Details
  showPaymentInSupport: boolean;      // Toggle payment section in support modal
  enableInstapay: boolean;            // Enable/disable InstaPay
  instapayAddress: string;            // e.g. 'anasashraf10@instapay'
  instapayAccountName: string;        // e.g. 'anasashraf10'
  instapayPaymentUrl?: string;        // e.g. 'https://ipn.eg/S/anasashraf10/instapay/6OaEAR'
  enableVodafoneCash: boolean;        // Enable/disable Vodafone Cash
  vodafoneCashNumber: string;         // e.g. '01284947782'
  vodafoneCashInstructions: string;
  secondaryWalletNumber?: string;     // Additional wallet number (e.g. Orange / Etisalat)
  secondaryWalletName?: string;       // e.g. 'محفظة إضافية / اتصالات كاش'

  // Support & Contact
  supportPhone: string;
  supportWhatsapp?: string;
  supportEmail?: string;
  supportHours?: string;

  // Built-in Section Customization
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementLink?: string;
  announcementBg?: 'purple' | 'amber' | 'emerald' | 'rose';

  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;

  howItWorksEnabled?: boolean;
  step1Title?: string;
  step1Desc?: string;
  step2Title?: string;
  step2Desc?: string;
  step3Title?: string;
  step3Desc?: string;

  trustMetricsEnabled?: boolean;

  // Custom Sections created by Admin
  customSections?: CustomSection[];
}

export interface ExtractedCartResult {
  rawInput: string;
  extractedLink: string;
  title: string;
  description: string;
  coverImage?: string;
  shareCode?: string;
  groupId?: string;
  landingUrl?: string;
  items: GoodItem[];
  sheinProducts?: SheinCartProduct[];
  itemsSubtotal: number;
  dynamicFeePercent: number;
  dynamicFeeAmount: number;
  totalCash: number;
  currency: string;
  sourceCurrency?: string;
  totalSavingsAmount?: number;
}
