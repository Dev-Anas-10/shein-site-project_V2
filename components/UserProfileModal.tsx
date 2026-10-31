'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useThemeLang } from '@/lib/theme-lang-context';
import {
  X,
  User as UserIcon,
  Phone,
  MapPin,
  Building,
  Mail,
  CheckCircle2,
  Save,
  LogOut,
  ShoppingBag,
  Headphones,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const EGYPT_GOVERNORATES = [
  'القاهرة (Cairo)',
  'الجيزة (Giza)',
  'الإسكندرية (Alexandria)',
  'القليوبية (Qalyubia)',
  'الشرقية (Sharqia)',
  'الدقهلية - المنصورة (Dakahlia)',
  'الغربية - طنطا (Gharbia)',
  'المنوفية (Monufia)',
  'دمياط (Damietta)',
  'بورسعيد (Port Said)',
  'الإسماعيلية (Ismailia)',
  'السويس (Suez)',
  'كفر الشيخ (Kafr El Sheikh)',
  'البحيرة (Beheira)',
  'الفيوم (Fayoum)',
  'بني سويف (Beni Suef)',
  'المنيا (Minya)',
  'أسيوط (Asyut)',
  'سوهاج (Sohag)',
  'قنا (Qena)',
  'الأقصر (Luxor)',
  'أسوان (Aswan)',
  'البحر الأحمر - الغردقة (Red Sea)',
  'جنوب سيناء - شرم الشيخ (South Sinai)',
  'مرسى مطروح (Matrouh)',
];

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  onOpenSupport,
}: UserProfileModalProps) {
  const { user, updateUser, logout } = useAuth();
  const { dir } = useThemeLang();
  const isRtl = dir === 'rtl';

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || '');
  const [address, setAddress] = useState(user?.address || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or user updates
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setCity(user.city || '');
      setAddress(user.address || '');
      setSaveSuccess(false);
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage(isRtl ? 'يرجى إدخال اسم العميل.' : 'Please enter your name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const ok = await updateUser({
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
      });

      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(isRtl ? 'حدث خطأ أثناء حفظ البيانات.' : 'Error saving profile.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative z-10 w-full max-w-lg bg-white dark:bg-[#120f1d] rounded-[32px] border border-neutral-200/80 dark:border-[#2a243a] shadow-2xl p-6 sm:p-7 space-y-6 text-neutral-900 dark:text-white my-auto overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-[#1e192c]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={
                    user?.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`
                  }
                  alt={user?.name || 'User'}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#8B5CF6]/50 shadow-sm"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#120f1d]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                    {user?.name || (isRtl ? 'بيانات الحساب' : 'Account Profile')}
                  </h3>
                  {user?.role === 'admin' ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-800">
                      Admin
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      {isRtl ? 'عميل معتمد' : 'Verified'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#1c172a] hover:bg-neutral-200 dark:hover:bg-[#28213b] text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Auto-fill Tip Banner */}
            <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
              <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? 'يتم استخدام هذه البيانات تلقائياً عند استخراج أي سلة لملء بيانات الشحن وتأكيد طلبك بضغطة واحدة دون إعادة كتابتها.'
                  : 'These details are automatically auto-filled during checkout to save your time on every order.'}
              </span>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{isRtl ? 'الاسم بالكامل' : 'Full Name'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isRtl ? 'اكتب اسمك الثلاثي أو الثنائي' : 'Your full name'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#181325] border border-neutral-200 dark:border-[#2e2642] focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 text-xs font-medium outline-hidden transition-all text-neutral-900 dark:text-white"
              />
            </div>

            {/* Phone & Governorate (Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>{isRtl ? 'رقم الموبايل (واتساب)' : 'Mobile / WhatsApp'}</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#181325] border border-neutral-200 dark:border-[#2e2642] focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 text-xs font-medium font-mono outline-hidden transition-all text-neutral-900 dark:text-white"
                />
              </div>

              {/* City / Governorate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>{isRtl ? 'المحافظة / المدينة' : 'City / Governorate'}</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#181325] border border-neutral-200 dark:border-[#2e2642] focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 text-xs font-medium outline-hidden transition-all text-neutral-900 dark:text-white cursor-pointer"
                >
                  <option value="">{isRtl ? '— اختاري المحافظة —' : 'Select Governorate'}</option>
                  {EGYPT_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{isRtl ? 'عنوان التوصيل بالتفصيل' : 'Detailed Shipping Address'}</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  isRtl
                    ? 'المنطقة، اسم الشارع، رقم العمارة، رقم الشقة، علامة مميزة...'
                    : 'Street name, building number, apartment, landmark...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#181325] border border-neutral-200 dark:border-[#2e2642] focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20 text-xs font-medium outline-hidden transition-all text-neutral-900 dark:text-white resize-none"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
                {errorMessage}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-xs font-black shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{isRtl ? 'تم الحفظ بنجاح ✓' : 'Saved Successfully!'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {isSaving
                        ? isRtl
                          ? 'جاري الحفظ...'
                          : 'Saving...'
                        : isRtl
                        ? 'حفظ وتحديث البيانات'
                        : 'Save Changes'}
                    </span>
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-neutral-100 dark:bg-[#1c172a] hover:bg-neutral-200 dark:hover:bg-[#28213b] text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </form>

          {/* Quick Footer Links */}
          <div className="pt-3 border-t border-neutral-100 dark:border-[#1e192c] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Link
                href="/orders"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#181325] hover:bg-purple-50 dark:hover:bg-[#221c32] text-neutral-700 dark:text-neutral-300 font-bold border border-neutral-200/60 dark:border-[#2e2642] transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{isRtl ? 'طلباتي' : 'My Orders'}</span>
              </Link>

              {onOpenSupport && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSupport();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#181325] hover:bg-purple-50 dark:hover:bg-[#221c32] text-neutral-700 dark:text-neutral-300 font-bold border border-neutral-200/60 dark:border-[#2e2642] transition-colors cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>{isRtl ? 'الدعم الفني' : 'Support'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
