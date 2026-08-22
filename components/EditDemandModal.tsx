'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit3, 
  User, 
  Phone, 
  Plus, 
  Trash2, 
  Minus, 
  Save, 
  CheckSquare, 
  Square,
  CheckCircle2,
  PackageCheck,
  AlertCircle
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
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
    }[]
  ) => Promise<void>;
}

export default function EditDemandModal({
  demand,
  masterProducts,
  onClose,
  onSave,
}: EditDemandModalProps) {
  const [clientName, setClientName] = useState(demand.client?.name || '');
  const [clientPhone, setClientPhone] = useState(demand.client?.phone || '');
  const [items, setItems] = useState<
    {
      id?: string;
      product_name: string;
      quantity: number;
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
  }, [demand]);

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

    // Auto logic: if delivered, set in_stock = true
    if (field === 'is_delivered' && value === true) {
      updated.is_in_stock = true;
    }
    // If not in stock, cannot be delivered
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

    // Pre-submit validation check for duplicates
    const nameCounts: Record<string, number> = {};
    for (const item of items) {
      const name = item.product_name.trim().toLowerCase();
      if (!name) continue;
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }

    const duplicateNames = Object.keys(nameCounts).filter(name => nameCounts[name] > 1);
    if (duplicateNames.length > 0) {
      const rawDupName = items.find(i => i.product_name.trim().toLowerCase() === duplicateNames[0])?.product_name || duplicateNames[0];
      setErrorMessage(`الكتاب "${rawDupName}" مكرر في عدة أسطر. يرجى تعديل العدد (+/-) في السطر الحالي بدلاً من إضافة سطر مكرر.`);
      return;
    }

    // Deduplicate items: combine quantities for identical product titles
    const itemMap: Record<string, typeof items[0]> = {};
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

    setIsSaving(true);
    try {
      await onSave(
        demand.id,
        clientName.trim(),
        clientPhone.trim(),
        validItems
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 font-cairo dir-rtl">
      <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-3.5 sm:p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">تعديل الطلب</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-bold">
              {errorMessage}
            </div>
          )}

          {/* Client Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-600" />
              <span>معلومات الزبون</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الزبون الكامل:</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800 font-medium min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800 font-mono dir-ltr text-right min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                قائمة الكتب والمستلزمات المطلوبة:
              </label>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                عدد العناصر: {items.length}
              </span>
            </div>

            {items.map((item, idx) => {
              const selectedOtherNames = items
                .filter((_, i) => i !== idx)
                .map(it => it.product_name.trim().toLowerCase())
                .filter(Boolean);

              const availableProducts = masterProducts.filter(
                p => !selectedOtherNames.includes(p.name.trim().toLowerCase())
              );

              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    
                    {/* Product Name Autocomplete */}
                    <div className="flex-1 relative">
                      <ProductAutocomplete
                        required
                        value={item.product_name}
                        onChange={(val) => handleItemChange(idx, 'product_name', val)}
                        masterProducts={availableProducts}
                        placeholder="اسم الكتاب أو المستلزم..."
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      {/* Quantity Stepper */}
                      <div className="w-32 flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shrink-0 min-h-[44px]">
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, 'quantity', Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40 transition-opacity"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onKeyDown={(e) => {
                            if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-center text-sm font-black text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, 'quantity', Math.max(1, item.quantity + 1))}
                          className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Delete Item Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center border border-rose-200 sm:border-0 bg-white sm:bg-transparent"
                        title="حذف هذا الكتاب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* State Toggles (In Stock / Delivered) */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/60 text-xs font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 min-h-[40px] px-1">
                      <input
                        type="checkbox"
                        checked={item.is_in_stock}
                        onChange={(e) => handleItemChange(idx, 'is_in_stock', e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-5 h-5"
                      />
                      <span>متوفر بالمتجر</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 min-h-[40px] px-1">
                      <input
                        type="checkbox"
                        checked={item.is_delivered}
                        onChange={(e) => handleItemChange(idx, 'is_delivered', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                      />
                      <span>تم التسليم للزبون</span>
                    </label>
                  </div>

                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-dashed border-slate-300 transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة كتاب أو مستلزم جديد للطلب</span>
            </button>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-3 flex items-center justify-end gap-2.5 z-10 -mx-4 -mb-4 p-3.5 shadow-md">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg transition-colors border border-slate-200"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
