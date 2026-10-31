'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Shipment, Order, ShipmentStatus } from '@/lib/types';
import { toUsableSheinUrl } from '@/lib/shein-links';
import { SafeImage } from '@/components/SafeImage';
import {
  Package,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Search,
  ExternalLink,
  Trash2,
  Edit3,
  Calendar,
  X,
  Check,
  ChevronRight,
  Boxes,
  Info,
  CreditCard,
  Filter,
} from 'lucide-react';

interface ShipmentsManagerProps {
  shipments: Shipment[];
  orders: Order[];
  onRefresh: () => void;
  onAssignOrders: (shipmentId: string, orderIds: string[]) => Promise<void>;
  onRemoveOrders: (shipmentId: string, orderIds: string[]) => Promise<void>;
  onExportManifest: (shipment: Shipment) => void;
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const SHIPMENT_STATUS_MAP: Record<
  ShipmentStatus,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  PREPARING: {
    label: 'قيد التجهيز والتجميع',
    color: 'text-amber-800 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    border: 'border-amber-300 dark:border-amber-800',
    icon: Clock,
  },
  PURCHASED: {
    label: 'تم الشراء من شي إن',
    color: 'text-blue-800 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    border: 'border-blue-300 dark:border-blue-800',
    icon: CheckCircle2,
  },
  IN_TRANSIT: {
    label: 'في الشحن الدولي لمصر',
    color: 'text-purple-800 dark:text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    border: 'border-purple-300 dark:border-purple-800',
    icon: Truck,
  },
  CUSTOMS: {
    label: 'في التخليص الجمركي',
    color: 'text-orange-800 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    border: 'border-orange-300 dark:border-orange-800',
    icon: AlertCircle,
  },
  ARRIVED_LOCAL: {
    label: 'وصلت المخزن بمصر',
    color: 'text-teal-800 dark:text-teal-300',
    bg: 'bg-teal-100 dark:bg-teal-950/60',
    border: 'border-teal-300 dark:border-teal-800',
    icon: Boxes,
  },
  OUT_FOR_DELIVERY: {
    label: 'جاري التوزيع الداخلي',
    color: 'text-cyan-800 dark:text-cyan-300',
    bg: 'bg-cyan-100 dark:bg-cyan-950/60',
    border: 'border-cyan-300 dark:border-cyan-800',
    icon: Truck,
  },
  COMPLETED: {
    label: 'مكتملة ومسلمة للعملاء',
    color: 'text-emerald-800 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    border: 'border-emerald-300 dark:border-emerald-800',
    icon: CheckCircle2,
  },
};

/**
 * Checks if an order is verified as PAID in the system.
 */
export const isOrderPaid = (o: Order): boolean => {
  return (
    o.status === 'PAID' ||
    o.status === 'PROCESSING' ||
    o.status === 'SHIPPED' ||
    o.status === 'DELIVERED' ||
    o.status === 'COMPLETED' ||
    Boolean(o.payment && (o.payment.method || o.payment.transactionReference))
  );
};

/**
 * Checks if a shipment is Paid according to the actual payment statuses recorded in the system.
 */
export const isShipmentPaid = (shipment: Shipment, allOrders: Order[]): boolean => {
  if (shipment.paymentStatus === 'UNPAID') return false;

  const sOrders = allOrders.filter(
    (o) => o.shipmentId === shipment.id || (shipment.orderIds && shipment.orderIds.includes(o.id))
  );

  // If shipment contains orders, all orders must be paid (no pending approval, rejected or unpaid)
  if (sOrders.length > 0) {
    const hasUnpaid = sOrders.some(
      (o) =>
        o.status === 'PENDING_APPROVAL' ||
        o.status === 'APPROVED_PENDING_PAYMENT' ||
        o.status === 'REJECTED'
    );
    if (hasUnpaid) return false;
    return sOrders.every(isOrderPaid);
  }

  // If shipment has no orders assigned yet, check shipment.paymentStatus (defaults to PAID for new batches)
  return shipment.paymentStatus === 'PAID' || !shipment.paymentStatus;
};

