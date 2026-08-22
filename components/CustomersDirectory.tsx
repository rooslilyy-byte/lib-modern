'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, Search, Phone, MessageSquare, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import CreateDemandModal from './CreateDemandModal';

interface CustomersDirectoryProps {
  demands: ClientDemand[];
  masterProducts?: MasterProduct[];
  onCreateDemand?: (
    clientName: string, 
    clientPhone: string, 
    items: { product_name: string; quantity: number }[]
  ) => Promise<void>;
  onDeleteBulkCustomers?: (clientIds: string[]) => Promise<void>;
  onSelectCustomer?: (demandOrClientId: string) => void;
}

export default function CustomersDirectory({ 
  demands, 
  masterProducts = [], 
  onCreateDemand,
  onDeleteBulkCustomers,
  onSelectCustomer 
}: CustomersDirectoryProps) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Each demand is an independent customer entry (never merge duplicates with same phone)
  const customerEntries = useMemo(() => {
    return demands
      .filter((dem): dem is ClientDemand & { client: NonNullable<ClientDemand['client']> } => Boolean(dem.client))
      .map(dem => {
        const items = dem.items || [];
        const totalItems = items.length;
        const deliveredItems = items.filter(i => i.is_delivered).length;
        const missingItems = items.filter(i => !i.is_in_stock && !i.is_delivered);
        const inStockItems = items.filter(i => i.is_in_stock && !i.is_delivered).length;
        const isComplete = totalItems > 0 && deliveredItems === totalItems;
        const isReady = !isComplete && totalItems > 0 && (inStockItems + deliveredItems) === totalItems;

        return {
          id: dem.id,
          clientId: dem.client.id,
          name: dem.client.name,
          phone: dem.client.phone,
          createdAt: dem.created_at || new Date().toISOString(),
          status: dem.status,
          totalItems,
          deliveredItems,
          inStockItems,
          missingItems,
          missingCount: missingItems.length,
          isComplete,
          isReady,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [demands]);

  const filteredCustomers = customerEntries.filter(c => {
    const matchesSearch = 
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      c.phone.includes(searchQuery.trim());
    if (!matchesSearch) return false;

    if (filter === 'ready') {
      return c.totalItems > 0 && c.missingCount === 0;
    }
    if (filter === 'partial') {
      return c.missingCount > 0 && c.missingCount < c.totalItems;
    }
    if (filter === 'waiting') {
      return c.totalItems > 0 && c.missingCount === c.totalItems;
    }
    return true;
  });

  const isAllSelected = filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerIds.includes(c.clientId));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.clientId));
    }
  };

  const handleToggleCustomer = (clientId: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(clientId) ? prev.filter(x => x !== clientId) : [...prev, clientId]
    );
  };

  const handleCancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedCustomerIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    const count = selectedCustomerIds.length;
    if (window.confirm(`هل أنت متأكد من حذف ${count} طلبات زبناء نهائياً؟`)) {
      setIsDeletingBulk(true);
      try {
        if (onDeleteBulkCustomers) {
          await onDeleteBulkCustomers(selectedCustomerIds);
        }
        setSelectedCustomerIds([]);
        setIsSelectMode(false);
      } catch (err) {
        console.error('Error deleting bulk customers:', err);
        alert('حدث خطأ أثناء حذف الزبناء المحددات.');
      } finally {
        setIsDeletingBulk(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">دليل الزبناء</h2>
            <p className="text-[11px] text-slate-500">عرض جميع لوائح وخصاصات الزبناء بشكل منفصل ومستقل</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-col sm:flex-row w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 sm:top-3" />
            <input
              type="text"
              placeholder="ابحث باسم الزبون أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 h-9 sm:h-10 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-medium transition-colors"
            />
          </div>

          {/* Action Buttons based on isSelectMode */}
          {!isSelectMode ? (
            <>
              {/* Enter Select Mode Button */}
              {onDeleteBulkCustomers && (
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs sm:text-sm px-3.5 h-9 sm:h-10 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0"
                  title="تحديد زبناء لحذفهم"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>حذف زبناء</span>
                </button>
              )}

              {/* Add Customer & Demand Button */}
              {onCreateDemand && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm px-3.5 h-9 sm:h-10 rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>إضافة زبون وطلب خصاص</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Confirm Bulk Delete Button */}
              <button
                onClick={handleBulkDelete}
                disabled={selectedCustomerIds.length === 0 || isDeletingBulk}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm px-3.5 h-9 sm:h-10 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                title="تأكيد حذف الزبناء المحددين"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>
                  {isDeletingBulk 
                    ? 'جاري الحذف...' 
                    : selectedCustomerIds.length > 0 
                    ? `تأكيد حذف (${selectedCustomerIds.length})` 
                    : 'حدد زبناء للحذف'}
                </span>
              </button>

              {/* Cancel Selection Mode Button */}
              <button
                onClick={handleCancelSelectMode}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm px-3.5 h-9 sm:h-10 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0 border border-slate-200"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>إلغاء التحديد</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {onCreateDemand && (
        <CreateDemandModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          masterProducts={masterProducts}
          onCreateDemand={onCreateDemand}
        />
      )}

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'ready', label: 'جاهز بالكامل' },
          { key: 'partial', label: 'جاهز جزئياً' },
          { key: 'waiting', label: 'في الانتظار' },
        ].map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => setFilter(btn.key)}
            className={`h-9 px-4 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === btn.key
                ? 'bg-slate-900 text-white shadow-sm border border-slate-900'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Compact Full-Width Customers Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-0">
        
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 bg-white">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">لا يوجد زبناء مطابقتون للبحث</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            
            {/* Desktop Table Header */}
            <div className="hidden md:flex items-center justify-between px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-3 min-w-[240px]">
                {isSelectMode && (
                  <div className="w-5 flex items-center justify-center shrink-0">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                      title="تحديد الكل"
                    />
                  </div>
                )}
                <span className="w-7 text-center">#</span>
                <span>الزبون واللائحة</span>
              </div>
              <div className="w-44 text-right">رقم الهاتف (الواتساب)</div>
              <div className="flex-1 text-center">حالة الخصاص والاستلام</div>
              <div className="w-16 text-left">التفاصيل</div>
            </div>

            {/* Rows */}
            {filteredCustomers.map((cli, idx) => {
              const isExpanded = expandedDemandId === cli.id;
              const isSelected = selectedCustomerIds.includes(cli.clientId);

              return (
                <div key={cli.id} className={`group transition-colors ${isSelected ? 'bg-slate-100/70' : 'bg-white hover:bg-slate-50/80'}`}>
                  
                  {/* Main Minimalist Compact Row */}
                  <div 
                    onClick={() => setExpandedDemandId(isExpanded ? null : cli.id)}
                    className="py-2.5 px-3 sm:py-3 sm:px-5 cursor-pointer flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 text-right select-none"
                  >
                    
                    {/* RTL Section 1: Checkbox + ID + Customer Name */}
                    <div className="flex items-center justify-between md:justify-start gap-2.5 min-w-[240px]">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelectMode && (
                          <div className="w-5 flex items-center justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleCustomer(cli.clientId);
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                              title="تحديد هذا الزبون"
                            />
                          </div>
                        )}

                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                          #{idx + 1}
                        </span>
                        
                        <Link
                          href={`/customers/${encodeURIComponent(cli.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-extrabold text-slate-900 text-xs sm:text-sm hover:text-slate-600 hover:underline transition-colors truncate dir-rtl text-right"
                          title="انقر لعرض ملف هذه الطلبية بالكامل"
                        >
                          {cli.name}
                        </Link>
                      </div>

                      {/* Mobile Expand Toggle Arrow */}
                      <div className="md:hidden flex items-center gap-1.5">
                        <button 
                          type="button" 
                          className="p-1 rounded-lg text-slate-400"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-800" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {/* RTL Section 2: Phone Column */}
                    <div className="w-full md:w-40 flex items-center justify-between md:justify-start gap-2">
                      <a 
                        href={`tel:${cli.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold font-mono text-slate-700 hover:text-slate-900 bg-slate-100/90 hover:bg-slate-200/90 px-2 py-0.5 rounded border border-slate-200 transition-colors dir-ltr"
                      >
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{cli.phone}</span>
                      </a>

                      {/* Mobile Badges */}
                      <div className="md:hidden flex items-center gap-1.5 flex-wrap">
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {cli.totalItems} سلعة
                        </span>
                        {cli.missingCount > 0 ? (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {cli.missingCount} خصاص
                          </span>
                        ) : cli.isReady ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            جاهز
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            مستلم
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RTL Section 3: Desktop Badges */}
                    <div className="hidden md:flex flex-1 items-center justify-center gap-2">
                      <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                        {cli.totalItems} سلعة
                      </span>

                      {cli.missingCount > 0 ? (
                        <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                          {cli.missingCount} خصاص
                        </span>
                      ) : cli.isReady ? (
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                          جاهز للاستلام
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                          جميع طلباته مستلمة
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
                      {cli.missingCount === 0 ? (
                        <div className="text-[11px] font-bold text-emerald-700 py-1">
                          جميع كتب هذه الطلبية متوفرة بالمحل أو تم تسليمها بالكامل.
                        </div>
                      ) : (
                        cli.missingItems.map((item) => (
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

    </div>
  );
}
