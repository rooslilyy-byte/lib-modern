'use client';

import React, { useState, useCallback } from 'react';
import { User, Phone, Plus, Trash2, X, CheckCircle2 } from 'lucide-react';
import { MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';
import ProductAutocomplete from './ProductAutocomplete';

interface CreateDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterProducts?: MasterProduct[];
  onCreateDemand: (
    clientName: string, 
    clientPhone: string, 
    items: { product_name: string; quantity: number }[],
    avanceAmount?: number,
    totalAmount?: number
  ) => Promise<void>;
}

function CreateDemandModal({
  isOpen,
  onClose,
  masterProducts = [],
  onCreateDemand,
}: CreateDemandModalProps) {
  const { t } = useLanguage();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [avanceAmount, setAvanceAmount] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [items, setItems] = useState<{ product_name: string; quantity: number | string }[]>([
    { product_name: '', quantity: 1 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePreventNegativeKey = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
  }, []);

  const handleItemChange = React.useCallback((index: number, field: 'product_name' | 'quantity', value: any) => {
    if (field === 'product_name' && typeof value === 'string' && value.trim()) {
      const trimmedLower = value.trim().toLowerCase();
      setItems(prev => {
        const isDuplicate = prev.some(
          (it, idx) => idx !== index && it.product_name.trim().toLowerCase() === trimmedLower
        );
        if (isDuplicate) {
          alert(`الكتاب "${value.trim()}" مختار بالفعل في سطر آخر. يرجى زيادة العدد (+/-) في السطر الحالي.`);
          return prev;
        }
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], [field]: value };
        return newItems;
      });
      return;
    }
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  }, []);

  const handleAddItemRow = React.useCallback(() => {
    setItems(prev => [...prev, { product_name: '', quantity: 1 }]);
  }, []);

  const handleRemoveItemRow = React.useCallback((index: number) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) return;

    // Check duplicate
    const nameCounts: Record<string, number> = {};
    for (const item of items) {
      const name = item.product_name.trim().toLowerCase();
      if (!name) continue;
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }

    const duplicateNames = Object.keys(nameCounts).filter(name => nameCounts[name] > 1);
    if (duplicateNames.length > 0) {
      const rawDupName = items.find(i => i.product_name.trim().toLowerCase() === duplicateNames[0])?.product_name || duplicateNames[0];
      alert(`الكتاب "${rawDupName}" مكرر في عدة أسطر. يرجى تعديل العدد (+/-) في السطر الحالي.`);
      return;
    }

    // Deduplicate items
    const itemMap: Record<string, number> = {};
    for (const item of items) {
      const name = item.product_name.trim();
      if (!name) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      itemMap[name] = (itemMap[name] || 0) + qty;
    }

    const validItems = Object.entries(itemMap).map(([product_name, quantity]) => ({
      product_name,
      quantity,
    }));

    if (validItems.length === 0) {
      alert('يرجى إضافة كتاب أو مستلزم واحداً على الأقل للطلب.');
      return;
    }

    const numAvance = avanceAmount !== '' ? Math.max(0, parseFloat(avanceAmount) || 0) : undefined;
    const numTotal = totalAmount !== '' ? Math.max(0, parseFloat(totalAmount) || 0) : undefined;

    setIsSubmitting(true);
    try {
      await onCreateDemand(clientName.trim(), clientPhone.trim(), validItems, numAvance, numTotal);

      setToastMessage('تمت إضافة الزبون والطلب بنجاح');
      setTimeout(() => {
        setToastMessage(null);
        setClientName('');
        setClientPhone('');
        setAvanceAmount('');
        setTotalAmount('');
        setItems([{ product_name: '', quantity: 1 }]);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error creating demand:', err);
      alert('حدث خطأ أثناء حفظ الطلب.');
    } finally {
      setIsSubmitting(false);
    }
  }, [clientName, clientPhone, items, avanceAmount, totalAmount, onCreateDemand, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white font-bold text-sm px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top duration-200 border border-neutral-700">
          <CheckCircle2 className="w-5 h-5 text-orange-700" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-md border border-neutral-200/80 rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 text-right relative animate-in zoom-in-95 duration-200">
        
        {/* Header with Custom White Logo */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-lib-modern.jpg"
              alt="Lib Moderne"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div>
              <h2 className="font-black text-neutral-900 text-sm sm:text-base">إضافة زبون وطلب جديد</h2>
              <p className="text-xs text-neutral-400 font-medium">تسجيل تفاصيل الزبون والخصاص المدرسي</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          
          {/* Client Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-700" />
                <span>اسم الزبون</span>
              </label>
              <input
                type="text"
                required
                placeholder="اسم الزبون الكامل..."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-medium text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-orange-700" />
                <span>رقم الهاتف (الواتساب)</span>
              </label>
              <input
                type="tel"
                required
                placeholder="0661234567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-medium text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono dir-ltr text-right"
              />
            </div>
          </div>

          {/* Missing Items List Sub-section */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-neutral-700">
              قائمة خصاص الكتب والمستلزمات
            </label>

            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex-1">
                  <ProductAutocomplete
                    value={item.product_name}
                    onChange={(val) => handleItemChange(idx, 'product_name', val)}
                    masterProducts={masterProducts}
                    placeholder="ابحث أو اكتب اسم الكتاب..."
                    required
                  />
                </div>

                <div className="w-16 sm:w-20">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                    value={item.quantity || ''}
                    onKeyDown={handlePreventNegativeKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleItemChange(idx, 'quantity', val === '' ? '' : Math.max(1, parseInt(val) || 1));
                    }}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-1.5 sm:px-2 py-1.5 text-center text-xs font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 h-8 sm:h-9"
                  />
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="p-1.5 sm:p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItemRow}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-800 hover:text-orange-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full transition-colors mt-0.5"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>إضافة كتاب آخر</span>
            </button>
          </div>

          {/* Financials / Avance Section */}
          <div className="pt-2 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center justify-between">
                <span>التسبيق (Avance):</span>
                <span className="text-[10px] text-neutral-400 font-normal">درهم (DH)</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={avanceAmount}
                onKeyDown={handlePreventNegativeKey}
                onChange={(e) => setAvanceAmount(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center justify-between">
                <span>المبلغ الإجمالي (Total):</span>
                <span className="text-[10px] text-neutral-400 font-normal">اختياري (DH)</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={totalAmount}
                onKeyDown={handlePreventNegativeKey}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono"
              />
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold bg-neutral-900 hover:bg-black text-white rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 flex items-center gap-1.5 sm:gap-2"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
              <span>{isSubmitting ? 'جاري الحفظ...' : t('common.save')}</span>
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

export default React.memo(CreateDemandModal);