export function ShipmentsManager({
  shipments,
  orders,
  onRefresh,
  onAssignOrders,
  onRemoveOrders,
  onExportManifest,
  addToast,
}: ShipmentsManagerProps) {
  // Local state for instant optimistic updates without waiting for network re-fetch
  const [localShipments, setLocalShipments] = useState<Shipment[]>(shipments);

  // Sync with prop changes while keeping deduplicated
  useEffect(() => {
    const map = new Map<string, Shipment>();
    for (const s of shipments) {
      map.set(s.id, s);
    }
    setLocalShipments(Array.from(map.values()));
  }, [shipments]);

  // Filters: Payment filter (defaults to PAID as requested), Lifecycle status, Search query
  const [paymentFilter, setPaymentFilter] = useState<'PAID' | 'ALL' | 'UNPAID'>('PAID');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedShipmentForDetail, setSelectedShipmentForDetail] = useState<Shipment | null>(null);
  const [selectedShipmentForAddOrders, setSelectedShipmentForAddOrders] = useState<Shipment | null>(null);
  const [selectedShipmentForEdit, setSelectedShipmentForEdit] = useState<Shipment | null>(null);

  // Form states for creation
  const [newCode, setNewCode] = useState('');
  const [newMaxItems, setNewMaxItems] = useState(50);
  const [newMaxOrders, setNewMaxOrders] = useState(15);
  const [newCarrier, setNewCarrier] = useState('Aramex');
  const [newTracking, setNewTracking] = useState('');
  const [newTrackingUrl, setNewTrackingUrl] = useState('');
  const [newEstimatedArrival, setNewEstimatedArrival] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  // Add orders selection state
  const [selectedOrderIdsToAdd, setSelectedOrderIdsToAdd] = useState<string[]>([]);
  const [addingLoading, setAddingLoading] = useState(false);

  // High-performance filtering with useMemo
  const filteredShipments = useMemo(() => {
    return localShipments.filter((s) => {
      // 1. Payment status filter: Exclude unpaid if 'PAID' is selected
      const isPaid = isShipmentPaid(s, orders);
      if (paymentFilter === 'PAID' && !isPaid) return false;
      if (paymentFilter === 'UNPAID' && isPaid) return false;

      // 2. Lifecycle status filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

      // 3. Search query: shipment ID, code, tracking, carrier, notes, or assigned order ID/customer
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = s.id.toLowerCase().includes(q);
        const matchesCode = s.code.toLowerCase().includes(q);
        const matchesTracking = Boolean(s.trackingNumber && s.trackingNumber.toLowerCase().includes(q));
        const matchesCarrier = Boolean(s.carrier && s.carrier.toLowerCase().includes(q));
        const matchesNotes = Boolean(s.notes && s.notes.toLowerCase().includes(q));

        // Check if any order inside matches query
        const sOrders = orders.filter(
          (o) => o.shipmentId === s.id || (s.orderIds && s.orderIds.includes(o.id))
        );
        const matchesInnerOrder = sOrders.some(
          (o) =>
            o.id.toLowerCase().includes(q) ||
            o.userName.toLowerCase().includes(q) ||
            (o.userPhone && o.userPhone.includes(q))
        );

        return matchesId || matchesCode || matchesTracking || matchesCarrier || matchesNotes || matchesInnerOrder;
      }

      return true;
    });
  }, [localShipments, orders, paymentFilter, statusFilter, searchQuery]);

  // Compute metrics across shipments
  const totalShipments = localShipments.length;
  const activeShipments = localShipments.filter((s) => s.status !== 'COMPLETED').length;
  const paidShipmentsCount = useMemo(() => {
    return localShipments.filter((s) => isShipmentPaid(s, orders)).length;
  }, [localShipments, orders]);

  const totalItemsInShipments = useMemo(() => {
    return localShipments.reduce((sum, s) => {
      const sOrders = orders.filter((o) => o.shipmentId === s.id || (s.orderIds && s.orderIds.includes(o.id)));
      return sum + sOrders.reduce((iSum, o) => iSum + (o.itemsCount || o.items?.length || 0), 0);
    }, 0);
  }, [localShipments, orders]);

  const totalValueInShipments = useMemo(() => {
    return localShipments.reduce((sum, s) => {
      const sOrders = orders.filter((o) => o.shipmentId === s.id || (s.orderIds && s.orderIds.includes(o.id)));
      return sum + sOrders.reduce((vSum, o) => vSum + (o.totalCash || 0), 0);
    }, 0);
  }, [localShipments, orders]);

  // Unassigned orders eligible to be added (Strictly PAID orders only!)
  const unassignedPaidOrders = useMemo(() => {
    return orders.filter((o) => !o.shipmentId && isOrderPaid(o));
  }, [orders]);

  const unassignedUnpaidCount = useMemo(() => {
    return orders.filter((o) => !o.shipmentId && !isOrderPaid(o)).length;
  }, [orders]);

  // Handle Create Shipment with immediate optimistic update
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      addToast('error', 'يرجى إدخال كود أو اسم للشحنة');
      return;
    }

    setCreatingLoading(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim(),
          maxItems: Number(newMaxItems) || 50,
          maxOrders: Number(newMaxOrders) || 15,
          carrier: newCarrier.trim() || undefined,
          trackingNumber: newTracking.trim() || undefined,
          trackingUrl: newTrackingUrl.trim() || undefined,
          estimatedArrival: newEstimatedArrival.trim() || undefined,
          notes: newNotes.trim() || undefined,
          status: 'PREPARING',
          paymentStatus: 'PAID', // Newly created batches are paid/ready for paid orders
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل إنشاء الشحنة');

      const createdShipment: Shipment = json.data;

      // Optimistically update local state immediately (0ms UI latency)
      setLocalShipments((prev) => [createdShipment, ...prev.filter((s) => s.id !== createdShipment.id)]);

      addToast('success', `تم إنشاء الشحنة "${createdShipment.code}" (${createdShipment.id}) بنجاح!`);
      setIsCreateOpen(false);
      setNewCode('');
      setNewTracking('');
      setNewTrackingUrl('');
      setNewEstimatedArrival('');
      setNewNotes('');

      // Refresh parent and background DB
      onRefresh();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setCreatingLoading(false);
    }
  };

  // Handle Update Shipment
  const handleUpdateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentForEdit) return;

    try {
      const res = await fetch('/api/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedShipmentForEdit),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل تحديث الشحنة');

      // Optimistic update
      setLocalShipments((prev) =>
        prev.map((s) => (s.id === selectedShipmentForEdit.id ? json.data : s))
      );

      addToast('success', `تم تحديث الشحنة "${selectedShipmentForEdit.code}" بنجاح!`);
      setSelectedShipmentForEdit(null);
      onRefresh();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  // Handle Delete Shipment
  const handleDeleteShipment = async (shipment: Shipment) => {
    if (
      !confirm(
        `هل أنت متأكد من حذف الشحنة "${shipment.code}"؟ سيتم إلغاء إسناد جميع الطلبات التابعة لها.`
      )
    ) {
      return;
    }

    try {
      // Optimistic delete
      setLocalShipments((prev) => prev.filter((s) => s.id !== shipment.id));

      const res = await fetch(`/api/shipments?id=${shipment.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل حذف الشحنة');

      addToast('info', `تم حذف الشحنة "${shipment.code}" بنجاح`);
      onRefresh();
    } catch (err: any) {
      addToast('error', err.message);
      onRefresh(); // revert if failed
    }
  };

  // Handle Submit Add Orders
  const handleSubmitAddOrders = async () => {
    if (!selectedShipmentForAddOrders || selectedOrderIdsToAdd.length === 0) return;
    setAddingLoading(true);
    try {
      await onAssignOrders(selectedShipmentForAddOrders.id, selectedOrderIdsToAdd);
      setSelectedShipmentForAddOrders(null);
      setSelectedOrderIdsToAdd([]);
      onRefresh();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Shipments High-Impact Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 text-xs font-bold mb-2">
            <span>الشحنات المدفوعة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-neutral-950 dark:text-white">
            {paidShipmentsCount}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            من إجمالي {totalShipments} شحنات مسجلة
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 p-5 rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-xs">
          <div className="flex items-center justify-between text-purple-900 dark:text-purple-300 text-xs font-bold mb-2">
            <span>القطع في الشحن</span>
            <Boxes className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
            {totalItemsInShipments}{' '}
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">قطعة</span>
          </div>
          <div className="text-[11px] text-purple-800 dark:text-purple-300 font-bold mt-1">
            موزعة على دفعات
          </div>
        </div>

        <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 text-xs font-bold mb-2">
            <span>إجمالي قيمة الشحنات</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalValueInShipments.toLocaleString()}{' '}
            <span className="text-xs font-bold">ج.م</span>
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
            كافة الطلبات المسندة
          </div>
        </div>

        <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-purple-200 dark:border-purple-900/50 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-800 dark:text-purple-300 text-xs font-bold mb-2">
            <span>طلبات مدفوعة غير مسندة</span>
            <AlertCircle className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="text-3xl font-black text-[#8B5CF6]">
            {unassignedPaidOrders.length}
          </div>
          <div className="text-[11px] text-purple-700 dark:text-purple-300 mt-1">
            جاهزة للتوزيع والإسناد للشحن
          </div>
        </div>
      </div>

      {/* ── TOP CONTROL & DEDICATED SEARCH BAR ── */}
      <div className="bg-white dark:bg-[#14111d] p-5 rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs space-y-4">
        {/* Row 1: Dedicated Search Bar with instant search by Shipment Number/Code */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8B5CF6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث برقم الشحنة (مثال: SHP-...) أو الكود أو رقم الطلب..."
              className="w-full pr-10 pl-9 py-2.5 text-xs font-medium bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] text-neutral-900 dark:text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center text-[10px]"
                title="مسح البحث"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-[#1f192c] px-3 py-1.5 rounded-xl border border-neutral-200/60 dark:border-[#2a243a]">
              عرض <strong className="text-purple-600">{filteredShipments.length}</strong> شحنة
            </span>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-purple-600/25 active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء شحنة جديدة</span>
            </button>
          </div>
        </div>

        {/* Row 2: Payment Status Filter & Lifecycle Status Tabs */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-[#201a2d]">
          {/* Payment Status Switcher (Active = PAID by default) */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100/90 dark:bg-[#1c1729] rounded-2xl border border-neutral-200/80 dark:border-[#2c243c]">
            <button
              type="button"
              onClick={() => setPaymentFilter('PAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                paymentFilter === 'PAID'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>الشحنات المدفوعة فقط (Paid)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                paymentFilter === 'ALL'
                  ? 'bg-neutral-900 dark:bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span>جميع الشحنات</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentFilter('UNPAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                paymentFilter === 'UNPAID'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span>غير المدفوعة</span>
            </button>
          </div>

          {/* Lifecycle Status Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { key: 'ALL', label: 'كل الحالات' },
              { key: 'PREPARING', label: '🟡 تجهيز' },
              { key: 'IN_TRANSIT', label: '🟣 شحن دولي' },
              { key: 'CUSTOMS', label: '🟠 جمارك' },
              { key: 'ARRIVED_LOCAL', label: '🟢 بالمخزن' },
              { key: 'COMPLETED', label: '✓ مكتملة' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-neutral-950 dark:bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#201a2e]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shipments Cards Grid */}
      {filteredShipments.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] space-y-3">
          <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto" />
          <h4 className="font-black text-neutral-950 dark:text-white text-base">
            لا توجد شحنات مطابقة للبحث أو حالة الدفع
          </h4>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            {paymentFilter === 'PAID'
              ? 'يتم حالياً عرض الشحنات المؤكدة والمدفوعة فقط. يمكنك إنشاء شحنة جديدة وتوزيع الطلبات المدفوعة عليها.'
              : 'لم نجد أي شحنة تطابق هذا الرقم أو الكود. اضغط على زر "إنشاء شحنة جديدة".'}
          </p>
          {paymentFilter === 'PAID' && (
            <button
              onClick={() => setPaymentFilter('ALL')}
              className="mt-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-[#201a2e] text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
            >
              عرض جميع الشحنات
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShipments.map((shipment) => {
            const shipmentOrders = orders.filter(
              (o) =>
                o.shipmentId === shipment.id ||
                (shipment.orderIds && shipment.orderIds.includes(o.id))
            );

            const totalItems = shipmentOrders.reduce(
              (sum, o) => sum + (o.itemsCount || o.items?.length || 0),
              0
            );

            const totalEgp = shipmentOrders.reduce((sum, o) => sum + (o.totalCash || 0), 0);
            const maxItems = shipment.maxItems || 50;
            const percentage = Math.min(100, Math.round((totalItems / maxItems) * 100));

            const isFull = totalItems >= maxItems;
            const statusConfig =
              SHIPMENT_STATUS_MAP[shipment.status] || SHIPMENT_STATUS_MAP.PREPARING;
            const StatusIcon = statusConfig.icon;

            const isPaid = isShipmentPaid(shipment, orders);

            return (
              <div
                key={shipment.id}
                className="bg-white dark:bg-[#14111d] rounded-3xl border border-neutral-200/80 dark:border-[#2a243a] shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top */}
                <div className="p-5 space-y-4">
                  {/* Header, ID, Payment Badge & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 px-2 py-0.5 rounded-md font-bold">
                          {shipment.id}
                        </span>

                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            UNPAID
                          </span>
                        )}

                        {isFull && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black px-2 py-0.5 rounded-full border border-rose-200">
                            مكتملة السعة
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-neutral-950 dark:text-white text-base mt-1.5 truncate">
                        {shipment.code}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold border shrink-0 ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/60 dark:border-[#2f2742]">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                        سعة الشحنة (القطع)
                      </span>
                      <span className="font-black text-neutral-900 dark:text-white">
                        {totalItems} / {maxItems} قطعة{' '}
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ({percentage}%)
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full h-2.5 rounded-full bg-neutral-200 dark:bg-[#261f36] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          percentage >= 100
                            ? 'bg-rose-500'
                            : percentage >= 75
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Shipment Info Roster */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/60 dark:border-[#2f2742]">
                      <span className="text-[10px] text-neutral-400 block font-medium">الطلبات المسندة</span>
                      <span className="font-black text-neutral-900 dark:text-white font-mono text-sm">
                        {shipmentOrders.length} طلبات
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-[#181423] border border-neutral-200/60 dark:border-[#2f2742]">
                      <span className="text-[10px] text-neutral-400 block font-medium">إجمالي القيمة</span>
                      <span className="font-black text-emerald-600 font-mono text-sm">
                        {totalEgp.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Tracking & Carrier Info */}
                  {(shipment.carrier || shipment.trackingNumber) && (
                    <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1">
                      <span>
                        الناقل: <strong>{shipment.carrier || 'غير محدد'}</strong>
                      </span>
                      {shipment.trackingNumber && (
                        <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {shipment.trackingNumber}
                        </span>
                      )}
                    </div>
                  )}

                  {shipment.notes && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-[#181423] p-2 rounded-xl line-clamp-1">
                      📝 {shipment.notes}
                    </p>
                  )}
                </div>

                {/* Card Actions Bottom Bar */}
                <div className="p-4 bg-neutral-50/80 dark:bg-[#181423] border-t border-neutral-200/80 dark:border-[#2a243a] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedShipmentForDetail(shipment)}
                      className="px-3 py-1.5 bg-neutral-950 dark:bg-purple-600 hover:bg-neutral-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Users className="w-3 h-3" />
                      <span>كشف الشحنة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onExportManifest(shipment)}
                      className="p-1.5 rounded-xl bg-white dark:bg-[#201a2e] border border-neutral-200 dark:border-[#2f2742] text-neutral-700 dark:text-neutral-300 hover:text-purple-600 transition-colors cursor-pointer"
                      title="تصدير بيان الشحنة CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedShipmentForAddOrders(shipment)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      <span>+ إضافة طلبات</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedShipmentForEdit({ ...shipment })}
                      className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-[#261f36] text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
                      title="تعديل الشحنة"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShipment(shipment)}
                      className="p-1.5 rounded-xl hover:bg-rose-100 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="حذف الشحنة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL 1: CREATE NEW SHIPMENT ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#14111d] rounded-3xl shadow-2xl border border-neutral-200 dark:border-[#2a243a] p-6 space-y-5 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-[#241e33]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                <h3 className="font-black text-lg text-neutral-950 dark:text-white">
                  إنشاء دفعة شحن جديدة (New Shipment)
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  كود أو اسم الشحنة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="مثال: شحنة الرياض رقم 12 أو SHP-NOV-01"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    الحد الأقصى للقطع (سعة الشحنة)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newMaxItems}
                    onChange={(e) => setNewMaxItems(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    يمنع تجاوز السعة المحددة
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    أقصى عدد طلبات
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxOrders}
                    onChange={(e) => setNewMaxOrders(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    شركة الشحن الناقلة
                  </label>
                  <input
                    type="text"
                    value={newCarrier}
                    onChange={(e) => setNewCarrier(e.target.value)}
                    placeholder="مثال: Aramex / SMSA / DHL"
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    رقم التتبع الدولي
                  </label>
                  <input
                    type="text"
                    value={newTracking}
                    onChange={(e) => setNewTracking(e.target.value)}
                    placeholder="AWB / Tracking Number"
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  تاريخ الوصول المتوقع إلى مصر
                </label>
                <input
                  type="date"
                  value={newEstimatedArrival}
                  onChange={(e) => setNewEstimatedArrival(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  ملاحظات تنظيمية للمشرف
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="أي تفاصيل خاصة بالجمارك أو الشحن الجوي..."
                  className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-[#241e33]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#201a2e]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
                >
                  {creatingLoading ? 'جاري الإنشاء...' : 'حفظ وإنشاء الشحنة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SHIPMENT MANIFEST & CUSTOMERS ROSTER ── */}
      {selectedShipmentForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#14111d] rounded-3xl shadow-2xl border border-neutral-200 dark:border-[#2a243a] flex flex-col overflow-hidden text-right">
            {/* Modal Header */}
            <div className="p-6 bg-neutral-50 dark:bg-[#181423] border-b border-neutral-200 dark:border-[#2a243a] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md">
                    {selectedShipmentForDetail.id}
                  </span>
                  <h3 className="text-xl font-black text-neutral-950 dark:text-white">
                    بيان وكشف الشحنة: {selectedShipmentForDetail.code}
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  شركة الشحن: <strong>{selectedShipmentForDetail.carrier || 'غير محدد'}</strong> • كود التتبع:{' '}
                  <span className="font-mono text-purple-600">
                    {selectedShipmentForDetail.trackingNumber || 'غير متوفر'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onExportManifest(selectedShipmentForDetail)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير كشف الشحنة CSV</span>
                </button>
                <button
                  onClick={() => setSelectedShipmentForDetail(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Orders List */}
            <div className="p-6 overflow-y-auto space-y-4">
              {(() => {
                const sOrders = orders.filter(
                  (o) =>
                    o.shipmentId === selectedShipmentForDetail.id ||
                    (selectedShipmentForDetail.orderIds &&
                      selectedShipmentForDetail.orderIds.includes(o.id))
                );

                if (sOrders.length === 0) {
                  return (
                    <div className="p-8 text-center text-neutral-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-bold text-sm">هذه الشحنة لا تحتوي على طلبات حالياً.</p>
                      <button
                        onClick={() => {
                          const s = selectedShipmentForDetail;
                          setSelectedShipmentForDetail(null);
                          setSelectedShipmentForAddOrders(s);
                        }}
                        className="mt-3 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl"
                      >
                        إضافة طلبات الآن
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-500 pb-2 border-b border-neutral-100 dark:border-[#241e33]">
                      <span>تفاصيل العملاء والمنتجات في هذا الكشف ({sOrders.length} طلبات):</span>
                      <span>
                        الإجمالي:{' '}
                        {sOrders.reduce((s, o) => s + (o.totalCash || 0), 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="divide-y divide-neutral-100 dark:divide-[#241e33]">
                      {sOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                                #{ord.id}
                              </span>
                              <span className="font-bold text-xs text-neutral-900 dark:text-white">
                                {ord.userName}
                              </span>
                              <span className="text-[11px] font-mono text-neutral-500">
                                📞 {ord.userPhone}
                              </span>
                            </div>

                            {ord.shippingAddress && (
                              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                                📍 {ord.shippingAddress}
                              </p>
                            )}

                            {ord.customerNotes && (
                              <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200/60">
                                📝 ملاحظة العميل: {ord.customerNotes}
                              </p>
                            )}

                            {/* SHEIN Cart Link Button for this Order in Shipment */}
                            {ord.extractedLink && (
                              <div className="pt-0.5">
                                <a
                                  href={toUsableSheinUrl(ord.extractedLink, { shc: ord.cartShareCode, groupId: ord.cartGroupId })}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-[11px] font-black text-purple-700 dark:text-purple-300 transition-colors shadow-xs"
                                  title="فتح سلة شي إن الكاملة للطلب في تبويب جديد (m.shein)"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>فتح سلة شي إن للطلب (m.shein) ↗</span>
                                </a>
                              </div>
                            )}

                            {/* Items Thumbnails & Links (m.shein) */}
                            <div className="flex flex-wrap items-center gap-2 pt-1.5">
                              {ord.items.map((it, idx) => {
                                const itemUrl = toUsableSheinUrl(it.originalUrl, {
                                  goodsId: it.id,
                                  sku: it.sku,
                                  shc: ord.cartShareCode,
                                  groupId: ord.cartGroupId,
                                  cartLandingUrl: ord.extractedLink,
                                });
                                return (
                                  <a
                                    key={idx}
                                    href={itemUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group/item flex items-center gap-2 p-1.5 pr-3 rounded-2xl border border-neutral-200 dark:border-[#2f2742] bg-white dark:bg-[#181423] hover:border-purple-400 dark:hover:border-purple-600 transition-all shadow-xs cursor-pointer"
                                    title={`${it.name} - اضغط لفتح المنتج في شي إن`}
                                  >
                                    <div className="w-9 h-11 rounded-lg overflow-hidden shrink-0 bg-purple-50 dark:bg-purple-950/40">
                                      <SafeImage
                                        src={it.image}
                                        alt={it.name || 'item'}
                                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                                      />
                                    </div>
                                    <div className="text-[11px] text-start max-w-[150px] truncate">
                                      <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate group-hover/item:text-purple-600 transition-colors">
                                        {it.name}
                                      </p>
                                      <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                        {it.size && <span>{it.size}</span>}
                                        {it.size && <span>•</span>}
                                        <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">m.shein ↗</span>
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                              <span className="text-[11px] font-bold text-neutral-500">
                                {ord.items.length} قطع
                              </span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                            <span className="font-black text-sm text-neutral-950 dark:text-white">
                              {ord.totalCash.toLocaleString()} ج.م
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`إزالة الطلب #${ord.id} من الشحنة؟`)) {
                                  await onRemoveOrders(selectedShipmentForDetail.id, [ord.id]);
                                  onRefresh();
                                }
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                              إزالة من الشحنة
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ADD ORDERS TO SHIPMENT (PAID ONLY) ── */}
      {selectedShipmentForAddOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[88vh] bg-white dark:bg-[#14111d] rounded-3xl shadow-2xl border border-neutral-200 dark:border-[#2a243a] flex flex-col overflow-hidden text-right">
            <div className="p-6 bg-neutral-50 dark:bg-[#181423] border-b border-neutral-200 dark:border-[#2a243a] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-neutral-950 dark:text-white">
                  إضافة طلبات إلى الشحنة: {selectedShipmentForAddOrders.code}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  حدد الطلبات المدفوعة غير المسندة لإضافتها ضمن هذه الدفعة.
                </p>
              </div>
              <button
                onClick={() => setSelectedShipmentForAddOrders(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Informative notice if unpaid orders exist */}
            {unassignedUnpaidCount > 0 && (
              <div className="mx-6 mt-4 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-bold flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  ملاحظة: تم استبعاد ({unassignedUnpaidCount}) طلبات غير مدفوعة تلقائياً. تظهر هنا الطلبات المؤكدة والمدفوعة فقط.
                </span>
              </div>
            )}

            <div className="p-6 overflow-y-auto space-y-3">
              {unassignedPaidOrders.length === 0 ? (
                <div className="p-8 text-center text-neutral-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="font-bold text-sm">جميع الطلبات المدفوعة مسندة إلى شحنات بالفعل!</p>
                </div>
              ) : (
                unassignedPaidOrders.map((ord) => {
                  const isSelected = selectedOrderIdsToAdd.includes(ord.id);
                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderIdsToAdd((prev) =>
                          isSelected ? prev.filter((id) => id !== ord.id) : [...prev, ord.id]
                        );
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 shadow-xs'
                          : 'border-neutral-200/80 dark:border-[#2f2742] hover:bg-neutral-50 dark:hover:bg-[#1c1728]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-neutral-900 dark:text-white">
                              #{ord.id}
                            </span>
                            <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                              {ord.userName}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {ord.userPhone}
                            </span>
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md">
                              PAID
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-500 block mt-0.5">
                            {ord.items.length} قطع • {ord.totalCash.toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {ord.items.slice(0, 3).map((it, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-9 rounded-md overflow-hidden border border-neutral-200 dark:border-[#2f2742]"
                          >
                            <SafeImage
                              src={it.image}
                              alt={it.name || 'item'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#181423] border-t border-neutral-200 dark:border-[#2a243a] flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                تم تحديد: {selectedOrderIdsToAdd.length} طلبات
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedShipmentForAddOrders(null)}
                  className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={selectedOrderIdsToAdd.length === 0 || addingLoading}
                  onClick={handleSubmitAddOrders}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  {addingLoading ? 'جاري الإسناد...' : 'تأكيد الإسناد للشحنة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: EDIT SHIPMENT STATUS / DETAILS ── */}
      {selectedShipmentForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#14111d] rounded-3xl shadow-2xl border border-neutral-200 dark:border-[#2a243a] p-6 space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-[#241e33]">
              <h3 className="font-black text-lg text-neutral-950 dark:text-white">
                تعديل بيانات الشحنة: {selectedShipmentForEdit.code}
              </h3>
              <button
                onClick={() => setSelectedShipmentForEdit(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  حالة الشحنة الحالية
                </label>
                <select
                  value={selectedShipmentForEdit.status}
                  onChange={(e) =>
                    setSelectedShipmentForEdit({
                      ...selectedShipmentForEdit,
                      status: e.target.value as ShipmentStatus,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                >
                  <option value="PREPARING">🟡 قيد التجهيز والتجميع</option>
                  <option value="PURCHASED">🔵 تم الشراء من شي إن</option>
                  <option value="IN_TRANSIT">🟣 في الشحن الدولي لمصر</option>
                  <option value="CUSTOMS">🟠 في التخليص الجمركي</option>
                  <option value="ARRIVED_LOCAL">🟢 وصلت المخزن بمصر</option>
                  <option value="OUT_FOR_DELIVERY">🚚 جاري التوزيع الداخلي للعملاء</option>
                  <option value="COMPLETED">✓ مكتملة ومسلمة بالكامل</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  حالة الدفع
                </label>
                <select
                  value={selectedShipmentForEdit.paymentStatus || 'PAID'}
                  onChange={(e) =>
                    setSelectedShipmentForEdit({
                      ...selectedShipmentForEdit,
                      paymentStatus: e.target.value as 'PAID' | 'UNPAID',
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                >
                  <option value="PAID">🟢 مدفوعة بالكامل (Paid)</option>
                  <option value="UNPAID">🟠 غير مدفوعة (Unpaid)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  كود / اسم الشحنة
                </label>
                <input
                  type="text"
                  value={selectedShipmentForEdit.code}
                  onChange={(e) =>
                    setSelectedShipmentForEdit({ ...selectedShipmentForEdit, code: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-bold text-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    شركة الشحن
                  </label>
                  <input
                    type="text"
                    value={selectedShipmentForEdit.carrier || ''}
                    onChange={(e) =>
                      setSelectedShipmentForEdit({ ...selectedShipmentForEdit, carrier: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    رقم التتبع الدولي
                  </label>
                  <input
                    type="text"
                    value={selectedShipmentForEdit.trackingNumber || ''}
                    onChange={(e) =>
                      setSelectedShipmentForEdit({
                        ...selectedShipmentForEdit,
                        trackingNumber: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs font-mono text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  ملاحظات المشرف
                </label>
                <textarea
                  rows={2}
                  value={selectedShipmentForEdit.notes || ''}
                  onChange={(e) =>
                    setSelectedShipmentForEdit({ ...selectedShipmentForEdit, notes: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-[#1a1626] border border-neutral-200 dark:border-[#2f2742] rounded-xl text-xs text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-[#241e33]">
                <button
                  type="button"
                  onClick={() => setSelectedShipmentForEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-sm"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
