'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Users, Search, Phone, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';
import CreateDemandModal from './CreateDemandModal';

interface CustomersDirectoryProps {
  demands: ClientDemand[];
  masterProducts?: MasterProduct[];
  onCreateDemand?: (
    clientName: string, 
    clientPhone: string, 
    items: { product_name: string; quantity: number }[],
    avanceAmount?: number,
    totalAmount?: number
  ) => Promise<void>;
  onDeleteBulkCustomers?: (clientIds: string[]) => Promise<void>;
  onSelectCustomer?: (demandOrClientId: string) => void;
}

function CustomersDirectoryContent({ 
  demands, 
  masterProducts = [], 
  onCreateDemand,
  onDeleteBulkCustomers,
}: CustomersDirectoryProps) {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  
  // Read initial status query parameter if present
  const initialStatusParam = searchParams.get('status') || 'all';

  const [filter, setFilter] = useState(initialStatusParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Sync state if URL query changes (e.g. navigation from dashboard cards)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilter(statusParam);
    }
  }, [searchParams]);

  // Each demand is an independent customer entry
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

    if (filter === 'ready' || filter === 'completed') {
      return (c.totalItems > 0 && c.missingCount === 0) || c.isComplete || c.isReady;
    }
    if (filter === 'partial') {
      return c.missingCount > 0 && c.missingCount < c.totalItems;
    }
    if (filter === 'waiting' || filter === 'pending') {
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
        alert('حدث خطأ أثناء حذف الزبناء المحددين.');
      } finally {
        setIsDeletingBulk(false);
      }
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* 1. Header Floating Glass Card with Custom Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
            <img
              src="/logo-lib-modern-alt.jpg"
              alt="Lib Moderne - المكتبة العصرية"
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-neutral-900">{t('cust.title')}</h2>
              <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {customerEntries.length} {t('common.items')}
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">{t('cust.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-col sm:flex-row w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              placeholder={t('cust.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-10 pl-4 h-11 text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium transition-all shadow-xs"
            />
          </div>

          {/* Action Buttons */}
          {!isSelectMode ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onDeleteBulkCustomers && (
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-bold text-xs sm:text-sm px-4 h-11 rounded-full shadow-xs flex items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
                  title="تحديد زبناء لحذفهم"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>{t('cust.bulk_delete')}</span>
                </button>
              )}

              {onCreateDemand && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white font-bold text-xs sm:text-sm px-5 h-11 rounded-full shadow-md flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 shrink-0"
                >
                  <Plus className="w-4 h-4 text-orange-500" />
                  <span>{t('dash.new_demand')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleBulkDelete}
                disabled={selectedCustomerIds.length === 0 || isDeletingBulk}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm px-5 h-11 rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 shrink-0"
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

              <button
                onClick={handleCancelSelectMode}
                className="w-full sm:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs sm:text-sm px-4 h-11 rounded-full shadow-xs flex items-center justify-center gap-1.5 transition-all duration-300 shrink-0"
              >
                <X className="w-4 h-4 text-neutral-500" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
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

      {/* 2. Status Filter Pill Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: t('cust.filter_all') },
          { key: 'ready', label: t('cust.filter_ready') },
          { key: 'partial', label: t('cust.filter_partial') },
          { key: 'waiting', label: t('cust.filter_waiting') },
        ].map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => setFilter(btn.key)}
            className={`h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-full transition-all duration-300 whitespace-nowrap shadow-xs ${
              filter === btn.key
                ? 'bg-neutral-900 text-white shadow-md hover:bg-black'
                : 'bg-white/80 backdrop-blur-sm text-neutral-700 border border-neutral-200/80 hover:bg-white hover:text-neutral-900 hover:-translate-y-0.5'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 3. Floating Customers Table Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl overflow-hidden">
        
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-neutral-700">{t('cust.no_results')}</p>
            <p className="text-xs text-neutral-400 mt-1">تأكد من رقم الهاتف أو الاسم المدخل</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            
            {/* Desktop Table Header */}
            <div className="hidden md:flex items-center justify-between px-6 py-3.5 bg-neutral-50/60 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">
              <div className="flex items-center gap-3 min-w-[260px]">
                {isSelectMode && (
                  <div className="w-5 flex items-center justify-center shrink-0">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer accent-neutral-900"
                      title="تحديد الكل"
                    />
                  </div>
                )}
                <span className="w-8 text-center">#</span>
                <span>{t('cust.col_client')}</span>
              </div>
              <div className="w-48 text-right">{t('cust.col_phone')}</div>
              <div className="flex-1 text-center">{t('cust.col_status')}</div>
              <div className="w-20 text-left">{t('cust.col_details')}</div>
            </div>

            {/* Customer Rows */}
            {filteredCustomers.map((cli, idx) => {
              const isExpanded = expandedDemandId === cli.id;
              const isSelected = selectedCustomerIds.includes(cli.clientId);

              return (
                <div key={cli.id} className={`group transition-all duration-200 ${isSelected ? 'bg-neutral-100/70' : 'hover:bg-white'}`}>
                  
                  {/* Row */}
                  <div 
                    onClick={() => setExpandedDemandId(isExpanded ? null : cli.id)}
                    className="py-3 px-4 sm:py-3.5 sm:px-6 cursor-pointer flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-right select-none"
                  >
                    
                    {/* Section 1: Checkbox + ID + Customer Name */}
                    <div className="flex items-center justify-between md:justify-start gap-3 min-w-[260px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isSelectMode && (
                          <div className="w-5 flex items-center justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleCustomer(cli.clientId);
                              }}
                              className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer accent-neutral-900"
                              title="تحديد هذا الزبون"
                            />
                          </div>
                        )}

                        <span className="w-7 h-7 rounded-xl bg-neutral-100 text-neutral-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-neutral-200/60">
                          #{idx + 1}
                        </span>
                        
                        <Link
                          href={`/customers/${encodeURIComponent(cli.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-extrabold text-neutral-900 text-sm hover:text-orange-600 hover:underline transition-colors truncate dir-rtl text-right"
                          title="انقر لعرض ملف هذه الطلبية بالكامل"
                        >
                          {cli.name}
                        </Link>
                      </div>

                      {/* Mobile Chevron */}
                      <div className="md:hidden flex items-center gap-1.5">
                        <button 
                          type="button" 
                          className="p-1.5 rounded-full text-neutral-400 hover:bg-neutral-100"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-900" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Phone */}
                    <div className="w-full md:w-48 flex items-center justify-between md:justify-start gap-2">
                      <a 
                        href={`tel:${cli.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-neutral-800 hover:text-orange-600 bg-neutral-100/90 hover:bg-neutral-200/90 px-3 py-1 rounded-full border border-neutral-200/60 transition-colors dir-ltr"
                      >
                        <Phone className="w-3 h-3 text-neutral-500" />
                        <span>{cli.phone}</span>
                      </a>

                      {/* Mobile Badges */}
                      <div className="md:hidden flex items-center gap-1.5 flex-wrap">
                        <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200/60">
                          {cli.totalItems} سلعة
                        </span>
                        {cli.missingCount > 0 ? (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200/60">
                            {cli.missingCount} خصاص
                          </span>
                        ) : cli.isReady ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            جاهز
                          </span>
                        ) : (
                          <span className="bg-neutral-100 text-neutral-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            مستلم
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section 3: Desktop Badges */}
                    <div className="hidden md:flex flex-1 items-center justify-center gap-2">
                      <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200/60">
                        {cli.totalItems} سلعة
                      </span>

                      {cli.missingCount > 0 ? (
                        <span className="bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1 rounded-full border border-rose-200/60">
                          {cli.missingCount} خصاص معلق
                        </span>
                      ) : cli.isReady ? (
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/60">
                          جاهز للتسليم
                        </span>
                      ) : (
                        <span className="bg-neutral-100 text-neutral-700 text-xs font-bold px-3 py-1 rounded-full">
                          جميع طلباته مستلمة
                        </span>
                      )}
                    </div>

                    {/* Section 4: Desktop Chevron */}
                    <div className="hidden md:flex w-20 items-center justify-end gap-2">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 group-hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-900" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-500" />
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Inline Expanded Items Preview */}
                  {isExpanded && (
                    <div className="bg-neutral-50/80 border-t border-neutral-100 px-6 py-4 space-y-2 animate-in fade-in duration-150 text-right">
                      {cli.missingCount === 0 ? (
                        <div className="text-xs font-bold text-emerald-700 py-1">
                          جميع كتب هذه الطلبية متوفرة بالمحل أو تم تسليمها بالكامل.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-neutral-400 uppercase">قائمة المواد المعلقة:</p>
                          {cli.missingItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-neutral-200/50 last:border-0 text-xs">
                              <span className="w-6 h-6 rounded-lg bg-neutral-200 text-neutral-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {item.quantity}
                              </span>
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200/60 shrink-0">
                                خصاص
                              </span>
                              <span className="font-extrabold text-neutral-900 text-xs truncate">
                                {item.product_name}
                              </span>
                            </div>
                          ))}
                        </div>
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

export default function CustomersDirectory(props: CustomersDirectoryProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-neutral-400">جاري تحميل دليل الزبائن...</div>}>
      <CustomersDirectoryContent {...props} />
    </Suspense>
  );
}
