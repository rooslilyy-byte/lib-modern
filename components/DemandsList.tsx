'use client';

import React, { useState, useMemo, useRef } from 'react';
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
    items: { product_name: string; quantity: number }[]
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
    }[]
  ) => Promise<void>;
  onUpdateItemState: (
    itemId: string, 
    updates: { is_in_stock?: boolean; is_delivered?: boolean }
  ) => Promise<void>;
  onDeleteDemand: (demandId: string) => Promise<void>;
  initialSearchQuery?: string;
}

export default function DemandsList({
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
  const [items, setItems] = useState<{ product_name: string; quantity: number }[]>([
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

  const stats = useMemo(() => {
    const total = demands.length;
    const pending = demands.filter(d => d.status === 'pending').length;
    const partial = demands.filter(d => d.status === 'partial').length;
    const completed = demands.filter(d => d.status === 'completed').length;
    return { total, pending, partial, completed };
  }, [demands]);

  const handleItemChange = (index: number, field: 'product_name' | 'quantity', value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItemRow = () => {
    setItems([...items, { product_name: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.product_name.trim().length > 0);
    if (!clientName.trim() || !clientPhone.trim() || validItems.length === 0) return;

    setIsSubmitting(true);
    try {
      await onCreateDemand(clientName.trim(), clientPhone.trim(), validItems);
      setClientName('');
      setClientPhone('');
      setItems([{ product_name: '', quantity: 1 }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDemands = useMemo(() => {
    return demands.filter(dem => {
      const matchesStatus = statusFilter === 'all' || dem.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        dem.client?.name.toLowerCase().includes(q) ||
        dem.client?.phone.includes(q) ||
        dem.items?.some(i => i.product_name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [demands, searchQuery, statusFilter]);

  const getWhatsAppLink = (demand: ClientDemand) => {
    if (!demand.client?.phone) return '#';
    let rawPhone = demand.client.phone.replace(/\D/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '212' + rawPhone.slice(1);
    
    const readyItems = demand.items?.filter(i => i.is_in_stock && !i.is_delivered) || [];
    const readyText = readyItems.map(i => `- ${i.product_name} (${i.quantity})`).join('\n');
    
    const message = `السلام عليكم ورحمة الله وبركاته السيد(ة) ${demand.client.name}،\n\nنخبركم من مكتبة وراقة اهل سوس أن الكتب والخصاصات التالية قد وصلت وتنتظر استلامكم:\n\n${readyText}\n\nالعنوان: مكتبة وراقة اهل سوس\nالهاتف: +212 661-556418`;
    
    return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Demand Entry Form */}
      <div ref={formRef} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">تسجيل طلبية خصاص جديدة</h2>
              <p className="text-xs text-slate-500">إدخال معلومات الزبون والكتب المستلزمات المعلقة</p>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
            تكميل تلقائي سريع
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-600" />
                <span>اسم الزبون الكامل:</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: الحسن أيت الطالب"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-medium min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-600" />
                <span>رقم الهاتف (الواتساب):</span>
              </label>
              <input
                type="tel"
                required
                placeholder="مثال: 0661234567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-mono dir-ltr text-right min-h-[44px]"
              />
            </div>
          </div>

          {/* Items Row */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-700">
              قائمة الكتب والمستلزمات الناقصة:
            </label>

            {items.map((item, idx) => {
              return (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-slate-50 p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                  <div className="flex-1 relative">
                    <ProductAutocomplete
                      required
                      value={item.product_name}
                      onChange={(val) => handleItemChange(idx, 'product_name', val)}
                      masterProducts={masterProducts}
                      placeholder="ابحث أو اكتب اسم الكتاب..."
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="w-32 flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shrink-0 min-h-[44px]">
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

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-2.5 text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center border border-rose-200 sm:border-0 bg-white sm:bg-transparent"
                        title="حذف السطر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-200 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سطر آخر</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-h-[44px]"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>طلب خصاص جديد</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* 2. Demands List & Search Compact Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-0">
        
        {/* Filter & Search Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث باسم الزبون، الهاتف، أو الكتاب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-800 font-medium min-h-[40px]"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl overflow-x-auto text-xs font-bold shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              الكل ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'pending' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-rose-700'}`}
            >
              معلق ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'partial' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-amber-700'}`}
            >
              جزئي ({stats.partial})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              مكتمل ({stats.completed})
            </button>
          </div>
        </div>

        {/* Compact Full-Width Table */}
        {filteredDemands.length === 0 ? (
          <div className="text-center py-12 px-4 border-b border-slate-200">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-bold text-slate-600">لا توجد طلبات مطابقة للبحث</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            
            {/* Desktop Column Header Header Bar */}
            <div className="hidden md:flex items-center justify-between px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-3 min-w-[220px]">
                <span className="w-7 text-center">#</span>
                <span>الزبون والترقيم</span>
              </div>
              <div className="w-44 text-right">رقم الهاتف (الواتساب)</div>
              <div className="flex-1 text-center">الخصاص والسلع المطلوبة</div>
              <div className="w-28 text-left">التفاصيل والخيارات</div>
            </div>

            {/* Compact Rows */}
            {filteredDemands.map((demand, idx) => {
              const totalItems = demand.items?.length || 0;
              const missingItems = demand.items?.filter(i => !i.is_in_stock && !i.is_delivered) || [];
              const missingCount = missingItems.length;

              const isExpanded = expandedDemandId === demand.id;

              return (
                <div key={demand.id} className="group transition-colors bg-white hover:bg-slate-50/80">
                  
                  {/* Main Minimalist Compact Row */}
                  <div 
                    onClick={() => setExpandedDemandId(isExpanded ? null : demand.id)}
                    className="py-2.5 px-3 sm:py-3 sm:px-5 cursor-pointer flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 text-right select-none"
                  >
                    
                    {/* RTL Section 1: ID + Customer Name + Phone */}
                    <div className="flex items-center justify-between md:justify-start gap-2.5 min-w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                          #{idx + 1}
                        </span>
                        
                        <Link
                          href={`/customers/${encodeURIComponent(demand.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-extrabold text-slate-900 text-xs sm:text-sm hover:text-slate-600 hover:underline transition-colors truncate dir-rtl text-right"
                          title="انقر لعرض الملف الشخصي الكامل للزبون"
                        >
                          {demand.client?.name || 'زبون غير معرف'}
                        </Link>
                      </div>

                      {/* Mobile Expand Toggle */}
                      <div className="md:hidden flex items-center gap-1.5">
                        <button 
                          type="button"
                          className="p-1 rounded-lg text-slate-400"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-800" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {/* RTL Section 2: Phone Link */}
                    <div className="w-full md:w-40 flex items-center justify-between md:justify-start gap-2">
                      <a 
                        href={`tel:${demand.client?.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold font-mono text-slate-700 hover:text-slate-900 bg-slate-100/90 hover:bg-slate-200/90 px-2 py-0.5 rounded border border-slate-200 transition-colors dir-ltr"
                      >
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{demand.client?.phone}</span>
                      </a>

                      {/* Mobile Badges */}
                      <div className="md:hidden flex items-center gap-1.5 flex-wrap">
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {totalItems} سلعة
                        </span>
                        {missingCount > 0 ? (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {missingCount} خصاص
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            جاهز
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RTL Section 3: Badges (Desktop) */}
                    <div className="hidden md:flex flex-1 items-center justify-center gap-2">
                      <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                        {totalItems} سلعة
                      </span>
                      
                      {missingCount > 0 ? (
                        <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                          {missingCount} خصاص
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                          جاهز بالكامل
                        </span>
                      )}
                    </div>

                    {/* RTL Section 4: Desktop Chevron */}
                    <div className="hidden md:flex w-16 items-center justify-end">
                      <div className="w-6 h-6 rounded bg-slate-100 group-hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-900" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Pure Minimalist Inline Missing Items List */}
                  {isExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-200 px-4 py-2.5 space-y-1.5 animate-in fade-in duration-150 text-right">
                      {missingItems.length === 0 ? (
                        <div className="text-[11px] font-bold text-emerald-700 py-1">
                          جميع طلبات هذا الزبون متوفرة بالمحل أو تم تسليمها بالكامل.
                        </div>
                      ) : (
                        missingItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 py-1 border-b border-slate-200/50 last:border-0 text-xs">
                            <span className="w-6 h-6 rounded bg-slate-200/80 text-slate-800 font-black text-xs flex items-center justify-center shrink-0">
                              {item.quantity}
                            </span>
                            <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0">
                              خصاص
                            </span>
                            <span className="font-extrabold text-slate-900 text-xs truncate">
                              {item.product_name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                </div>
              );
            })}

          </div>
        )}

      </div>

      {/* Thermal Receipt Modal */}
      {selectedPrintDemand && (
        <ThermalReceiptModal
          demand={selectedPrintDemand}
          onClose={() => setSelectedPrintDemand(null)}
        />
      )}

      {/* Edit Demand Modal */}
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
