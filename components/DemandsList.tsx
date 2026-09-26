'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Trash2, 
  Search, 
  Printer, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Phone, 
  BookOpen,
  CheckSquare,
  Square,
  Minus,
  Edit
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import ThermalReceiptModal from './ThermalReceiptModal';
import EditDemandModal from './EditDemandModal';
import ProductAutocomplete from './ProductAutocomplete';

interface DemandsListProps {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onCreateDemand: (
    clientName: string, 
    clientPhone: string, 
    items: { product_name: string; quantity: number }[],
    avanceAmount?: number,
    totalAmount?: number
  ) => Promise<void>;
  onUpdateDemand: (
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
  onUpdateItemState: (
    itemId: string, 
    updates: { is_in_stock?: boolean; is_delivered?: boolean }
  ) => Promise<void>;
  onDeleteDemand: (demandId: string) => Promise<void>;
  initialSearchQuery?: string;
}

function DemandsList({
  demands,
  masterProducts,
  onCreateDemand,
  onUpdateDemand,
  onUpdateItemState,
  onDeleteDemand,
  initialSearchQuery = '',
}: DemandsListProps) {
  // Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [avanceAmount, setAvanceAmount] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [items, setItems] = useState<{ product_name: string; quantity: number | string }[]>([
    { product_name: '', quantity: 1 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'completed'>('all');
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);

  // Modals
  const [selectedPrintDemand, setSelectedPrintDemand] = useState<ClientDemand | null>(null);
  const [editingDemand, setEditingDemand] = useState<ClientDemand | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const handlePreventNegativeKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
  }, []);

  const stats = useMemo(() => {
    let pending = 0;
    let partial = 0;
    let completed = 0;
    for (let i = 0; i < demands.length; i++) {
      const s = demands[i].status;
      if (s === 'pending') pending++;
      else if (s === 'partial') partial++;
      else if (s === 'completed') completed++;
    }
    return { total: demands.length, pending, partial, completed };
  }, [demands]);

  const handleItemChange = useCallback((index: number, field: 'product_name' | 'quantity', value: any) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  }, []);

  const handleAddItemRow = useCallback(() => {
    setItems(prev => [...prev, { product_name: '', quantity: 1 }]);
  }, []);

  const handleRemoveItemRow = useCallback((index: number) => {
    setItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items
      .filter(i => i.product_name.trim().length > 0)
      .map(i => ({
        product_name: i.product_name.trim(),
        quantity: Math.max(1, Number(i.quantity) || 1),
      }));

    if (!clientName.trim() || !clientPhone.trim() || validItems.length === 0) return;

    const numAvance = avanceAmount !== '' ? Math.max(0, parseFloat(avanceAmount) || 0) : undefined;
    const numTotal = totalAmount !== '' ? Math.max(0, parseFloat(totalAmount) || 0) : undefined;

    setIsSubmitting(true);
    try {
      await onCreateDemand(clientName.trim(), clientPhone.trim(), validItems, numAvance, numTotal);
      setClientName('');
      setClientPhone('');
      setAvanceAmount('');
      setTotalAmount('');
      setItems([{ product_name: '', quantity: 1 }]);
    } finally {
      setIsSubmitting(false);
    }
  }, [items, clientName, clientPhone, avanceAmount, totalAmount, onCreateDemand]);

  const filteredDemands = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return demands.filter(dem => {
      const matchesStatus = statusFilter === 'all' || dem.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        dem.client?.name.toLowerCase().includes(q) ||
        dem.client?.phone.includes(q) ||
        dem.items?.some(i => i.product_name.toLowerCase().includes(q))
      );
    });
  }, [demands, searchQuery, statusFilter]);

  const getWhatsAppLink = useCallback((demand: ClientDemand) => {
    if (!demand.client?.phone) return '#';
    let rawPhone = demand.client.phone.replace(/\D/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '212' + rawPhone.slice(1);
    
    const readyItems = demand.items?.filter(i => i.is_in_stock && !i.is_delivered) || [];
    const readyText = readyItems.map(i => `- ${i.product_name} (${i.quantity})`).join('\n');
    
    const message = `السلام عليكم ورحمة الله وبركاته السيد(ة) ${demand.client.name}،\n\nنخبركم من المكتبة العصرية (Lib Moderne) أن الكتب والخصاصات التالية قد وصلت وتنتظر استلامكم:\n\n${readyText}\n\nالمكان: المكتبة العصرية - Lib Moderne\nالهاتف: 06.60.56.33.71 / 06.60.31.98.68`;
    
    return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
  }, []);

  return (
    <div className="space-y-6">
      
      {/* 1. Demand Entry Form Floating Glass Card */}
      <div ref={formRef} className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold shadow-md">
              <Plus className="w-5 h-5 text-orange-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-neutral-900">تسجيل طلبية خصاص جديدة</h2>
              <p className="text-xs text-neutral-500 font-medium">إدخال معلومات الزبون والكتب المستلزمات المعلقة</p>
            </div>
          </div>

          <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200/80 px-3.5 py-1 rounded-full">
            تكميل تلقائي سريع
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-700" />
                <span>اسم الزبون الكامل:</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: الحسن أيت الطالب"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium min-h-[38px] sm:min-h-[44px] transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-orange-700" />
                <span>رقم الهاتف (الواتساب):</span>
              </label>
              <input
                type="tel"
                required
                placeholder="مثال: 0661234567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-mono dir-ltr text-right min-h-[38px] sm:min-h-[44px] transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Items Dynamic Rows */}
          <div className="space-y-2.5 sm:space-y-3 pt-2">
            <label className="block text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-orange-700" />
              <span>الكتب والمستلزمات المطلوبة:</span>
            </label>

            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex-1">
                  <ProductAutocomplete
                    value={item.product_name}
                    onChange={(val) => handleItemChange(index, 'product_name', val)}
                    masterProducts={masterProducts}
                    placeholder="ابحث أو اكتب اسم الكتاب..."
                    required
                  />
                </div>

                <div className="w-20 sm:w-24">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                    value={item.quantity || ''}
                    onKeyDown={handlePreventNegativeKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleItemChange(index, 'quantity', val === '' ? '' : Math.max(1, parseInt(val) || 1));
                    }}
                    className="w-full bg-white/90 border border-neutral-200/80 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 min-h-[36px] sm:min-h-[40px]"
                  />
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(index)}
                    className="p-1.5 sm:p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Avance & Total */}
            <div className="pt-2 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
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
                  className="w-full bg-white/90 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono"
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
                  className="w-full bg-white/90 border border-neutral-200/80 focus:border-neutral-900 focus:bg-white text-neutral-900 font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-2xl outline-none transition-all shadow-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-800 hover:text-orange-700 bg-neutral-100 hover:bg-neutral-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>إضافة سطر كتاب آخر</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ الطلبية'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* 2. Demands List Filter & Table Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-5 sm:p-6 space-y-4">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-neutral-900">قائمة الطلبيات المسجلة</h3>
            <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {filteredDemands.length} طلب
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-9 pl-3 h-9 text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { key: 'all', label: 'الكل' },
                { key: 'pending', label: 'معلق' },
                { key: 'partial', label: 'جزئي' },
                { key: 'completed', label: 'مكتمل' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setStatusFilter(btn.key as any)}
                  className={`h-7 sm:h-9 px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                    statusFilter === btn.key
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Demands Table */}
        <div className="divide-y divide-neutral-100">
          {filteredDemands.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs font-bold">
              لا توجد طلبيات مطابقة للبحث
            </div>
          ) : (
            filteredDemands.map((demand) => {
              const completedItems = demand.items?.filter(i => i.is_delivered).length || 0;
              const totalItems = demand.items?.length || 0;

              return (
                <div key={demand.id} className="py-2.5 sm:py-3 group transition-colors hover:bg-neutral-50/60 rounded-2xl px-2.5 sm:px-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-2.5">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shrink-0">
                        {demand.client?.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/customers/${encodeURIComponent(demand.id)}`}
                            className="font-bold text-xs sm:text-sm text-neutral-900 hover:text-orange-700 hover:underline transition-colors truncate"
                          >
                            {demand.client?.name}
                          </Link>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            demand.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : demand.status === 'partial'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {demand.status === 'completed' ? 'مكتمل' : demand.status === 'partial' ? 'جزئي' : 'معلق'}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-neutral-500 font-mono dir-ltr text-right mt-0.5">
                          {demand.client?.phone}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center flex-wrap">
                      <span className="text-[11px] sm:text-xs font-bold text-neutral-600 bg-neutral-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                        {completedItems} / {totalItems} مستلم
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedPrintDemand(demand)}
                        className="p-1.5 sm:p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                        title="طباعة وصل خصاص"
                      >
                        <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <a
                        href={getWhatsAppLink(demand)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 sm:p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-colors"
                        title="إرسال إشعار واتساب"
                      >
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => setEditingDemand(demand)}
                        className="p-1.5 sm:p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                        title="تعديل الطلب"
                      >
                        <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
                            onDeleteDemand(demand.id);
                          }
                        }}
                        className="p-1.5 sm:p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors"
                        title="حذف الطلب"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Print Receipt Modal */}
      {selectedPrintDemand && (
        <ThermalReceiptModal
          demand={selectedPrintDemand}
          onClose={() => setSelectedPrintDemand(null)}
        />
      )}

      {/* Edit Modal */}
      {editingDemand && (
        <EditDemandModal
          demand={editingDemand}
          masterProducts={masterProducts}
          onClose={() => setEditingDemand(null)}
          onSave={onUpdateDemand}
        />
      )}

    </div>
  );
}

export default React.memo(DemandsList);
