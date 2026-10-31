'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Order, GoodItem, SystemSettings, OrderStatus, CustomSection, Shipment, ShipmentStatus } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { SafeImage } from '@/components/SafeImage';
import { ShipmentsManager } from '@/components/admin/ShipmentsManager';
import { useRealtimeSubscription } from '@/lib/use-realtime';
import { toUsableSheinUrl } from '@/lib/shein-links';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Lock,
  AlertCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
  Eye,
  FileCheck,
  Percent,
  Check,
  X,
  CreditCard,
  RefreshCw,
  Maximize2,
  Sliders,
  TrendingUp,
  AlertTriangle,
  CheckCheck,
  Phone,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
  Edit3,
  Layout,
  Sparkles,
  Wallet,
  Layers,
  Settings,
  HelpCircle,
  Truck,
  Calendar,
  FileSpreadsheet,
  Download,
  Boxes,
  Package,
  ShoppingBag,
  CheckSquare,
  Square,
  Save,
  History,
} from 'lucide-react';

const PRESET_ITEM_COMMENTS = [
  'In stock & verified',
  'Size confirmed with SHEIN',
  'Color swatch verified',
  'Price updated to active promotion',
  'Low stock - prioritizing fulfillment',
];

/* ─────────────── Inline Toast ─────────────── */
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold pointer-events-auto animate-in slide-in-from-bottom-3 ${
            t.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : t.type === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : t.type === 'warning'
              ? 'bg-amber-600 text-white border-amber-700'
              : 'bg-neutral-900 text-white border-neutral-700'
          }`}
        >
          {t.type === 'success' && <CheckCheck className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.type === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          {t.type === 'warning' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-white" />}
          {t.type === 'info' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Main Component ─────────────── */

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Admin Top-Level View: Orders vs Shipments
  const [adminView, setAdminView] = useState<'orders' | 'shipments'>('orders');
  const [shipments, setShipments] = useState<Shipment[]>([]);

  // Filters: Status, Date, Shipment, Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<
    'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM'
  >('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [shipmentFilter, setShipmentFilter] = useState<string>('ALL');

  // Multi-Order Selection (Bulk Actions)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Selected Order for In-Depth Review
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewOrderComment, setReviewOrderComment] = useState('');
  const [reviewItems, setReviewItems] = useState<GoodItem[]>([]);
  const [reviewDynamicFee, setReviewDynamicFee] = useState<number>(20);
  const [updating, setUpdating] = useState(false);
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [unlockPaidEdit, setUnlockPaidEdit] = useState(false);

  // Tracking Management States for Admin
  const [trackingStatus, setTrackingStatus] = useState<OrderStatus>('PAID');
  const [trackingCarrier, setTrackingCarrier] = useState('بوسطة للشحن السريع (Bosta)');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminTrackingNote, setAdminTrackingNote] = useState('');

  // Settings modal & tabs
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'payments' | 'support' | 'sections' | 'custom_sections'>('payments');
  const [savingSettings, setSavingSettings] = useState(false);

  // 1. Dynamic Pricing & Currency
  const [editSarToEgpRate, setEditSarToEgpRate] = useState(15.0);
  const [editProfitMarginPercent, setEditProfitMarginPercent] = useState(10.0);
  const [editFeePercent, setEditFeePercent] = useState(0);
  const [editFlatShippingFee, setEditFlatShippingFee] = useState(0);
  const [editShowPaymentInSupport, setEditShowPaymentInSupport] = useState(true);
  const [editEnableInstapay, setEditEnableInstapay] = useState(true);
  const [editInstapayAddress, setEditInstapayAddress] = useState('');
  const [editInstapayName, setEditInstapayName] = useState('');
  const [editInstapayUrl, setEditInstapayUrl] = useState('');
  const [editEnableVodafoneCash, setEditEnableVodafoneCash] = useState(true);
  const [editVodafoneNumber, setEditVodafoneNumber] = useState('');
  const [editVodafoneInstructions, setEditVodafoneInstructions] = useState('');
  const [editSecondaryWalletNumber, setEditSecondaryWalletNumber] = useState('');
  const [editSecondaryWalletName, setEditSecondaryWalletName] = useState('');

  // 2. Support & Contacts
  const [editSupportPhone, setEditSupportPhone] = useState('');
  const [editSupportWhatsapp, setEditSupportWhatsapp] = useState('');
  const [editSupportEmail, setEditSupportEmail] = useState('');
  const [editSupportHours, setEditSupportHours] = useState('');

  // 3. Built-in Sections
  const [editAnnouncementEnabled, setEditAnnouncementEnabled] = useState(true);
  const [editAnnouncementText, setEditAnnouncementText] = useState('');
  const [editAnnouncementBg, setEditAnnouncementBg] = useState<'purple' | 'amber' | 'emerald' | 'rose'>('purple');
  const [editHeroBadge, setEditHeroBadge] = useState('');
  const [editHeroTitle, setEditHeroTitle] = useState('');
  const [editHeroSubtitle, setEditHeroSubtitle] = useState('');
  const [editHowItWorksEnabled, setEditHowItWorksEnabled] = useState(true);
  const [editStep1Title, setEditStep1Title] = useState('');
  const [editStep1Desc, setEditStep1Desc] = useState('');
  const [editStep2Title, setEditStep2Title] = useState('');
  const [editStep2Desc, setEditStep2Desc] = useState('');
  const [editStep3Title, setEditStep3Title] = useState('');
  const [editStep3Desc, setEditStep3Desc] = useState('');
  const [editTrustMetricsEnabled, setEditTrustMetricsEnabled] = useState(true);

  // 4. Custom Dynamic Sections
  const [editCustomSections, setEditCustomSections] = useState<CustomSection[]>([]);
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState('');
  const [newSecSubtitle, setNewSecSubtitle] = useState('');
  const [newSecBadge, setNewSecBadge] = useState('');
  const [newSecType, setNewSecType] = useState<'cards' | 'banner' | 'text' | 'faq'>('cards');
  const [newSecPosition, setNewSecPosition] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [newSecTheme, setNewSecTheme] = useState<'purple' | 'amber' | 'emerald' | 'dark' | 'glass'>('purple');
  const [newSecContent, setNewSecContent] = useState('');
  const [newSecCards, setNewSecCards] = useState<{ id: string; title: string; desc: string; icon: string }[]>([]);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardIcon, setCardIcon] = useState('ShieldCheck');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes, shipmentsRes] = await Promise.all([
        fetch(`/api/orders?admin=true&_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/settings?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/shipments?_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const ordersJson = await ordersRes.json();
      const settingsJson = await settingsRes.json();

      if (shipmentsRes.ok) {
        const shipmentsJson = await shipmentsRes.json();
        if (shipmentsJson.success) setShipments(shipmentsJson.data);
      }

      if (ordersJson.success) setOrders(ordersJson.data);
      if (settingsJson.success) {
        const s: SystemSettings = settingsJson.data;
        setSettings(s);
        setEditFeePercent(s.dynamicFeePercent ?? 0);
        setEditSarToEgpRate(s.sarToEgpRate ?? 15.0);
        setEditProfitMarginPercent(s.profitMarginPercent ?? 10.0);
        setEditFlatShippingFee(s.flatShippingFee ?? 0);
        setEditShowPaymentInSupport(s.showPaymentInSupport ?? true);
        setEditEnableInstapay(s.enableInstapay ?? true);
        setEditInstapayAddress(s.instapayAddress ?? '');
        setEditInstapayName(s.instapayAccountName ?? '');
        setEditInstapayUrl(s.instapayPaymentUrl ?? 'https://ipn.eg/S/anasashraf10/instapay/6OaEAR');
        setEditEnableVodafoneCash(s.enableVodafoneCash ?? true);
        setEditVodafoneNumber(s.vodafoneCashNumber ?? '');
        setEditVodafoneInstructions(s.vodafoneCashInstructions ?? '');
        setEditSecondaryWalletNumber(s.secondaryWalletNumber ?? '');
        setEditSecondaryWalletName(s.secondaryWalletName ?? '');

        setEditSupportPhone(s.supportPhone ?? '');
        setEditSupportWhatsapp(s.supportWhatsapp ?? s.supportPhone ?? '');
        setEditSupportEmail(s.supportEmail ?? '');
        setEditSupportHours(s.supportHours ?? '');

        setEditAnnouncementEnabled(s.announcementEnabled ?? true);
        setEditAnnouncementText(s.announcementText ?? '');
        setEditAnnouncementBg(s.announcementBg ?? 'purple');
        setEditHeroBadge(s.heroBadge ?? '');
        setEditHeroTitle(s.heroTitle ?? '');
        setEditHeroSubtitle(s.heroSubtitle ?? '');
        setEditHowItWorksEnabled(s.howItWorksEnabled ?? true);
        setEditStep1Title(s.step1Title ?? '');
        setEditStep1Desc(s.step1Desc ?? '');
        setEditStep2Title(s.step2Title ?? '');
        setEditStep2Desc(s.step2Desc ?? '');
        setEditStep3Title(s.step3Title ?? '');
        setEditStep3Desc(s.step3Desc ?? '');
        setEditTrustMetricsEnabled(s.trustMetricsEnabled ?? true);

        setEditCustomSections(s.customSections ?? []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      addToast('error', 'Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const silentRefreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?admin=true&_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOrders((prev) => {
            const newOrders: Order[] = json.data;
            const prevSig = prev.map((o) => `${o.id}:${o.status}:${o.totalCash}:${o.shipmentId || ''}:${o.updatedAt}:${o.payment?.submittedAt}`).join('|');
            const newSig = newOrders.map((o) => `${o.id}:${o.status}:${o.totalCash}:${o.shipmentId || ''}:${o.updatedAt}:${o.payment?.submittedAt}`).join('|');
            if (prevSig !== newSig) {
              return newOrders;
            }
            return prev;
          });
        }
      }
    } catch {
      // Background silent poll - non blocking
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const silentRefreshShipments = useCallback(async () => {
    try {
      const res = await fetch(`/api/shipments?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setShipments(json.data);
        }
      }
    } catch {
      // background silent poll
    }
  }, []);

  // Real-time live synchronization across admin dashboard (Task 14)
  useRealtimeSubscription({
    channel: 'admin',
    onOrderChange: (incoming) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === incoming.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = incoming;
          return next;
        }
        return [incoming, ...prev];
      });

      setSelectedOrder((curr) => {
        if (curr && curr.id === incoming.id) {
          return incoming;
        }
        return curr;
      });

      if (incoming.status === 'PAYMENT_UNDER_REVIEW') {
        addToast('info', `💳 العميل ${incoming.userName} أرسل إيصال تحويل للطلب #${incoming.id}!`);
      } else if (incoming.status === 'PENDING_APPROVAL') {
        addToast('info', `🛒 وصل طلب جديد من ${incoming.userName} (#${incoming.id})`);
      }
    },
    onShipmentChange: () => {
      silentRefreshShipments();
    },
    onRefresh: () => {
      silentRefreshOrders();
      silentRefreshShipments();
    },
    pollIntervalMs: 5000,
  });

  // Prompt login if not signed in and auth check is done
  useEffect(() => {
    if (!authLoading && !user) {
      setAuthOpen(true);
    }
  }, [authLoading, user]);

  const openReviewModal = (order: Order) => {
    setSelectedOrder(order);
    setReviewOrderComment(order.adminComment || '');
    setReviewItems(JSON.parse(JSON.stringify(order.items)));
    // Unified service & delivery fee (Task 11):
    // If order is locked/approved, preserve the approved locked fee.
    // If order is unreviewed (PENDING_APPROVAL), adopt the unified global rate from settings!
    const isLocked = order.isPriceLocked || order.status !== 'PENDING_APPROVAL';
    const unifiedFee = isLocked
      ? (order.dynamicFeePercent ?? settings?.dynamicFeePercent ?? 0)
      : (settings?.dynamicFeePercent ?? order.dynamicFeePercent ?? 0);
    setReviewDynamicFee(unifiedFee);
    setZoomReceipt(false);
    setUnlockPaidEdit(false);
    setTrackingStatus(order.status);
    setTrackingCarrier(order.tracking?.carrier || 'بوسطة للشحن السريع (Bosta)');
    setTrackingNumber(order.tracking?.trackingNumber || '');
    setAdminTrackingNote(order.tracking?.adminTrackingNote || '');
  };

  const handleItemFieldChange = (
    index: number,
    field: 'adminComment' | 'originalPrice' | 'quantity' | 'status',
    value: any
  ) => {
    setReviewItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      if (field === 'adminComment') item.adminComment = value;
      if (field === 'status') item.status = value;
      if (field === 'originalPrice') {
        item.originalPrice = Number(value) || 0;
        item.subtotal = item.originalPrice * item.quantity;
      }
      if (field === 'quantity') {
        item.quantity = Math.max(1, Number(value) || 1);
        item.subtotal = item.originalPrice * item.quantity;
      }
      copy[index] = item;
      return copy;
    });
  };

  const calculateReviewTotals = () => {
    const activeItems = reviewItems.filter(
      (it) => it.status !== 'rejected' && it.status !== 'out_of_stock'
    );
    const subtotal = activeItems.reduce((s, it) => s + it.subtotal, 0);
    const isLocked = selectedOrder?.isPriceLocked || (selectedOrder && selectedOrder.status !== 'PENDING_APPROVAL');
    const effectiveFee = isLocked
      ? (selectedOrder?.dynamicFeePercent ?? settings?.dynamicFeePercent ?? 0)
      : (settings?.dynamicFeePercent ?? reviewDynamicFee);
    const feeAmount = Math.round(subtotal * (effectiveFee / 100));
    const shipping = selectedOrder?.shippingFee || 0;
    const totalCash = subtotal + feeAmount + shipping;
    return { subtotal, feeAmount, totalCash, effectiveFee };
  };

  const hasUnsavedChanges = React.useMemo(() => {
    if (!selectedOrder) return false;
    const itemsChanged = JSON.stringify(reviewItems) !== JSON.stringify(selectedOrder.items);
    const commentChanged = reviewOrderComment !== (selectedOrder.adminComment || '');
    const feeChanged = reviewDynamicFee !== (selectedOrder.dynamicFeePercent ?? 0);
    return itemsChanged || commentChanged || feeChanged;
  }, [selectedOrder, reviewItems, reviewOrderComment, reviewDynamicFee]);

  // Keep open modal in sync with silent background updates if there are no unsaved edits
  useEffect(() => {
    if (selectedOrder && !hasUnsavedChanges && !updating) {
      const currentInOrders = orders.find((o) => o.id === selectedOrder.id);
      if (
        currentInOrders &&
        (currentInOrders.status !== selectedOrder.status ||
          currentInOrders.totalCash !== selectedOrder.totalCash ||
          currentInOrders.updatedAt !== selectedOrder.updatedAt ||
          currentInOrders.payment?.submittedAt !== selectedOrder.payment?.submittedAt)
      ) {
        setSelectedOrder(currentInOrders);
        setReviewItems(JSON.parse(JSON.stringify(currentInOrders.items || [])));
        setReviewOrderComment(currentInOrders.adminComment || '');
      }
    }
  }, [orders, selectedOrder, hasUnsavedChanges, updating]);

  const handleSaveAndApply = async () => {
    if (!selectedOrder) return;
    if (updating) return;

    const { totalCash } = calculateReviewTotals();
    const diff = totalCash - selectedOrder.totalCash;

    // Rules for orders that already transitioned to payment:
    if (selectedOrder.status === 'APPROVED_PENDING_PAYMENT' && diff !== 0) {
      const confirmMsg =
        'تنبيه: هذا الطلب معتمد ومتاح للعميل للدفع حالياً.\n\n' +
        'هل أنت متأكد من حفظ وتطبيق الأسعار الجديدة؟\n' +
        'المبلغ المعتمد السابق: ' + selectedOrder.totalCash.toLocaleString() + ' EGP\n' +
        'المبلغ الجديد المعتمد: ' + totalCash.toLocaleString() + ' EGP\n\n' +
        'سيتم تحديث المبلغ في صفحة الدفع الخاصة بالعميل فوراً دون الحاجة لرفض الطلب.';
      if (!window.confirm(confirmMsg)) return;
    } else if (selectedOrder.status === 'PAYMENT_UNDER_REVIEW' && diff !== 0) {
      const confirmMsg =
        'تحذير: العميل قام بالفعل بتحويل مبلغ (' + selectedOrder.totalCash.toLocaleString() + ' EGP) وهو قيد المراجعة.\n\n' +
        'تعديل المبلغ الآن إلى (' + totalCash.toLocaleString() + ' EGP) قد يتعارض مع الإيصال المسجل.\n\n' +
        'هل تريد المتابعة وحفظ الأسعار الجديدة؟';
      if (!window.confirm(confirmMsg)) return;
    }

    setUpdating(true);

    try {
      const isLocked = selectedOrder.isPriceLocked || selectedOrder.status !== 'PENDING_APPROVAL';
      const effectiveFee = isLocked
        ? (selectedOrder.dynamicFeePercent ?? settings?.dynamicFeePercent ?? 0)
        : (settings?.dynamicFeePercent ?? selectedOrder.dynamicFeePercent ?? 0);

      const payload: any = {
        items: reviewItems,
        adminComment: reviewOrderComment,
        dynamicFeePercent: effectiveFee,
      };

      const res = await fetch('/api/orders/' + selectedOrder.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'فشل حفظ التعديلات');

      const updatedOrder: Order = resJson.data;

      // Update orders list AND selected order in state
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o))
      );
      setSelectedOrder(updatedOrder);
      setReviewItems(JSON.parse(JSON.stringify(updatedOrder.items)));

      if (selectedOrder.status === 'APPROVED_PENDING_PAYMENT') {
        addToast(
          'success',
          '✓ تم حفظ واعتماد التعديلات بنجاح! تم تحديث المبلغ في شاشة دفع العميل إلى ' + updatedOrder.totalCash.toLocaleString() + ' EGP'
        );
      } else {
        addToast('success', '✓ تم حفظ واعتماد التعديلات بنجاح وتحديث الأسعار في قاعدة البيانات');
      }
    } catch (err: any) {
      addToast('error', err.message || 'فشلت عملية حفظ التعديلات. يرجى المحاولة مرة أخرى.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateOrder = async (
    newStatus?: OrderStatus,
    paymentStatus?: 'VERIFIED' | 'REJECTED',
    trackingPayload?: any
  ) => {
    if (!selectedOrder) return;
    if (updating) return;
    setUpdating(true);

    try {
      const isLocked = selectedOrder.isPriceLocked || selectedOrder.status !== 'PENDING_APPROVAL';
      const effectiveFee = isLocked
        ? (selectedOrder.dynamicFeePercent ?? settings?.dynamicFeePercent ?? 0)
        : (settings?.dynamicFeePercent ?? selectedOrder.dynamicFeePercent ?? 0);

      const payload: any = {
        items: reviewItems,
        adminComment: reviewOrderComment,
        dynamicFeePercent: effectiveFee,
      };

      if (newStatus) {
        payload.status = newStatus;
      }

      if (paymentStatus) {
        payload.paymentStatus = paymentStatus;
      }

      if (trackingPayload) {
        payload.tracking = trackingPayload;
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Failed to update order');

      // Update orders list AND selected order in state
      const updatedOrder: Order = resJson.data;
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o))
      );
      setSelectedOrder(updatedOrder);
      // Sync review items with saved state
      setReviewItems(JSON.parse(JSON.stringify(updatedOrder.items)));

      const actionLabel = newStatus
        ? newStatus === 'APPROVED_PENDING_PAYMENT'
          ? 'Order approved ✓ — Customer can now pay'
          : newStatus === 'REJECTED'
          ? 'Order rejected'
          : newStatus === 'PAID'
          ? 'Payment confirmed — Order marked as Paid ✓'
          : 'Order updated'
        : 'Notes & pricing saved ✓';

      addToast('success', actionLabel);
    } catch (err: any) {
      addToast('error', err.message || 'Update failed. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: Partial<SystemSettings> = {
        dynamicFeePercent: Number(editFeePercent) || 0,
        sarToEgpRate: Number(editSarToEgpRate) || 15.0,
        profitMarginPercent: Number(editProfitMarginPercent) ?? 10.0,
        flatShippingFee: Number(editFlatShippingFee) || 0,
        showPaymentInSupport: editShowPaymentInSupport,
        enableInstapay: editEnableInstapay,
        instapayAddress: editInstapayAddress.trim(),
        instapayAccountName: editInstapayName.trim(),
        instapayPaymentUrl: editInstapayUrl.trim(),
        enableVodafoneCash: editEnableVodafoneCash,
        vodafoneCashNumber: editVodafoneNumber.trim(),
        vodafoneCashInstructions: editVodafoneInstructions.trim(),
        secondaryWalletNumber: editSecondaryWalletNumber.trim(),
        secondaryWalletName: editSecondaryWalletName.trim(),

        supportPhone: editSupportPhone.trim(),
        supportWhatsapp: editSupportWhatsapp.trim(),
        supportEmail: editSupportEmail.trim(),
        supportHours: editSupportHours.trim(),

        announcementEnabled: editAnnouncementEnabled,
        announcementText: editAnnouncementText.trim(),
        announcementBg: editAnnouncementBg,
        heroBadge: editHeroBadge.trim(),
        heroTitle: editHeroTitle.trim(),
        heroSubtitle: editHeroSubtitle.trim(),
        howItWorksEnabled: editHowItWorksEnabled,
        step1Title: editStep1Title.trim(),
        step1Desc: editStep1Desc.trim(),
        step2Title: editStep2Title.trim(),
        step2Desc: editStep2Desc.trim(),
        step3Title: editStep3Title.trim(),
        step3Desc: editStep3Desc.trim(),
        trustMetricsEnabled: editTrustMetricsEnabled,

        customSections: editCustomSections,
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update settings');
      setSettings(json.data);
      addToast('success', 'تم حفظ جميع التعديلات والإعدادات بنجاح! ✓');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecTitle.trim()) {
      addToast('error', 'عنوان السكشن مطلوب');
      return;
    }

    const newSec: CustomSection = {
      id: `sec-${Date.now()}`,
      title: newSecTitle.trim(),
      subtitle: newSecSubtitle.trim() || undefined,
      badge: newSecBadge.trim() || undefined,
      type: newSecType,
      position: newSecPosition,
      theme: newSecTheme,
      content: newSecContent.trim() || undefined,
      cards: newSecType === 'cards' && newSecCards.length > 0 ? newSecCards : undefined,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    setEditCustomSections((prev) => [...prev, newSec]);
    setShowNewSectionModal(false);
    setNewSecTitle('');
    setNewSecSubtitle('');
    setNewSecBadge('');
    setNewSecContent('');
    setNewSecCards([]);
    addToast('success', 'تمت إضافة السكشن الجديد! لا تنسى الضغط على "حفظ التعديلات".');
  };

  const handleToggleCustomSection = (id: string) => {
    setEditCustomSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleDeleteCustomSection = (id: string) => {
    setEditCustomSections((prev) => prev.filter((s) => s.id !== id));
    addToast('info', 'تم حذف السكشن من القائمة.');
  };

  const handleAddCardToNewSection = () => {
    if (!cardTitle.trim()) return;
    const newCard = {
      id: `card-${Date.now()}`,
      title: cardTitle.trim(),
      desc: cardDesc.trim(),
      icon: cardIcon,
    };
    setNewSecCards((prev) => [...prev, newCard]);
    setCardTitle('');
    setCardDesc('');
  };

  const handleRemoveCard = (cardId: string) => {
    setNewSecCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  // Metrics
  const totalOrdersCount = orders.length;
  const pendingApprovalCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
  const approvedPaymentCount = orders.filter((o) => o.status === 'APPROVED_PENDING_PAYMENT').length;
  const paymentReviewCount = orders.filter((o) => o.status === 'PAYMENT_UNDER_REVIEW').length;
  const pendingTotalCount = pendingApprovalCount + paymentReviewCount;
  const paidCount = orders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED'].includes(o.status)).length;
  const paidTabCount = orders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED', 'PAYMENT_UNDER_REVIEW'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').length;
  const rejectedCount = orders.filter((o) => o.status === 'REJECTED' || o.status === 'CANCELLED').length;
  const completedCount = orders.filter((o) => ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status)).length;
  const totalVolumeEgp = orders
    .filter((o) => o.status !== 'REJECTED')
    .reduce((sum, o) => sum + o.totalCash, 0);

  // Date Filter matching logic
  const matchesDateFilter = (createdAt: string) => {
    if (dateRange === 'ALL') return true;
    const orderDate = new Date(createdAt);
    const now = new Date();

    const orderDateKey = orderDate.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);

    if (dateRange === 'TODAY') {
      return orderDateKey === todayKey;
    }

    if (dateRange === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return orderDateKey === yesterday.toISOString().slice(0, 10);
    }

    if (dateRange === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= sevenDaysAgo;
    }

    if (dateRange === 'LAST_30_DAYS') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= thirtyDaysAgo;
    }

    if (dateRange === 'THIS_MONTH') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth()
      );
    }

    if (dateRange === 'CUSTOM') {
      if (customStartDate && orderDateKey < customStartDate) return false;
      if (customEndDate && orderDateKey > customEndDate) return false;
      return true;
    }

    return true;
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        if (order.status !== 'PENDING_APPROVAL') return false;
      } else if (statusFilter === 'AWAITING_PAYMENT' || statusFilter === 'APPROVED_PENDING_PAYMENT') {
        if (order.status !== 'APPROVED_PENDING_PAYMENT') return false;
      } else if (statusFilter === 'PAYMENT_UNDER_REVIEW') {
        if (order.status !== 'PAYMENT_UNDER_REVIEW') return false;
      } else if (statusFilter === 'PAID') {
        // Guaranteed visibility: Include verified paid and payment under review
        if (!['PAID', 'PROCESSING', 'SHIPPED', 'PAYMENT_UNDER_REVIEW'].includes(order.status)) return false;
      } else if (statusFilter === 'DELIVERED') {
        if (!['DELIVERED', 'COMPLETED'].includes(order.status)) return false;
      } else if (statusFilter === 'REJECTED' || statusFilter === 'CANCELLED') {
        if (!['REJECTED', 'CANCELLED'].includes(order.status)) return false;
      } else {
        if (order.status !== statusFilter) return false;
      }
    }

    // Date range filter
    if (!matchesDateFilter(order.createdAt)) return false;

    // Shipment assignment filter
    if (shipmentFilter === 'UNASSIGNED') {
      if (order.shipmentId) return false;
    } else if (shipmentFilter !== 'ALL') {
      if (order.shipmentId !== shipmentFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        order.id.toLowerCase().includes(q) ||
        order.userName.toLowerCase().includes(q) ||
        order.userEmail.toLowerCase().includes(q) ||
        order.userPhone.toLowerCase().includes(q) ||
        (order.shipmentCode && order.shipmentCode.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // ── CSV EXPORT LOGIC FOR ORDERS ──
  const exportOrdersToCsv = (ordersList: Order[], exportName = 'shein_orders') => {
    if (!ordersList || ordersList.length === 0) {
      addToast('warning', 'لا توجد طلبات لتصديرها وفق الفلاتر الحالية');
      return;
    }

    const headers = [
      'رقم الطلب',
      'تاريخ الطلب',
      'اسم العميل',
      'رقم الهاتف',
      'البريد الإلكتروني',
      'عنوان التوصيل',
      'ملاحظات العميل',
      'حالة الطلب',
      'كود الشحنة التابع لها',
      'عدد القطع',
      'تفاصيل المنتجات والمقاسات',
      'إجمالي الأصناف (ج.م)',
      'رسوم الخدمة والتوصيل (ج.م)',
      'الشحن (ج.م)',
      'المبلغ الإجمالي (ج.م)',
      'طريقة الدفع',
      'بيانات المحول / رقم المعاملة',
      'رابط سلة شي إن',
    ];

    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = ordersList.map((o) => {
      const itemsSummary = (o.items || [])
        .map(
          (it) =>
            `${it.name} [مقاس: ${it.size || '-'} | لون: ${it.color || '-'} | كود: ${it.sku || '-'}] (×${it.quantity || 1})`
        )
        .join(' ; ');

      return [
        escapeCell(o.id),
        escapeCell(new Date(o.createdAt).toLocaleString('ar-EG')),
        escapeCell(o.userName),
        escapeCell(o.userPhone),
        escapeCell(o.userEmail),
        escapeCell(o.shippingAddress || '—'),
        escapeCell(o.customerNotes || '—'),
        escapeCell(o.status),
        escapeCell(o.shipmentCode || o.shipmentId || 'غير مسند'),
        escapeCell(o.itemsCount || o.items?.length || 0),
        escapeCell(itemsSummary),
        escapeCell(o.itemsSubtotal || 0),
        escapeCell(o.dynamicFeeAmount || 0),
        escapeCell(o.shippingFee || 0),
        escapeCell(o.totalCash || 0),
        escapeCell(
          o.payment?.method === 'instapay'
            ? 'InstaPay'
            : o.payment?.method === 'vodafone_cash'
            ? 'Vodafone Cash'
            : 'لم يسدد بعد'
        ),
        escapeCell(
          o.payment?.senderIdentifier
            ? `${o.payment.senderIdentifier} (${o.payment.transactionReference || ''})`
            : '—'
        ),
        escapeCell(toUsableSheinUrl(o.extractedLink, { shc: o.cartShareCode, groupId: o.cartGroupId }) || ''),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `${exportName}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('success', `تم تصدير ${ordersList.length} طلب بنجاح كملف CSV!`);
  };

  // ── CSV EXPORT FOR SHIPMENT MANIFEST ──
  const exportShipmentManifestCsv = (shipment: Shipment) => {
    const shipmentOrders = orders.filter(
      (o) => o.shipmentId === shipment.id || (shipment.orderIds && shipment.orderIds.includes(o.id))
    );

    if (shipmentOrders.length === 0) {
      addToast('warning', 'هذه الشحنة لا تحتوي على طلبات لتصدير البيان');
      return;
    }

    const headers = [
      'كود الشحنة',
      'حالة الشحنة',
      'شركة الشحن',
      'رقم التتبع الدولي',
      'تاريخ الوصول المتوقع',
      'رقم الطلب',
      'اسم المستلم / العميل',
      'رقم الهاتف',
      'عنوان التوصيل بمصر',
      'ملاحظات العميل',
      'عدد القطع',
      'تفاصيل المنتجات',
      'روابط المنتجات (m.shein)',
      'رابط سلة شي إن (m.shein)',
      'المبلغ الإجمالي (ج.م)',
      'حالة الدفع',
    ];

    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = shipmentOrders.map((o) => {
      const itemsSummary = (o.items || [])
        .map((it) => `${it.name} [${it.size || ''}]`)
        .join(' | ');

      const itemsUrls = (o.items || [])
        .map((it) =>
          toUsableSheinUrl(it.originalUrl, {
            goodsId: it.id,
            sku: it.sku,
            shc: o.cartShareCode,
            groupId: o.cartGroupId,
            cartLandingUrl: o.extractedLink,
          })
        )
        .join(' | ');

      const cartUrl = toUsableSheinUrl(o.extractedLink, {
        shc: o.cartShareCode,
        groupId: o.cartGroupId,
      });

      return [
        escapeCell(shipment.code),
        escapeCell(shipment.status),
        escapeCell(shipment.carrier || '—'),
        escapeCell(shipment.trackingNumber || '—'),
        escapeCell(shipment.estimatedArrival || '—'),
        escapeCell(o.id),
        escapeCell(o.userName),
        escapeCell(o.userPhone),
        escapeCell(o.shippingAddress || '—'),
        escapeCell(o.customerNotes || '—'),
        escapeCell(o.itemsCount || o.items?.length || 0),
        escapeCell(itemsSummary),
        escapeCell(itemsUrls),
        escapeCell(cartUrl),
        escapeCell(o.totalCash || 0),
        escapeCell(o.status === 'PAID' ? 'مسدد بالكامل' : o.status),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanCode = shipment.code.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    link.download = `manifest_${cleanCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('success', `تم تصدير بيان الشحنة (${shipmentOrders.length} طلب) بنجاح!`);
  };

  // ── SHIPMENT ASSIGNMENT HANDLERS ──
  const handleAssignOrdersToShipment = async (shipmentId: string, orderIds: string[]) => {
    const targetShipment = shipments.find((s) => s.id === shipmentId);
    const res = await fetch('/api/shipments/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId, orderIds }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'فشل إسناد الطلبات للشحنة');

    addToast('success', `تم إسناد ${orderIds.length} طلبات إلى "${targetShipment?.code || ''}" بنجاح!`);
    await fetchData();
  };

  const handleRemoveOrdersFromShipment = async (shipmentId: string, orderIds: string[]) => {
    const res = await fetch('/api/shipments/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId, orderIds }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'فشل إزالة الطلبات من الشحنة');

    addToast('info', `تم إزالة ${orderIds.length} طلبات من الشحنة.`);
    await fetchData();
  };

  const handleAssignSingleOrderShipment = async (
    orderId: string,
    shipmentId: string,
    shipmentCode?: string
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: shipmentId || null,
          shipmentCode: shipmentCode || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'فشل تحديث الشحنة');

      addToast(
        'success',
        shipmentId ? `تم إسناد الطلب #${orderId} للشحنة بنجاح` : `تم إلغاء إسناد الشحنة عن الطلب #${orderId}`
      );

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, shipmentId: shipmentId || undefined, shipmentCode: shipmentCode || undefined }
            : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? { ...prev, shipmentId: shipmentId || undefined, shipmentCode: shipmentCode || undefined }
            : null
        );
      }

      // Refresh shipments
      const shipRes = await fetch('/api/shipments');
      if (shipRes.ok) {
        const shipJson = await shipRes.json();
        if (shipJson.success) setShipments(shipJson.data);
      }
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleBulkAssignShipment = async (targetShipmentId: string) => {
    if (selectedOrderIds.length === 0) return;
    try {
      if (targetShipmentId === 'UNASSIGN') {
        await Promise.all(
          selectedOrderIds.map((id) =>
            fetch(`/api/orders/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shipmentId: null, shipmentCode: null }),
            })
          )
        );
        addToast('info', `تم إلغاء إسناد ${selectedOrderIds.length} طلبات بنجاح`);
      } else {
        await handleAssignOrdersToShipment(targetShipmentId, selectedOrderIds);
      }
      setSelectedOrderIds([]);
      await fetchData();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  // ── Guard: show login prompt if not authenticated ──
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white">
        <Navbar onOpenAuth={() => setAuthOpen(true)} />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 p-4">
          <div className="p-8 bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200 dark:border-[#2a243a] shadow-xl text-center max-w-md">
            <ShieldCheck className="w-12 h-12 text-rose-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-neutral-950 dark:text-white mb-2">Admin Access Required</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
              Please sign in with your admin account to access the dashboard.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="w-full py-3 bg-neutral-950 dark:bg-purple-600 hover:bg-neutral-800 text-white font-extrabold rounded-2xl transition-colors cursor-pointer"
            >
              Sign In as Admin
            </button>
          </div>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultRole="admin" />
      </div>
    );
  }

  // ── Guard: show access denied if logged in but not admin ──
  if (!authLoading && user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white">
        <Navbar onOpenAuth={() => setAuthOpen(true)} />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 p-4">
          <div className="p-8 bg-white dark:bg-[#14111d] rounded-3xl border border-rose-200 dark:border-rose-900 shadow-xl text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-neutral-950 dark:text-white mb-2">Access Denied</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-2">
              Your account (<strong>{user.email}</strong>) does not have admin privileges.
            </p>
            <p className="text-neutral-400 dark:text-neutral-500 text-xs">Contact your supervisor to request access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0c0a0f] text-neutral-900 dark:text-white pb-32 md:pb-24 transition-colors relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 bg-gradient-to-b from-purple-400/8 via-pink-400/4 to-transparent dark:from-purple-600/10 dark:via-purple-900/5 dark:to-transparent pointer-events-none blur-3xl -z-10" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-black uppercase tracking-wider border border-rose-200 dark:border-rose-900/60">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                Administrative Command Center
              </span>
              <span className="text-[11px] font-mono text-neutral-500 bg-white dark:bg-[#1a1626] px-2.5 py-0.5 rounded-full border border-neutral-200 dark:border-[#2f2742]">
                Live DB Sync
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-neutral-950 dark:text-white tracking-tight">
              Order Review &amp; Dynamic Pricing Hub
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Accurately review extracted SHEIN goods, modify individual item pricing, add per-good notes, unlock InstaPay / Vodafone Cash payments, and confirm receipts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/analytics"
              className="px-4 py-2.5 bg-white dark:bg-[#14111d] hover:bg-neutral-50 dark:hover:bg-[#1f1a2c] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#2a243a] rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <TrendingUp className="w-4 h-4 text-purple-600" />
              التحليلات والأرباح (Analytics)
            </Link>

            <button
              onClick={() => setSettingsOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-purple-500/20 cursor-pointer active:scale-95"
            >
              <Settings className="w-4 h-4 text-purple-200" />
              إعدادات الموقع والمحافظ والسكاشن (Site CMS)
            </button>

            <button
              onClick={fetchData}
              className="p-2.5 bg-white dark:bg-[#14111d] hover:bg-neutral-50 dark:hover:bg-[#1f1a2c] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-[#2a243a] rounded-2xl transition-all shadow-xs cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Mode Switcher: Orders Review vs Shipment Batches */}
        <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-[#2a243a] pb-4">
          <button
            type="button"
            onClick={() => setAdminView('orders')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              adminView === 'orders'
                ? 'bg-neutral-950 dark:bg-purple-600 text-white shadow-md'
                : 'bg-white dark:bg-[#14111d] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#2a243a] hover:bg-neutral-100 dark:hover:bg-[#1f1a2c]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>جدول مراجعة الطلبات</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/20 text-white">
              {filteredOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAdminView('shipments')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              adminView === 'shipments'
                ? 'bg-neutral-950 dark:bg-purple-600 text-white shadow-md'
                : 'bg-white dark:bg-[#14111d] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#2a243a] hover:bg-neutral-100 dark:hover:bg-[#1f1a2c]'
            }`}
          >
            <Package className="w-4 h-4 text-purple-400" />
            <span>إدارة الشحنات ودفعات الشحن (Shipments)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 font-bold">
              {shipments.length}
            </span>
          </button>
        </div>

        {adminView === 'shipments' ? (
          <ShipmentsManager
            shipments={shipments}
            orders={orders}
            onRefresh={fetchData}
            onAssignOrders={handleAssignOrdersToShipment}
            onRemoveOrders={handleRemoveOrdersFromShipment}
            onExportManifest={exportShipmentManifestCsv}
            addToast={addToast}
          />
        ) : (
          <div className="space-y-6">
            {/* High-Impact Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 text-xs font-bold mb-2">
                  <span>Total Orders</span>
                  <span className="text-[10px] bg-neutral-100 dark:bg-[#201a2e] px-2 py-0.5 rounded-md text-neutral-700 dark:text-neutral-300">All</span>
                </div>
                <div className="text-3xl font-black text-neutral-950 dark:text-white">{totalOrdersCount}</div>
                <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Extracted carts</div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 rounded-3xl border-2 border-amber-300 dark:border-amber-800/60 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-amber-900 dark:text-amber-300 text-xs font-bold mb-2">
                  <span className="font-extrabold">Needs Review</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{pendingApprovalCount}</div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-bold mt-1">Pending Approval</div>
              </div>

              <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-blue-200 dark:border-blue-900/50 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-xs font-bold mb-2">
                  <span>Awaiting Payment</span>
                  <CreditCard className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{approvedPaymentCount}</div>
                <div className="text-[11px] text-blue-500 dark:text-blue-400 mt-1">User has payment info</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 p-5 rounded-3xl border-2 border-purple-300 dark:border-purple-800/60 shadow-sm">
                <div className="flex items-center justify-between text-purple-900 dark:text-purple-300 text-xs font-bold mb-2">
                  <span className="font-extrabold">Payment Review</span>
                  <FileCheck className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-3xl font-black text-purple-600 dark:text-purple-400">{paymentReviewCount}</div>
                <div className="text-[11px] text-purple-800 dark:text-purple-300 font-bold mt-1">Receipts Uploaded</div>
              </div>

              <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 text-xs font-bold mb-2">
                  <span>Total Volume</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {totalVolumeEgp.toLocaleString()} <span className="text-xs">EGP</span>
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">{completedCount} Completed</div>
              </div>
            </div>

            {/* Date Filters & Presets Bar */}
            <div className="bg-white dark:bg-[#14111d] p-4 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>تصفية حسب التاريخ:</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL', label: 'كل الأوقات' },
                    { key: 'TODAY', label: 'اليوم' },
                    { key: 'YESTERDAY', label: 'أمس' },
                    { key: 'LAST_7_DAYS', label: 'آخر 7 أيام' },
                    { key: 'LAST_30_DAYS', label: 'آخر 30 يوم' },
                    { key: 'THIS_MONTH', label: 'هذا الشهر' },
                    { key: 'CUSTOM', label: 'نطاق مخصص 📅' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setDateRange(p.key as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        dateRange === p.key
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#201a2e]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range Picker */}
              {dateRange === 'CUSTOM' && (
                <div className="p-3 bg-neutral-50 dark:bg-[#181423] rounded-2xl border border-purple-200 dark:border-purple-900/60 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-600 dark:text-neutral-400">من تاريخ:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-[#14111d] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-600 dark:text-neutral-400">إلى تاريخ:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-[#14111d] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white"
                    />
                  </div>

                  <span className="text-[11px] text-neutral-400">
                    (تصفية الطلبات المحصورة بين التاريخين المحددين)
                  </span>
                </div>
              )}
            </div>

            {/* Filters, Shipment Select, Search & CSV Export Bar */}
            <div className="bg-white dark:bg-[#14111d] p-4 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                {[
                  { key: 'ALL', label: 'الكل (All)', count: totalOrdersCount, color: 'bg-neutral-800' },
                  { key: 'PENDING', label: '🟡 قيد المراجعة', count: pendingApprovalCount, color: 'bg-amber-500' },
                  { key: 'AWAITING_PAYMENT', label: '🔵 في انتظار الدفع', count: approvedPaymentCount, color: 'bg-blue-600' },
                  { key: 'PAYMENT_UNDER_REVIEW', label: '💳 مراجعة الدفع', count: paymentReviewCount, color: 'bg-purple-600', pulse: paymentReviewCount > 0 },
                  { key: 'PAID', label: '🟢 مدفوع', count: paidTabCount, color: 'bg-emerald-600' },
                  { key: 'DELIVERED', label: '📦 تم التوصيل', count: deliveredCount, color: 'bg-teal-600' },
                  { key: 'REJECTED', label: '🔴 ملغي', count: rejectedCount, color: 'bg-rose-600' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      statusFilter === tab.key
                        ? 'bg-neutral-950 dark:bg-purple-600 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#201a2e]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black text-white ${
                        statusFilter === tab.key ? 'bg-white/20' : tab.color
                      } ${tab.pulse ? 'animate-pulse ring-2 ring-purple-400' : ''}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
                {/* Shipment Filter Dropdown */}
                <div className="relative">
                  <select
                    value={shipmentFilter}
                    onChange={(e) => setShipmentFilter(e.target.value)}
                    className="px-3 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                  >
                    <option value="ALL">📦 كل الشحنات (All)</option>
                    <option value="UNASSIGNED">⚪ طلبات غير مسندة لشحنة</option>
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        📦 {s.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search order ID, customer, phone..."
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] text-neutral-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-[#201a2e] focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                {/* Export CSV Button */}
                <button
                  type="button"
                  onClick={() => exportOrdersToCsv(filteredOrders)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
                  title="تصدير نتائج الطلبات الحالية إلى ملف CSV"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير CSV ({filteredOrders.length})</span>
                </button>
              </div>
            </div>

            {/* Bulk Action Bar (when orders selected) */}
            {selectedOrderIds.length > 0 && (
              <div className="p-3.5 bg-neutral-900 text-white rounded-2xl border border-neutral-800 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <CheckSquare className="w-4 h-4 text-purple-400" />
                  <span>تم تحديد {selectedOrderIds.length} طلب</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value=""
                    onChange={async (e) => {
                      if (e.target.value) {
                        await handleBulkAssignShipment(e.target.value);
                      }
                    }}
                    className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <option value="">-- إسناد المحدد إلى شحنة --</option>
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} ({s.status})
                      </option>
                    ))}
                    <option value="UNASSIGN">❌ إلغاء الإسناد عن الشحنة</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const selected = orders.filter((o) => selectedOrderIds.includes(o.id));
                      exportOrdersToCsv(selected, 'shein_selected_orders');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    تصدير المحدد CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-all"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
            )}

            {/* Orders Table */}
            <div className="bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-[#181422] border-b border-neutral-200 dark:border-[#2a243a] text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <th className="py-4 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds(filteredOrders.map((o) => o.id));
                            } else {
                              setSelectedOrderIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-4 px-5">Order ID &amp; Date</th>
                      <th className="py-4 px-5">Customer Info</th>
                      <th className="py-4 px-5">Goods Preview</th>
                      <th className="py-4 px-5">Cash &amp; Fees</th>
                      <th className="py-4 px-5">الشحنة (Shipment)</th>
                      <th className="py-4 px-5">Live Status</th>
                      <th className="py-4 px-5 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-[#241e33] text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-14 text-center text-neutral-400 font-medium">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-300" />
                          Loading orders...
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-14 text-center text-neutral-400 font-medium">
                          No orders found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        return (
                          <tr
                            key={order.id}
                            className={`transition-colors group cursor-pointer ${
                              isSelected
                                ? 'bg-purple-50/50 dark:bg-purple-950/20'
                                : 'hover:bg-neutral-50/70 dark:hover:bg-[#1c1728]/70'
                            }`}
                            onClick={() => openReviewModal(order)}
                          >
                            <td className="py-5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedOrderIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== order.id) : [...prev, order.id]
                                  );
                                }}
                                className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                              />
                            </td>

                            <td className="py-5 px-5">
                              <div className="font-mono font-black text-neutral-950 dark:text-white text-sm">{order.id}</div>
                              <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                                {new Date(order.createdAt).toLocaleDateString()} at{' '}
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>

                            <td className="py-5 px-5">
                              <div className="font-bold text-neutral-900 dark:text-white">{order.userName}</div>
                              <div className="text-neutral-500 dark:text-neutral-400 text-[11px] font-mono">{order.userPhone || order.userEmail}</div>
                            </td>

                            <td className="py-5 px-5 max-w-xs">
                              <div className="flex items-center gap-2">
                                {order.items.slice(0, 3).map((it, idx) => (
                                  <div key={idx} className="w-8 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-[#2f2742] shadow-xs bg-purple-50 dark:bg-purple-950/40 shrink-0">
                                    <SafeImage
                                      src={it.image}
                                      alt={it.name || 'Order item'}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                                <span className="font-bold text-neutral-700 dark:text-neutral-300">
                                  {order.items.length} goods
                                </span>
                              </div>
                              <a
                                href={toUsableSheinUrl(order.extractedLink, { shc: order.cartShareCode, groupId: order.cartGroupId })}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-mono truncate mt-1 flex items-center gap-1 max-w-[200px]"
                                title="فتح الرابط في شي إن (m.shein)"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {toUsableSheinUrl(order.extractedLink, { shc: order.cartShareCode, groupId: order.cartGroupId })}
                                </span>
                              </a>
                            </td>

                            <td className="py-5 px-5">
                              <div className="font-black text-sm text-neutral-950 dark:text-white">
                                {order.totalCash.toLocaleString()} EGP
                              </div>
                              <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                                {order.dynamicFeeAmount > 0
                                  ? `المنتجات: ${order.itemsSubtotal.toLocaleString()} + رسوم الخدمة والتوصيل: ${order.dynamicFeePercent}% (${order.dynamicFeeAmount.toLocaleString()} ج.م)`
                                  : `المنتجات: ${order.itemsSubtotal.toLocaleString()} EGP`}
                              </div>
                            </td>

                            {/* Shipment Batch Column */}
                            <td className="py-5 px-5" onClick={(e) => e.stopPropagation()}>
                              {order.shipmentCode ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                  <Package className="w-3.5 h-3.5 text-purple-600" />
                                  <span className="truncate max-w-[130px]">{order.shipmentCode}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(order)}
                                  className="text-[11px] font-bold text-neutral-400 hover:text-purple-600 border border-dashed border-neutral-300 dark:border-[#2f2742] px-2 py-0.5 rounded-lg"
                                >
                                  + إسناد لشحنة
                                </button>
                              )}
                            </td>

                            <td className="py-5 px-5">
                              <StatusBadge status={order.status} />
                            </td>

                            <td className="py-5 px-5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReviewModal(order);
                                }}
                                className="px-4 py-2 bg-neutral-950 dark:bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-2xl text-xs transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {order.status === 'PENDING_APPROVAL' ? 'Review & Approve' : 'Open Review'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ACCURATE ORDER REVIEW MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-lg border border-rose-200">
                    Admin Review Mode
                  </span>
                  <span className="font-mono text-lg font-black text-neutral-950">
                    Order #{selectedOrder.id}
                  </span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Customer: <strong>{selectedOrder.userName}</strong> ({selectedOrder.userPhone || selectedOrder.userEmail}) • Placed: {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
                {selectedOrder.shippingAddress && (
                  <p className="text-xs text-neutral-700 font-semibold mt-0.5">
                    📍 عنوان التوصيل: <span>{selectedOrder.shippingAddress}</span>
                  </p>
                )}
                {selectedOrder.customerNotes && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                    📝 ملاحظات العميل: <strong>{selectedOrder.customerNotes}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={updating}
                  onClick={handleSaveAndApply}
                  className={`px-4 py-2 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    hasUnsavedChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 animate-pulse'
                      : 'bg-neutral-800 hover:bg-neutral-900 text-white'
                  }`}
                  title="حفظ واعتماد التعديلات على الأسعار والمنتجات فوراً"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {updating
                      ? 'جاري الحفظ...'
                      : selectedOrder.status === 'APPROVED_PENDING_PAYMENT'
                      ? 'حفظ وتحديث الأسعار للعميل (Save & Apply)'
                      : hasUnsavedChanges
                      ? 'حفظ واعتماد (Save & Apply)'
                      : 'حفظ (Save)'}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping inline-block" />
                  )}
                </button>

                <button
                  onClick={() => {
                    if (
                      hasUnsavedChanges &&
                      !window.confirm('لديك تعديلات غير محفوظة على هذا الطلب. هل تريد الخروج وتجاهل التعديلات؟')
                    ) {
                      return;
                    }
                    setSelectedOrder(null);
                  }}
                  className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Payment Phase Alert / Unsaved Edits Alerts */}
              {selectedOrder.status === 'CANCELLED' && (
                <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-300 text-rose-950 text-xs space-y-1.5 text-start">
                  <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>طلب ملغي (Cancelled Order)</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed font-normal">
                    {selectedOrder.cancellationReason || 'تم إلغاء هذا الطلب وانتهت مهلة صلاحية السعر المعتمد.'}
                  </p>
                  {selectedOrder.cancelledAt && (
                    <p className="text-[11px] text-rose-700 font-medium">
                      وقت الإلغاء: {new Date(selectedOrder.cancelledAt).toLocaleString()} • جهة الإلغاء:{' '}
                      {selectedOrder.cancelledBy === 'customer'
                        ? 'العميل من صفحة الدفع'
                        : selectedOrder.cancelledBy === 'system'
                        ? 'النظام تلقائياً لانتهاء مهلة السداد (ساعة واحدة)'
                        : 'الإدارة'}
                    </p>
                  )}
                </div>
              )}

              {selectedOrder.status === 'APPROVED_PENDING_PAYMENT' && (
                <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="space-y-0.5 text-start">
                      <p className="font-black text-blue-900 flex items-center gap-2">
                        <span>الطلب معتمد حالياً وفي انتظار سداد العميل ({selectedOrder.totalCash.toLocaleString()} EGP)</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-black">
                          <Lock className="w-3 h-3 text-blue-600" />
                          الأسعار مثبتة ومحمية
                        </span>
                      </p>
                      <p className="text-[11px] text-blue-700">
                        سعر الصرف المعتمد لهذا الطلب: <strong>{selectedOrder.exchangeRateUsed ?? settings?.sarToEgpRate ?? 15} ج.م / ر.س</strong> — محمي تماماً من تغيرات الإعدادات العامة. يمكنك تعديل أسعار المنتجات المقبولة أدناه والضغط على <strong>Save & Apply</strong> لتحديث السعر المعتمد للعميل.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-mono font-bold text-[11px] shrink-0">
                    Awaiting Payment
                  </span>
                </div>
              )}

              {selectedOrder.status === 'PAYMENT_UNDER_REVIEW' && (
                <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200 text-purple-950 text-xs flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                  <div className="space-y-0.5 text-start">
                    <p className="font-black text-[#6D28D9]">
                      العميل أرسل إيصال تحويل بمبلغ {selectedOrder.totalCash.toLocaleString()} EGP وهو قيد المطابقة
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      يرجى التأكد عند تعديل الأسعار حتى لا يحدث تعارض مع المبلغ المحول المسجل في إيصال الدفع.
                    </p>
                  </div>
                </div>
              )}

              {['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedOrder.status) && (
                <div className="p-3.5 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>طلب مدفوع:</strong> الأسعار مقفلة لحماية اتساق الحسابات.
                    </span>
                  </div>
                  {!unlockPaidEdit ? (
                    <button
                      type="button"
                      onClick={() => setUnlockPaidEdit(true)}
                      className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 transition-colors cursor-pointer"
                    >
                      تمكين التعديل الاستثنائي
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      التعديل الاستثنائي مفعل ✓
                    </span>
                  )}
                </div>
              )}

              {hasUnsavedChanges && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5 text-start">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-black text-amber-950">
                        لديك تعديلات جديدة على الأسعار أو المنتجات لم تُعتمد بعد!
                      </p>
                      <p className="text-[11px] text-amber-900 mt-0.5">
                        {(() => {
                          const { totalCash } = calculateReviewTotals();
                          const diff = totalCash - selectedOrder.totalCash;
                          if (diff !== 0) {
                            return (
                              <>
                                السعر السابق: <span className="font-mono font-bold line-through">{selectedOrder.totalCash.toLocaleString()} EGP</span> ➔{' '}
                                السعر الجديد بعد التعديل: <span className="font-mono font-black text-emerald-800">{totalCash.toLocaleString()} EGP</span>{' '}
                                ({diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} EGP)
                              </>
                            );
                          }
                          return 'اضغط على زر حفظ واعتماد (Save & Apply) لتطبيق التعديلات على الطلب.';
                        })()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={handleSaveAndApply}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{updating ? 'جاري الحفظ...' : 'حفظ واعتماد التعديلات (Save & Apply)'}</span>
                  </button>
                </div>
              )}
              {/* SHEIN Link Bar */}
              <div className="p-4 bg-neutral-950 text-white rounded-2xl flex items-center justify-between text-xs border border-white/10">
                <div className="flex items-center gap-2 overflow-hidden mr-3">
                  <span className="font-bold text-neutral-400">SHEIN Cart Link (m.shein):</span>
                  <span className="font-mono truncate text-emerald-400">
                    {toUsableSheinUrl(selectedOrder.extractedLink, { shc: selectedOrder.cartShareCode, groupId: selectedOrder.cartGroupId })}
                  </span>
                </div>
                <a
                  href={toUsableSheinUrl(selectedOrder.extractedLink, { shc: selectedOrder.cartShareCode, groupId: selectedOrder.cartGroupId })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer active:scale-95"
                >
                  Open on SHEIN (m.shein) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Shipment Batch Assignment Box */}
              <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-neutral-900 dark:text-white">
                      الشحنة التابع لها هذا الطلب (Shipment Batch):
                    </h5>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {selectedOrder.shipmentCode
                        ? `مسند حالياً إلى: ${selectedOrder.shipmentCode}`
                        : 'هذا الطلب غير مسند لأي دفعة شحن حتى الآن.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedOrder.shipmentId || ''}
                    onChange={async (e) => {
                      const newShpId = e.target.value;
                      const targetShipment = shipments.find((s) => s.id === newShpId);
                      await handleAssignSingleOrderShipment(selectedOrder.id, newShpId, targetShipment?.code);
                    }}
                    className="px-3.5 py-2 bg-white dark:bg-[#1a1626] border border-purple-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                  >
                    <option value="">-- غير مسند لشحنة (Unassigned) --</option>
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        📦 {s.code} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PAYMENT RECEIPT VERIFICATION BOX */}
              {selectedOrder.payment && (
                <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-purple-700" />
                      <h4 className="font-black text-sm text-purple-950">
                        Payment Proof Receipt Submitted ({selectedOrder.payment.method.toUpperCase()})
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white/80 p-3 rounded-2xl border border-purple-200">
                      <p className="text-neutral-500 font-semibold">Sender Phone / IPA:</p>
                      <p className="font-mono font-black text-neutral-900 text-sm">
                        {selectedOrder.payment.senderIdentifier}
                      </p>
                    </div>
                    <div className="bg-white/80 p-3 rounded-2xl border border-purple-200">
                      <p className="text-neutral-500 font-semibold">Transaction Reference:</p>
                      <p className="font-mono font-black text-neutral-900 text-sm">
                        {selectedOrder.payment.transactionReference || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {selectedOrder.payment.receiptImage && (
                    <div>
                      <p className="text-xs font-bold text-neutral-700 mb-2">Screenshot Proof (Click to zoom):</p>
                      <div className="relative inline-block border-2 border-purple-200 rounded-2xl overflow-hidden bg-white shadow-sm max-w-xs">
                        <img
                          src={selectedOrder.payment.receiptImage}
                          alt="Receipt"
                          className="max-h-48 object-contain cursor-pointer hover:opacity-95"
                          onClick={() => setZoomReceipt(!zoomReceipt)}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomReceipt(!zoomReceipt)}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/70 text-white rounded-lg text-xs"
                          title="Zoom"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {zoomReceipt && (
                        <div
                          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
                          onClick={() => setZoomReceipt(false)}
                        >
                          <img
                            src={selectedOrder.payment.receiptImage}
                            alt="Zoomed Receipt"
                            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrder.payment.adminNote && (
                    <div className="p-3 bg-white/60 rounded-xl border border-purple-200 text-xs text-neutral-600">
                      <strong>Previous Admin Note:</strong> {selectedOrder.payment.adminNote}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        handleUpdateOrder('PAID', 'VERIFIED', {
                          currentStep: 1,
                          carrier: trackingCarrier,
                          trackingNumber: trackingNumber || `SH-EG-${selectedOrder.id.replace(/\D/g, '')}`,
                          adminTrackingNote: 'تم التحقق من الدفع وتأكيده بنجاح، جاري تجهيز الطلب والشراء من شي إن.',
                        })
                      }
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      {updating ? 'Processing...' : 'تأكيد الدفع وتفعيل التتبع (Mark as Paid & Fulfill)'}
                    </button>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleUpdateOrder('APPROVED_PENDING_PAYMENT', 'REJECTED')}
                      className="px-4 py-2.5 bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-800 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      رفض التحويل (إعادة الطلب لمرحلة الدفع)
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE TRACKING CONTROL PANEL FOR ADMIN */}
              {['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedOrder.status) && (
                <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-pink-50/60 border-2 border-indigo-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-200/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-indigo-950">
                          لوحة التحكم بتتبع الشحنة للعميل (Tracking Control Panel)
                        </h4>
                        <p className="text-[11px] text-indigo-700">
                          أي تعديل هنا ينعكس فورياً في صفحة التتبع للعميل
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300 font-mono self-start sm:self-auto">
                      {selectedOrder.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        مرحلة التتبع (Order Stage):
                      </label>
                      <select
                        value={trackingStatus}
                        onChange={(e) => setTrackingStatus(e.target.value as OrderStatus)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="PAID">1. تم تأكيد الدفع (Payment Verified)</option>
                        <option value="PROCESSING">2. جاري الشراء من شي إن (Processing on SHEIN)</option>
                        <option value="SHIPPED">3. تم الشحن مع المندوب (In Transit / Shipped)</option>
                        <option value="DELIVERED">4. تم التوصيل للعميل (Delivered)</option>
                        <option value="COMPLETED">5. طلب مكتمل (Delivered & Completed)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        شركة الشحن / طريقة التوصيل:
                      </label>
                      <input
                        type="text"
                        value={trackingCarrier}
                        onChange={(e) => setTrackingCarrier(e.target.value)}
                        placeholder="بوسطة Bosta / أرامكس / مندوب خاص"
                        className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        رقم بوليصة الشحن (Tracking Number):
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="BST-9182390"
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      ملاحظة التتبع الحية للعميل (Tracking Update Note):
                    </label>
                    <input
                      type="text"
                      value={adminTrackingNote}
                      onChange={(e) => setAdminTrackingNote(e.target.value)}
                      placeholder="مثال: تم شراء المنتجات بنجاح من شي إن وتجهيزها للشحن إلى مصر..."
                      className="w-full px-3.5 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => {
                        const stepNum =
                          trackingStatus === 'PAID'
                            ? 1
                            : trackingStatus === 'PROCESSING'
                            ? 2
                            : trackingStatus === 'SHIPPED'
                            ? 3
                            : 4;
                        handleUpdateOrder(trackingStatus, undefined, {
                          carrier: trackingCarrier,
                          trackingNumber: trackingNumber || `SH-EG-${selectedOrder.id.replace(/\D/g, '')}`,
                          adminTrackingNote: adminTrackingNote,
                          currentStep: stepNum,
                        });
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{updating ? 'جاري الحفظ...' : 'تحديث مسار التتبع للعميل الآن ✓'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ITEM-BY-ITEM ACCURATE REVIEW */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <h4 className="font-black text-neutral-950 text-sm flex items-center gap-2">
                    <span>Item-by-Item Review ({reviewItems.length} goods)</span>
                  </h4>
                  <span className="text-[11px] text-neutral-500 font-medium">
                    تعديل سعر كل منتج، أو رفض منتج بعينه، أو إضافة ملاحظة خاصة به
                  </span>
                </div>

                <div className="space-y-3.5">
                  {reviewItems.map((item, idx) => {
                    const isRejected = item.status === 'rejected' || item.status === 'out_of_stock';
                    return (
                      <div
                        key={item.id}
                        className={`p-5 rounded-3xl border space-y-3 shadow-xs transition-colors ${
                          isRejected
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-neutral-200 bg-neutral-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-16 h-20 rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-xs shrink-0">
                              <SafeImage
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-extrabold text-neutral-950 text-xs sm:text-sm line-clamp-2">{item.name}</h5>
                                {isRejected && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-200 text-rose-800 text-[10px] font-black shrink-0">
                                    مرفوض / غير متوفر
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 mt-1">
                                {item.color && <span>Color: <strong>{item.color}</strong></span>}
                                {item.size && <span>Size: <strong>{item.size}</strong></span>}
                                {item.sku && <span className="font-mono">{item.sku}</span>}
                                {item.sourcePrice && (
                                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono font-bold text-[10px] border border-purple-200">
                                    المتجر السعودي: {item.sourcePrice} {item.sourceCurrency || 'SAR'}
                                  </span>
                                )}
                              </div>

                              {/* Product Link & Reject / Approve Toggle */}
                              <div className="pt-2 flex flex-wrap items-center gap-2">
                                <a
                                  href={toUsableSheinUrl(item.originalUrl, {
                                    goodsId: item.id,
                                    sku: item.sku,
                                    shc: selectedOrder.cartShareCode,
                                    groupId: selectedOrder.cartGroupId,
                                    cartLandingUrl: selectedOrder.extractedLink,
                                  })}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="فتح صفحة هذا المنتج على موقع شي إن (m.shein)"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>رابط المنتج (m.shein) ↗</span>
                                </a>

                                {isRejected ? (
                                  <button
                                    type="button"
                                    onClick={() => handleItemFieldChange(idx, 'status', 'available')}
                                    className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 transition-colors cursor-pointer"
                                  >
                                    ✓ استعادة وقبول هذا المنتج
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleItemFieldChange(idx, 'status', 'rejected')}
                                    className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-xl border border-rose-300 transition-colors cursor-pointer"
                                  >
                                    ✕ رفض واستبعاد هذا المنتج
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Price & Quantity Editable Fields */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Price (EGP)
                                </label>
                                {Boolean(item.discountPercent && item.discountPercent > 0) && (
                                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    -{item.discountPercent}%
                                  </span>
                                )}
                              </div>
                              {item.originalPriceBeforeDiscount && item.originalPriceBeforeDiscount > item.originalPrice ? (
                                <span className="text-[10px] text-neutral-400 line-through font-mono block text-right mb-0.5">
                                  {item.originalPriceBeforeDiscount.toLocaleString()} EGP
                                </span>
                              ) : null}
                              {(() => {
                                const isPaidOrder = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(selectedOrder.status);
                                const isPriceInputDisabled = isRejected || (isPaidOrder && !unlockPaidEdit);
                                const isPriceEdited = item.originalPrice !== (selectedOrder.items[idx]?.originalPrice ?? item.originalPrice);
                                return (
                                  <input
                                    type="number"
                                    disabled={isPriceInputDisabled}
                                    value={item.originalPrice}
                                    onChange={(e) =>
                                      handleItemFieldChange(idx, 'originalPrice', e.target.value)
                                    }
                                    className={`w-24 px-3 py-1.5 text-xs font-black bg-white border rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                      isRejected
                                        ? 'opacity-40 line-through border-neutral-200'
                                        : isPriceEdited
                                        ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-400 font-black'
                                        : 'border-neutral-200'
                                    }`}
                                  />
                                );
                              })()}
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Qty
                              </label>
                              <input
                                type="number"
                                min={1}
                                disabled={isRejected}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'quantity', e.target.value)
                                }
                                className={`w-16 px-3 py-1.5 text-xs font-black bg-white border border-neutral-200 rounded-xl text-center focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                                  isRejected ? 'opacity-40' : ''
                                }`}
                              />
                            </div>
                            <div className="text-right min-w-[70px]">
                              <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Subtotal
                              </span>
                              {isRejected ? (
                                <span className="font-black text-xs text-rose-600 block">
                                  0 EGP (مستبعد)
                                </span>
                              ) : (
                                <span className="font-black text-sm text-neutral-950 font-mono">
                                  {item.subtotal.toLocaleString()} EGP
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Admin Comment field for THIS specific good */}
                        <div className="pt-2 border-t border-neutral-200/60">
                          <label className="block text-[11px] font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
                            {isRejected ? 'سبب رفض المنتج (يظهر للعميل):' : 'ملاحظة خاصة بالمنتج (تظهر للعميل):'}
                          </label>
                          <input
                            type="text"
                            value={item.adminComment || ''}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'adminComment', e.target.value)
                            }
                            placeholder={isRejected ? 'مثال: المقاس المطلوب غير متوفر حالياً على شي إن...' : 'مثال: تم التأكد من المقاس واللون...'}
                            className="w-full px-3.5 py-2 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-neutral-400"
                          />

                          {/* Quick comment chips */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(isRejected
                              ? ['المقاس غير متوفر على شي إن', 'اللون المطلوب نفذ', 'المنتج غير متاح للشحن لمصر', 'السعر ارتفع كثيراً في شي إن']
                              : PRESET_ITEM_COMMENTS
                            ).map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleItemFieldChange(idx, 'adminComment', preset)}
                                className="text-[10px] font-semibold bg-white hover:bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unified Service & Delivery Fee Display (Task 11) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white">رسوم الخدمة والتوصيل:</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-600 text-white font-mono">
                        {calculateReviewTotals().effectiveFee}%
                      </span>
                      <span className="text-[10px] text-purple-300 font-bold bg-purple-950/70 border border-purple-800/80 px-2 py-0.5 rounded-md">
                        نسبة عامة موحدة
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      تحسب تلقائياً بنسبة ({calculateReviewTotals().effectiveFee}%) من إجمالي المنتجات المقبولة ({calculateReviewTotals().subtotal.toLocaleString()} ج.م).
                    </p>
                  </div>
                </div>

                {(() => {
                  const { subtotal, feeAmount, totalCash, effectiveFee } = calculateReviewTotals();
                  return (
                    <div className="flex items-center gap-3 text-xs text-right w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">مجموع المنتجات:</span>
                        <strong className="text-white font-mono text-sm">{subtotal.toLocaleString()} EGP</strong>
                      </div>
                      <div>
                        <span className="text-purple-300 block text-[10px]">رسوم الخدمة ({effectiveFee}%):</span>
                        <strong className="text-purple-400 font-mono text-sm">+{feeAmount.toLocaleString()} EGP</strong>
                      </div>
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-2xl font-black text-base shadow-sm font-mono shrink-0">
                        الإجمالي: {totalCash.toLocaleString()} EGP
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* OVERALL ORDER COMMENT BY ADMIN */}
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-600" />
                  Overall Admin Comment for the Order:
                </label>
                <textarea
                  rows={3}
                  value={reviewOrderComment}
                  onChange={(e) => setReviewOrderComment(e.target.value)}
                  placeholder="e.g. Cart accurately reviewed! All items are available. Please transfer total to Vodafone Cash or InstaPay."
                  className="w-full p-4 text-xs bg-neutral-50 border border-neutral-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950 font-sans"
                />
              </div>

              {/* ORDER AUDIT TRAIL & HISTORY (Task 12) */}
              {selectedOrder.auditLog && selectedOrder.auditLog.length > 0 && (
                <div className="p-4 rounded-2xl bg-neutral-100/90 border border-neutral-200/90 space-y-2 text-start">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-xs text-neutral-800 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-purple-600" />
                      <span>سجل حالات وعمليات الطلب (Audit Trail & History)</span>
                    </h5>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {selectedOrder.auditLog.length} أحداث مسجلة
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedOrder.auditLog.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white border border-neutral-200 text-xs flex items-start justify-between gap-2 shadow-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 font-mono text-[11px]">{entry.action}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {entry.toStatus}
                            </span>
                          </div>
                          {entry.note && (
                            <p className="text-[11px] text-neutral-600 font-normal leading-relaxed">{entry.note}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="text-[10px] font-semibold text-neutral-500">
                            {entry.actor}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-5 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (
                    hasUnsavedChanges &&
                    !window.confirm('لديك تعديلات غير محفوظة على هذا الطلب. هل تريد الخروج وتجاهل التعديلات؟')
                  ) {
                    return;
                  }
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* PRIMARY SAVE & APPLY BUTTON */}
                <button
                  type="button"
                  disabled={updating}
                  onClick={handleSaveAndApply}
                  className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                    hasUnsavedChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/50 shadow-emerald-600/20 animate-pulse'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                  title="حفظ واعتماد التعديلات على الأسعار والمنتجات فوراً في النظام"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {updating
                      ? 'جاري الحفظ...'
                      : selectedOrder.status === 'APPROVED_PENDING_PAYMENT'
                      ? 'حفظ وتحديث الأسعار للعميل (Save & Apply)'
                      : hasUnsavedChanges
                      ? 'حفظ واعتماد التعديلات (Save & Apply)'
                      : 'حفظ التعديلات (Save)'}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping inline-block" />
                  )}
                </button>

                {selectedOrder.status !== 'REJECTED' && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateOrder('REJECTED')}
                    className="px-4 py-2.5 bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Order</span>
                  </button>
                )}

                {(selectedOrder.status === 'PENDING_APPROVAL' || selectedOrder.status === 'REJECTED' || selectedOrder.status === 'CANCELLED') && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateOrder('APPROVED_PENDING_PAYMENT')}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{updating ? 'Processing...' : 'اعتماد الطلب وفتح الدفع (Approve & Unlock Payment)'}</span>
                  </button>
                )}

                {selectedOrder.status === 'APPROVED_PENDING_PAYMENT' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold">
                    <CreditCard className="w-4 h-4" />
                    <span>الطلب معتمد ومتاح للدفع ({selectedOrder.totalCash.toLocaleString()} EGP)</span>
                  </div>
                )}

                {['PAID', 'PROCESSING', 'SHIPPED'].includes(selectedOrder.status) && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateOrder('DELIVERED')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد التوصيل (Mark Delivered)</span>
                  </button>
                )}

                {selectedOrder.status === 'PAID' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Order paid (مدفوع)
                  </div>
                )}

                {selectedOrder.status === 'PROCESSING' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 text-xs font-bold">
                    <ShoppingBag className="w-4 h-4" />
                    Purchasing on SHEIN
                  </div>
                )}

                {selectedOrder.status === 'SHIPPED' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sky-700 rounded-xl border border-sky-200 text-xs font-bold">
                    <Truck className="w-4 h-4" />
                    In transit with carrier
                  </div>
                )}

                {(selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'COMPLETED') && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-800 rounded-xl border border-teal-200 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    ✓ تم التوصيل للعميل بنجاح (Delivered)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL SITE CMS & SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-neutral-50 via-purple-50/40 to-white border-b border-neutral-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#7C3AED] text-[10px] font-black uppercase tracking-wider">
                    Site Customizer &amp; CMS
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400">تحكم فوري مباشر</span>
                </div>
                <h3 className="text-xl font-black text-neutral-950 mt-1">
                  إعدادات الموقع، المحافظ، الدعم والسكاشن
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  تعديل أرقام الدعم، إظهار/إخفاء بيانات الدفع في السبورت، وتعديل أو إضافة سكاشن جديدة للموقع.
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-10 h-10 rounded-full bg-white hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center border border-neutral-200 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-neutral-100/70 border-b border-neutral-200 overflow-x-auto text-xs font-black">
              <button
                type="button"
                onClick={() => setSettingsTab('payments')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  settingsTab === 'payments'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-neutral-600 hover:bg-white/60'
                }`}
              >
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>طرق الدفع والمحافظ</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('support')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  settingsTab === 'support'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-neutral-600 hover:bg-white/60'
                }`}
              >
                <Phone className="w-4 h-4 text-purple-600" />
                <span>أرقام الدعم والتواصل</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('sections')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  settingsTab === 'sections'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-neutral-600 hover:bg-white/60'
                }`}
              >
                <Layout className="w-4 h-4 text-purple-600" />
                <span>تعديل السكاشن الحالية</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('custom_sections')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  settingsTab === 'custom_sections'
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-neutral-600 hover:bg-white/60'
                }`}
              >
                <Layers className="w-4 h-4 text-purple-600" />
                <span>السكاشن المخصصة ({editCustomSections.length})</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveSettings} className="overflow-y-auto flex-1 p-6 space-y-6 text-xs text-neutral-800">
              {/* TAB 1: PAYMENTS & WALLETS */}
              {settingsTab === 'payments' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Dynamic Pricing Engine (Admin Only) */}
                  <div className="p-5 bg-gradient-to-br from-purple-50/90 via-white to-purple-50/40 rounded-3xl border-2 border-purple-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                          <h4 className="font-black text-neutral-950 text-sm">
                            محرك التسعير الديناميكي لمنتجات شي إن (Dynamic Pricing Engine)
                          </h4>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          تحديد سعر صرف الريال وهامش الربح المطلوب — يتم احتساب السعر بالجنيه تلقائياً دون كشف تفاصيل المعادلة للعميل.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                        متحكم فيه بالكامل
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-black text-neutral-800 text-xs mb-1">
                          سعر صرف الريال السعودي (SAR to EGP)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min={1}
                            max={100}
                            required
                            value={editSarToEgpRate}
                            onChange={(e) => setEditSarToEgpRate(Number(e.target.value))}
                            className="w-full pl-20 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 font-black text-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                            ج.م / ريال
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1">القيمة الحالية: {editSarToEgpRate} جنيه مصري لكل 1 ريال سعودي.</p>
                      </div>

                      <div>
                        <label className="block font-black text-neutral-800 text-xs mb-1">
                          نسبة هامش الربح المضافة للمنتج (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={100}
                            required
                            value={editProfitMarginPercent}
                            onChange={(e) => setEditProfitMarginPercent(Number(e.target.value))}
                            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 font-black text-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                            %
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1">تضاف تلقائياً فوق السعر المحول بالجنيه (افتراضياً 10%).</p>
                      </div>
                    </div>

                    {/* Interactive Live Formula Preview */}
                    <div className="p-3.5 bg-white rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="space-y-1 text-center sm:text-right">
                        <span className="font-extrabold text-purple-900 block">
                          💡 تجربة حية للمعادلة (Live Preview):
                        </span>
                        <div className="font-mono text-neutral-600 text-[11px]">
                          منتج بسعر <strong>10 ريال</strong> × {editSarToEgpRate} = <strong>{(10 * editSarToEgpRate).toFixed(1)} ج.م</strong> + {editProfitMarginPercent}% ربح
                        </div>
                      </div>
                      <div className="text-center sm:text-left bg-purple-50 px-4 py-2 rounded-xl border border-purple-200/80">
                        <span className="text-[10px] font-bold text-purple-700 block">السعر النهائي الذي يظهر للعميل:</span>
                        <span className="font-black text-base text-purple-950 font-mono">
                          {Math.round((10 * editSarToEgpRate) * (1 + editProfitMarginPercent / 100))} EGP
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-[11px] flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-emerald-900 font-black">نظام حماية وتثبيت الأسعار المعتمدة (Price Locking System):</strong>
                        <span className="text-emerald-800 leading-relaxed block mt-0.5">
                          تغيير سعر الصرف أو نسبة الربح يطبق تلقائياً على <strong>الطلبات الجديدة والطلبات غير المراجعة (قيد المراجعة)</strong> فقط. جميع الطلبات التي تمت مراجعتها واعتمادها وانتقلت إلى مرحلة الدفع تظل أسعارها ثابتة ومحمية تماماً ولا تتغير.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Fee & Shipping */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                    <div>
                      <label className="block font-black text-neutral-800 mb-1">
                        نسبة رسوم الخدمة والتوصيل الموحدة (%)
                      </label>
                      <div className="relative">
                        <Percent className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          required
                          value={editFeePercent}
                          onChange={(e) => setEditFeePercent(Number(e.target.value))}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 font-black text-sm"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">النسبة الموحدة المعتمدة على مستوى النظام لكافة الطلبات الجديدة والطلبات قيد المراجعة (تحسب كنسبة من مجموع المنتجات).</p>
                    </div>

                    <div>
                      <label className="block font-black text-neutral-800 mb-1">
                        رسوم الشحن الثابتة (جنيه مصري)
                      </label>
                      <div className="relative">
                        <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="number"
                          min={0}
                          value={editFlatShippingFee}
                          onChange={(e) => setEditFlatShippingFee(Number(e.target.value))}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 font-black text-sm"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">اجعلها 0 لو الشحن مجاني داخل مصر.</p>
                    </div>
                  </div>

                  {/* Toggle: Payment details in Support Modal */}
                  <div className="p-5 rounded-2xl border-2 border-purple-200 bg-gradient-to-r from-purple-50/70 via-white to-purple-50/30 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-neutral-950 text-sm">
                          إظهار سكشن بيانات وطرق الدفع في نافذة الدعم (Support Modal)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          مطلوب من الإدارة
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        عند التفعيل، تظهر أرقام الحسابات وطرق التحويل داخل نافذة الدعم الفني. عند التعطيل يتم إخفاؤها تماماً من نافذة الدعم.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={editShowPaymentInSupport}
                        onChange={(e) => setEditShowPaymentInSupport(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* InstaPay Target Account */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center font-bold">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-neutral-950 text-sm">حساب إنستاباي (InstaPay)</h4>
                          <p className="text-[11px] text-neutral-400">تفعيل واستقبال المدفوعات اللحظية في مصر</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEnableInstapay}
                          onChange={(e) => setEditEnableInstapay(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-neutral-700 dark:text-neutral-300 text-xs mb-1">
                          عنوان الدفع اللحظي (IPA Address)
                        </label>
                        <input
                          type="text"
                          value={editInstapayAddress}
                          onChange={(e) => setEditInstapayAddress(e.target.value)}
                          placeholder="anasashraf10@instapay"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#14111d] font-mono font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-700 dark:text-neutral-300 text-xs mb-1">
                          اسم صاحب الحساب المعروض للعميل
                        </label>
                        <input
                          type="text"
                          value={editInstapayName}
                          onChange={(e) => setEditInstapayName(e.target.value)}
                          placeholder="anasashraf10"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#14111d] text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 dark:text-neutral-300 text-xs mb-1">
                        رابط الدفع المباشر لإنستاباي (InstaPay Link / ipn.eg)
                      </label>
                      <input
                        type="url"
                        value={editInstapayUrl}
                        onChange={(e) => setEditInstapayUrl(e.target.value)}
                        placeholder="https://ipn.eg/S/anasashraf10/instapay/6OaEAR"
                        className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl focus:bg-white dark:focus:bg-[#14111d] font-mono text-xs"
                      />
                      <p className="text-[11px] text-neutral-500 mt-1">
                        الرابط يفتح تطبيق InstaPay على هاتف العميل مباشرة لتحويل المبلغ لحسابك دون إدخال يدوي.
                      </p>
                    </div>
                  </div>

                  {/* Vodafone Cash Target Wallet */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-neutral-950 text-sm">محفظة فودافون كاش (Vodafone Cash)</h4>
                          <p className="text-[11px] text-neutral-400">تحويل كاش عبر رقم الهاتف وإرفاق السكرين شوت</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEnableVodafoneCash}
                          onChange={(e) => setEditEnableVodafoneCash(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">
                          رقم محفظة فودافون كاش
                        </label>
                        <input
                          type="text"
                          value={editVodafoneNumber}
                          onChange={(e) => setEditVodafoneNumber(e.target.value)}
                          placeholder="01284947782"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">
                          تعليمات التحويل للعميل
                        </label>
                        <input
                          type="text"
                          value={editVodafoneInstructions}
                          onChange={(e) => setEditVodafoneInstructions(e.target.value)}
                          placeholder="أرسل المبلغ للرقم أعلاه عبر فودافون كاش ثم أرفق لقطة الشاشة"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Secondary Wallet (Optional) */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4 bg-neutral-50/50">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-200/60">
                      <Wallet className="w-4 h-4 text-amber-600" />
                      <h4 className="font-black text-neutral-950 text-sm">محفظة كاش إضافية (اختياري)</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">
                          اسم المحفظة الإضافية (مثل: اتصالات كاش / أورنج كاش)
                        </label>
                        <input
                          type="text"
                          value={editSecondaryWalletName}
                          onChange={(e) => setEditSecondaryWalletName(e.target.value)}
                          placeholder="اتصالات كاش / أورنج كاش"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">
                          رقم المحفظة الإضافية
                        </label>
                        <input
                          type="text"
                          value={editSecondaryWalletNumber}
                          onChange={(e) => setEditSecondaryWalletNumber(e.target.value)}
                          placeholder="012XXXXXXXX"
                          className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUPPORT & CONTACTS */}
              {settingsTab === 'support' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="p-5 bg-gradient-to-r from-blue-50/60 to-purple-50/60 rounded-2xl border border-blue-200/60 flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <h4 className="font-black text-neutral-950 text-sm">بيانات الدعم الفني وخدمة العملاء</h4>
                      <p className="text-xs text-neutral-500">تظهر هذه الأرقام في نافذة الدعم وفي أسفل كل فاتورة لعملائك في مصر.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        رقم الهاتف / الخط الساخن المباشر
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={editSupportPhone}
                          onChange={(e) => setEditSupportPhone(e.target.value)}
                          placeholder="+20 128 494 7782"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        رقم محادثة الواتساب (WhatsApp Direct Chat)
                      </label>
                      <div className="relative">
                        <MessageCircle className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                        <input
                          type="text"
                          value={editSupportWhatsapp}
                          onChange={(e) => setEditSupportWhatsapp(e.target.value)}
                          placeholder="+201284947782"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        البريد الإلكتروني المخصص للدعم (Email)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="email"
                          value={editSupportEmail}
                          onChange={(e) => setEditSupportEmail(e.target.value)}
                          placeholder="gamallahmedd01@gmail.com"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        مواعيد وساعات العمل
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={editSupportHours}
                          onChange={(e) => setEditSupportHours(e.target.value)}
                          placeholder="يومياً من ٩:٠٠ صباحاً حتى ١١:٠٠ مساءً"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EDIT EXISTING BUILT-IN SECTIONS */}
              {settingsTab === 'sections' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Announcement Bar */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div>
                        <h4 className="font-black text-neutral-950 text-sm">شريط الإعلانات العلوي (Announcement Bar)</h4>
                        <p className="text-[11px] text-neutral-400">يظهر بأعلى كل صفحات الموقع لجذب انتباه العملاء بالعروض</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAnnouncementEnabled}
                          onChange={(e) => setEditAnnouncementEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {editAnnouncementEnabled && (
                      <div className="space-y-3">
                        <div>
                          <label className="block font-bold text-neutral-700 mb-1">نص الإعلان</label>
                          <input
                            type="text"
                            value={editAnnouncementText}
                            onChange={(e) => setEditAnnouncementText(e.target.value)}
                            placeholder="خدمة SHEIN Concierge — تسوق من شي إن والدفع بالجنيه المصري عبر InstaPay أو فودافون كاش"
                            className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-neutral-700 mb-1">لون شريط الإعلان</label>
                          <div className="flex items-center gap-2">
                            {[
                              { key: 'purple', label: 'بنفسجي متدرج', bg: 'bg-purple-600' },
                              { key: 'amber', label: 'عنبري مميز', bg: 'bg-amber-500' },
                              { key: 'emerald', label: 'زمردي أخضر', bg: 'bg-emerald-600' },
                              { key: 'rose', label: 'وردي / أحمر', bg: 'bg-rose-600' },
                            ].map((col) => (
                              <button
                                key={col.key}
                                type="button"
                                onClick={() => setEditAnnouncementBg(col.key as any)}
                                className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer font-bold ${
                                  editAnnouncementBg === col.key
                                    ? 'border-neutral-900 bg-neutral-100 font-black'
                                    : 'border-neutral-200 hover:bg-neutral-50'
                                }`}
                              >
                                <span className={`w-3 h-3 rounded-full ${col.bg}`} />
                                <span>{col.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hero Section Texts */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4">
                    <h4 className="font-black text-neutral-950 text-sm pb-2 border-b border-neutral-100">
                      سكشن الواجهة الرئيسي (Hero Section)
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">الوسم العلوي (Hero Badge)</label>
                        <input
                          type="text"
                          value={editHeroBadge}
                          onChange={(e) => setEditHeroBadge(e.target.value)}
                          placeholder="الخدمة الرسمية والأسرع في مصر"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">العنوان الرئيسي (Hero Title)</label>
                        <input
                          type="text"
                          value={editHeroTitle}
                          onChange={(e) => setEditHeroTitle(e.target.value)}
                          placeholder="استخرج سلة شي إن الخاصة بك وادفع بالجنيه المصري"
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-neutral-700 mb-1">الوصف الفرعي (Hero Subtitle)</label>
                        <textarea
                          rows={2}
                          value={editHeroSubtitle}
                          onChange={(e) => setEditHeroSubtitle(e.target.value)}
                          placeholder="الصق رابط سلة المشاركة، نتحقق من المقاسات والأسعار، وادفع بأمان عبر إنستاباي أو فودافون كاش."
                          className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trust Metrics Toggle */}
                  <div className="p-5 rounded-2xl border border-neutral-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-neutral-950 text-sm">شريط الضمانات وسرعة الشحن (Trust Metrics Bar)</h4>
                      <p className="text-[11px] text-neutral-400">الكروت الأربعة الموجودة أسفل كارت استخراج السلة (فحص دقيق، خصوصية، توصيل)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTrustMetricsEnabled}
                        onChange={(e) => setEditTrustMetricsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* How it works 3 steps */}
                  <div className="p-5 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div>
                        <h4 className="font-black text-neutral-950 text-sm">سكشن "كيف تعمل خدمة SHEIN Concierge؟"</h4>
                        <p className="text-[11px] text-neutral-400">تعديل أو إخفاء الخطوات الثلاثة في الصفحة الرئيسية</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editHowItWorksEnabled}
                          onChange={(e) => setEditHowItWorksEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {editHowItWorksEnabled && (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                          <span className="font-black text-purple-700">الخطوة 1:</span>
                          <input
                            type="text"
                            value={editStep1Title}
                            onChange={(e) => setEditStep1Title(e.target.value)}
                            placeholder="عنوان الخطوة الأولى"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg font-bold"
                          />
                          <input
                            type="text"
                            value={editStep1Desc}
                            onChange={(e) => setEditStep1Desc(e.target.value)}
                            placeholder="شرح الخطوة الأولى"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                          />
                        </div>

                        <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                          <span className="font-black text-purple-700">الخطوة 2:</span>
                          <input
                            type="text"
                            value={editStep2Title}
                            onChange={(e) => setEditStep2Title(e.target.value)}
                            placeholder="عنوان الخطوة الثانية"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg font-bold"
                          />
                          <input
                            type="text"
                            value={editStep2Desc}
                            onChange={(e) => setEditStep2Desc(e.target.value)}
                            placeholder="شرح الخطوة الثانية"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                          />
                        </div>

                        <div className="p-4 bg-neutral-50 rounded-xl space-y-2">
                          <span className="font-black text-purple-700">الخطوة 3:</span>
                          <input
                            type="text"
                            value={editStep3Title}
                            onChange={(e) => setEditStep3Title(e.target.value)}
                            placeholder="عنوان الخطوة الثالثة"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg font-bold"
                          />
                          <input
                            type="text"
                            value={editStep3Desc}
                            onChange={(e) => setEditStep3Desc(e.target.value)}
                            placeholder="شرح الخطوة الثالثة"
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CUSTOM SECTIONS BUILDER */}
              {settingsTab === 'custom_sections' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between p-5 bg-purple-50/60 rounded-2xl border border-purple-200/60">
                    <div>
                      <h4 className="font-black text-neutral-950 text-sm">إضافة سكاشن مخصصة للموقع (Dynamic Sections)</h4>
                      <p className="text-xs text-neutral-500">
                        يمكنك إضافة بنرات إعلانية، كروت مميزات، نصوص أو أسئلة شائعة تظهر في الصفحة الرئيسية.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewSectionModal(true)}
                      className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-purple-300" />
                      <span>إضافة سكشن جديد</span>
                    </button>
                  </div>

                  {/* List of existing custom sections */}
                  {editCustomSections.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-neutral-200 rounded-2xl space-y-3">
                      <Layers className="w-10 h-10 text-neutral-300 mx-auto" />
                      <p className="font-bold text-neutral-500">لا توجد سكاشن مخصصة مضافة حالياً.</p>
                      <button
                        type="button"
                        onClick={() => setShowNewSectionModal(true)}
                        className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer hover:bg-purple-700"
                      >
                        + اضغط هنا لإنشاء أول سكشن
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editCustomSections.map((sec, idx) => (
                        <div
                          key={sec.id || idx}
                          className="p-4 bg-white rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#7C3AED] flex items-center justify-center font-black text-sm">
                              {idx + 1}
                            </div>
                            <div className="text-start">
                              <div className="flex items-center gap-2">
                                <h5 className="font-black text-neutral-950 text-sm">{sec.title}</h5>
                                <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-bold uppercase">
                                  {sec.type}
                                </span>
                                <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                                  الموضع: {sec.position === 'top' ? 'أعلى الصفحة' : sec.position === 'middle' ? 'وسط الصفحة' : 'أسفل الصفحة'}
                                </span>
                              </div>
                              {sec.subtitle && (
                                <p className="text-xs text-neutral-500 line-clamp-1">{sec.subtitle}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Toggle Enabled */}
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sec.enabled}
                                onChange={() => handleToggleCustomSection(sec.id)}
                                className="sr-only peer"
                              />
                              <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomSection(sec.id)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="حذف السكشن"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nested Modal: Add New Custom Section */}
                  {showNewSectionModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
                      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                          <h4 className="font-black text-neutral-950 text-base">إنشاء سكشن جديد مخصص</h4>
                          <button
                            type="button"
                            onClick={() => setShowNewSectionModal(false)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="overflow-y-auto p-5 space-y-4 text-xs">
                          <div>
                            <label className="block font-bold text-neutral-700 mb-1">عنوان السكشن الرئيسي *</label>
                            <input
                              type="text"
                              required
                              value={newSecTitle}
                              onChange={(e) => setNewSecTitle(e.target.value)}
                              placeholder="مثال: مميزات الشحن والتوصيل السريع"
                              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-bold focus:bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">وصف السكشن (اختياري)</label>
                              <input
                                type="text"
                                value={newSecSubtitle}
                                onChange={(e) => setNewSecSubtitle(e.target.value)}
                                placeholder="شرح تفصيلي لما يقدمه السكشن"
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">الوسم المميز (Badge)</label>
                              <input
                                type="text"
                                value={newSecBadge}
                                onChange={(e) => setNewSecBadge(e.target.value)}
                                placeholder="مثال: عرض خاص / ضمان 100%"
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">نوع السكشن</label>
                              <select
                                value={newSecType}
                                onChange={(e) => setNewSecType(e.target.value as any)}
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                              >
                                <option value="cards">كروت مميزات (Cards)</option>
                                <option value="banner">بانر عريض (Banner)</option>
                                <option value="text">نص وإرشادات (Text)</option>
                                <option value="faq">أسئلة شائعة (FAQ)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">موضع السكشن</label>
                              <select
                                value={newSecPosition}
                                onChange={(e) => setNewSecPosition(e.target.value as any)}
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                              >
                                <option value="top">أعلى الصفحة (تحت الـ Hero)</option>
                                <option value="middle">وسط الصفحة</option>
                                <option value="bottom">أسفل الصفحة</option>
                              </select>
                            </div>

                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">لون السكشن (Theme)</label>
                              <select
                                value={newSecTheme}
                                onChange={(e) => setNewSecTheme(e.target.value as any)}
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-bold"
                              >
                                <option value="purple">بنفسجي (Purple)</option>
                                <option value="amber">عنبري (Amber)</option>
                                <option value="emerald">زمردي (Emerald)</option>
                                <option value="glass">زجاجي ناعم (Glass)</option>
                                <option value="dark">داكن فخم (Dark)</option>
                              </select>
                            </div>
                          </div>

                          {/* Dynamic Content by Type */}
                          {newSecType === 'cards' && (
                            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-neutral-900">كروت السكشن ({newSecCards.length})</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={cardTitle}
                                  onChange={(e) => setCardTitle(e.target.value)}
                                  placeholder="عنوان الكارت"
                                  className="px-3 py-2 bg-white border border-neutral-200 rounded-xl font-bold"
                                />
                                <input
                                  type="text"
                                  value={cardDesc}
                                  onChange={(e) => setCardDesc(e.target.value)}
                                  placeholder="وصف الكارت"
                                  className="px-3 py-2 bg-white border border-neutral-200 rounded-xl"
                                />
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={cardIcon}
                                    onChange={(e) => setCardIcon(e.target.value)}
                                    className="px-2 py-2 bg-white border border-neutral-200 rounded-xl font-bold flex-1"
                                  >
                                    <option value="ShieldCheck">درع أمان</option>
                                    <option value="Truck">شاحنة شحن</option>
                                    <option value="CreditCard">بطاقة دفع</option>
                                    <option value="Sparkles">بريق ونجوم</option>
                                    <option value="Heart">قلب ومفضلة</option>
                                    <option value="Clock">ساعة وسرعة</option>
                                    <option value="HelpCircle">سؤال واستفسار</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={handleAddCardToNewSection}
                                    className="px-3 py-2 bg-purple-600 text-white rounded-xl font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {newSecCards.length > 0 && (
                                <div className="space-y-1.5 pt-2">
                                  {newSecCards.map((c) => (
                                    <div
                                      key={c.id}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg border text-xs"
                                    >
                                      <div>
                                        <span className="font-bold text-neutral-900">{c.title}: </span>
                                        <span className="text-neutral-500">{c.desc}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCard(c.id)}
                                        className="text-rose-500 hover:text-rose-700 font-bold px-1"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {newSecType !== 'cards' && (
                            <div>
                              <label className="block font-bold text-neutral-700 mb-1">
                                {newSecType === 'faq'
                                  ? 'الأسئلة والأجوبة (اكتب السؤال في سطر، والجواب في السطر التالي، واترك سطر فارغ بين كل سؤال)'
                                  : 'محتوى السكشن (نص المقال أو رسالة البانر)'}
                              </label>
                              <textarea
                                rows={4}
                                value={newSecContent}
                                onChange={(e) => setNewSecContent(e.target.value)}
                                placeholder={
                                  newSecType === 'faq'
                                    ? 'س: كم تستغرق مدة الشحن إلى مصر؟\nج: تستغرق الشحنة من ٧ إلى ١٠ أيام عمل.\n\nس: هل يمكن الدفع عند الاستلام؟\nج: نوفر الدفع المسبق الآمن بالجنيه عبر إنستاباي وفودافون كاش.'
                                    : 'اكتب تفاصيل ومحتوى هذا السكشن هنا...'
                                }
                                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white font-mono text-xs"
                              />
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-neutral-100 flex items-center justify-end gap-2 border-t">
                          <button
                            type="button"
                            onClick={() => setShowNewSectionModal(false)}
                            className="px-4 py-2 font-bold text-neutral-500"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={handleAddCustomSection}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl cursor-pointer"
                          >
                            إضافة السكشن للقائمة
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between gap-3 pt-5 border-t border-neutral-200 mt-6 sticky bottom-0 bg-white/95 backdrop-blur-md py-3">
                <div className="text-[11px] text-neutral-500">
                  سيتم تطبيق التعديلات فورياً على جميع صفحات وزوار الموقع عند الحفظ.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="px-5 py-2.5 font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-7 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 disabled:opacity-50 text-white font-black rounded-xl shadow-md shadow-purple-500/25 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {savingSettings ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <span>حفظ جميع الإعدادات والتعديلات</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultRole="admin" />
    </div>
  );
}

/* ─────────────── Status Badge Component ─────────────── */
function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING_APPROVAL: {
      label: 'Pending Review',
      className: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
      icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    },
    APPROVED_PENDING_PAYMENT: {
      label: 'Awaiting Payment',
      className: 'bg-blue-100 text-blue-900 border-blue-200',
      icon: <CreditCard className="w-3.5 h-3.5 text-blue-600" />,
    },
    PAYMENT_UNDER_REVIEW: {
      label: 'Verify Receipt',
      className: 'bg-purple-100 text-purple-900 border-purple-300',
      icon: <FileCheck className="w-3.5 h-3.5 text-purple-600" />,
    },
    PAID: {
      label: 'Paid & Processing',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    PROCESSING: {
      label: 'Processing',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    SHIPPED: {
      label: 'Shipped',
      className: 'bg-sky-100 text-sky-900 border-sky-300',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />,
    },
    DELIVERED: {
      label: 'تم التوصيل للعميل (Delivered)',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    COMPLETED: {
      label: 'Delivered (مكتمل)',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    CANCELLED: {
      label: 'ملغي (Cancelled)',
      className: 'bg-rose-100 text-rose-900 border-rose-300 font-black',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-rose-100 text-rose-900 border-rose-300',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
    },
  };

  const cfg = map[status] ?? map.PENDING_APPROVAL;

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black border ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
