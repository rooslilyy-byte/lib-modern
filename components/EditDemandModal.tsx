'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';
import ProductAutocomplete from './ProductAutocomplete';

interface EditDemandModalProps {
  demand: ClientDemand;
  masterProducts: MasterProduct[];
  onClose: () => void;
  onSave: (
    demandId: string,
    clientName: string,
    clientPhone: string,
    items: {
      id?: string;
      product_name: string;
      quantity: number;
      is_in_stock?: boolean;
      is_delivered?: boolean;
    }[],
    avanceAmount?: number,
    totalAmount?: number
  ) => Promise<void>;
}

export default function EditDemandModal({
  demand,
  masterProducts,
  onClose,
  onSave,
}: EditDemandModalProps) {
  const { t } = useLanguage();
  const [clientName, setClientName] = useState(demand.client?.name || '');
  const [clientPhone, setClientPhone] = useState(demand.client?.phone || '');
  const [avanceAmount, setAvanceAmount] = useState<string>(
    demand.avance_amount !== undefined && demand.avance_amount > 0 ? String(demand.avance_amount) : ''
  );
  const [totalAmount, setTotalAmount] = useState<string>(
    demand.total_amount !== undefined && demand.total_amount > 0 ? String(demand.total_amount) : ''
  );
  const [items, setItems] = useState<
    {
      id?: string;
      product_name: string;
      quantity: number | string;
      is_in_stock: boolean;
      is_delivered: boolean;
    }[]
  >([]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (demand.items) {
      setItems(
        demand.items.map(it => ({
          id: it.id,
          product_name: it.product_name,
          quantity: it.quantity,
          is_in_stock: it.is_in_stock,
          is_delivered: it.is_delivered,
        }))
      );
    }
    if (demand.avance_amount !== undefined && demand.avance_amount > 0) {
      setAvanceAmount(String(demand.avance_amount));
    }
    if (demand.total_amount !== undefined && demand.total_amount > 0) {
      setTotalAmount(String(demand.total_amount));
    }
  }, [demand]);

  const handlePreventNegativeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
  };

  const handleItemChange = (
    index: number,
    field: 'product_name' | 'quantity' | 'is_in_stock' | 'is_delivered',
    value: any
  ) => {
    if (field === 'product_name' && typeof value === 'string' && value.trim()) {
      const trimmedLower = value.trim().toLowerCase();
      const isDuplicate = items.some(
        (it, idx) => idx !== index && it.product_name.trim().toLowerCase() === trimmedLower
      );
      if (isDuplicate) {
        setErrorMessage(`الكتاب "${value.trim()}" مختار بالفعل في سطر آخر. يرجى زيادة العدد (+/-) في السطر الحالي.`);
        return;
      }
    }
    const newItems = [...items];
    const updated = { ...newItems[index], [field]: value };

    if (field === 'is_delivered' && value === true) {
      updated.is_in_stock = true;
    }
    if (field === 'is_in_stock' && value === false) {
      updated.is_delivered = false;
    }

    newItems[index] = updated;
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_name: '',
        quantity: 1,
        is_in_stock: false,
        is_delivered: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage('يجب أن تحتوي الطلبية على عنصر واحد على الأقل');
      return;
    }
    setErrorMessage('');
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const itemMap: Record<string, {
      id?: string;
      product_name: string;
      quantity: number;
      is_in_stock: boolean;
      is_delivered: boolean;
    }> = {};

    for (const item of items) {
      const name = item.product_name.trim();
      if (!name) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (!itemMap[name]) {
        itemMap[name] = { ...item, product_name: name, quantity: qty };
      } else {
        itemMap[name].quantity += qty;
        itemMap[name].is_in_stock = itemMap[name].is_in_stock || item.is_in_stock;
        itemMap[name].is_delivered = itemMap[name].is_delivered || item.is_delivered;
      }
    }
    const validItems = Object.values(itemMap);

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage('يرجى ملء اسم الزبون ورقم الهاتف');
      return;
    }

    if (validItems.length === 0) {
      setErrorMessage('يرجى إضافة كتاب أو مستلزم واحد على الأقل');
      return;
    }

    const numAvance = avanceAmount !== '' ? Math.max(0, parseFloat(avanceAmount) || 0) : undefined;
    const numTotal = totalAmount !== '' ? Math.max(0, parseFloat(totalAmount) || 0) : undefined;

    setIsSaving(true);
    try {
      await onSave(
        demand.id,
        clientName.trim(),
        clientPhone.trim(),
        validItems,
        numAvance,
        numTotal
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving demand:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 font-cairo dir-rtl">
      <div className="bg-white/95 backdrop-blur-md border border-neutral-200/80 text-neutral-900 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        
        {/* Header with Custom White Logo */}
        <div className="bg-white border-b border-neutral-100 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-lib-modern.jpg"
              alt="Lib Moderne"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 truncate">تعديل الطلب والخصاص</h3>
              <p className="text-xs text-neutral-400 font-medium">تعديل معلومات الزبون وحالة المستلزمات</p>
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

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Customer info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-700" />
                <span>اسم الزبون:</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-medium text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-orange-700" />
                <span>رقم الهاتف:</span>
              </label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-medium text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono dir-ltr text-right"
              />
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-neutral-700">
                قائمة الكتب والمستلزمات:
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-800 hover:text-orange-700 bg-neutral-100 hover:bg-neutral-200 px-2.5 sm:px-3 py-1 rounded-full transition-colors"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>إضافة مادة</span>
              </button>
            </div>

            <div className="space-y-2 sm:space-y-2.5">
              {items.map((item, idx) => (
                <div key={idx} className="bg-neutral-50/80 border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 space-y-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex-1">
                      <ProductAutocomplete
                        value={item.product_name}
                        onChange={(val) => handleItemChange(idx, 'product_name', val)}
                        masterProducts={masterProducts}
                        placeholder="اسم الكتاب أو المادة..."
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
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 sm:p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>

                  {/* Status checks */}
                  <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-bold text-neutral-700 pt-1 border-t border-neutral-200/50">
                    <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_in_stock}
                        onChange={(e) => handleItemChange(idx, 'is_in_stock', e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                      <span>متوفر بالمتجر</span>
                    </label>

                    <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_delivered}
                        onChange={(e) => handleItemChange(idx, 'is_delivered', e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <span>تم التسليم للزبون</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
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

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5 pt-3 sm:pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold bg-neutral-900 hover:bg-black text-white rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 flex items-center gap-1.5 sm:gap-2"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
              <span>{isSaving ? 'جاري الحفظ...' : t('common.save')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
