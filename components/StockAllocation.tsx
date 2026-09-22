'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  PackageCheck, 
  CheckCircle2, 
  Search, 
  X, 
  Ban, 
  ArrowUpDown, 
  RotateCcw, 
  AlertCircle,
  Plus,
  Package
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { compareProductNames } from '@/lib/sortUtils';
import { useLanguage } from '@/lib/languageContext';

type ViewTab = 'normal' | 'rupture';
type SortOption = 'alphabetical' | 'oldest' | 'newest';

interface AggregatedProduct {
  productName: string;
  category: string;
  totalDemanded: number;
  totalFulfilled: number;
  totalMissingQty: number;
  availableStock: number;
  clients: { clientName: string; phone: string; quantity: number; demandCreatedAt: string }[];
  initialDemandCreatedAt: string;
  latestDemandCreatedAt: string;
}

interface StockAllocationProps {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onUpdateItemState: (
    itemId: string, 
    updates: { is_in_stock?: boolean; is_delivered?: boolean; fulfilled_quantity?: number }
  ) => Promise<void>;
  onAutoAllocateStock?: (
    productName: string, 
    receivedQty: number
  ) => Promise<{ clientName: string; phone: string; fulfilledQty: number; link: string }[]>;
  onMarkEnRupture?: (productName: string) => Promise<void>;
  onRestoreEnRupture?: (productName: string) => Promise<void>;
}

export default function StockAllocation({
  demands,
  masterProducts,
  onAutoAllocateStock,
  onMarkEnRupture,
  onRestoreEnRupture,
}: StockAllocationProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ViewTab>('normal');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [modalProduct, setModalProduct] = useState<{ productName: string; totalMissingQty: number } | null>(null);
  const [modalQty, setModalQty] = useState<string>('');
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  const [localDemands, setLocalDemands] = useState<ClientDemand[]>(demands);

  useEffect(() => {
    setLocalDemands(demands);
  }, [demands]);

  useEffect(() => {
    if (modalProduct) {
      setTimeout(() => {
        modalInputRef.current?.focus();
      }, 50);
    }
  }, [modalProduct]);

  // Calculate Active Missing Products Aggregation
  const { normalProductsList, ruptureProductsList } = useMemo(() => {
    const normalMap: Record<string, AggregatedProduct> = {};
    const ruptureMap: Record<string, AggregatedProduct> = {};

    for (const dem of localDemands) {
      if (!dem.items || !dem.client) continue;
      for (const item of dem.items) {
        if (!item.is_delivered && !item.is_in_stock) {
          const pName = item.product_name.trim();
          const key = pName.toLowerCase();
          const isRupture = item.status === 'en_rupture';
          const targetMap = isRupture ? ruptureMap : normalMap;

          if (!targetMap[key]) {
            const masterProd = masterProducts.find(
              mp => mp.name.trim().toLowerCase() === key
            );
            targetMap[key] = {
              productName: pName,
              category: masterProd?.category || 'كتاب مدرسي',
              totalDemanded: 0,
              totalFulfilled: 0,
              totalMissingQty: 0,
              availableStock: masterProd?.available_stock || 0,
              clients: [],
              initialDemandCreatedAt: dem.created_at || new Date().toISOString(),
              latestDemandCreatedAt: dem.created_at || new Date().toISOString(),
            };
          }

          const totalQty = item.quantity || 0;
          const fulfilledQty = item.fulfilled_quantity || 0;
          const stillNeeded = Math.max(0, totalQty - fulfilledQty);

          if (stillNeeded <= 0) {
            continue;
          }

          targetMap[key].totalDemanded += totalQty;
          targetMap[key].totalFulfilled += fulfilledQty;
          targetMap[key].totalMissingQty += stillNeeded;

          const createdAt = dem.created_at || new Date().toISOString();
          targetMap[key].clients.push({
            clientName: dem.client.name,
            phone: dem.client.phone,
            quantity: stillNeeded,
            demandCreatedAt: createdAt,
          });

          if (new Date(createdAt).getTime() < new Date(targetMap[key].initialDemandCreatedAt).getTime()) {
            targetMap[key].initialDemandCreatedAt = createdAt;
          }
          if (new Date(createdAt).getTime() > new Date(targetMap[key].latestDemandCreatedAt).getTime()) {
            targetMap[key].latestDemandCreatedAt = createdAt;
          }
        }
      }
    }

    const processList = (map: Record<string, AggregatedProduct>) => {
      return Object.values(map)
        .map(item => ({
          ...item,
          clients: item.clients.sort((a, b) => new Date(a.demandCreatedAt).getTime() - new Date(b.demandCreatedAt).getTime())
        }))
        .filter(item => item.totalMissingQty > 0);
    };

    return {
      normalProductsList: processList(normalMap),
      ruptureProductsList: processList(ruptureMap),
    };
  }, [localDemands, masterProducts]);

  // Sorting Function
  const sortAggregatedProducts = (list: AggregatedProduct[], sort: SortOption) => {
    return [...list].sort((a, b) => {
      if (sort === 'alphabetical') {
        return compareProductNames(a.productName, b.productName);
      }
      if (sort === 'oldest') {
        const timeA = new Date(a.initialDemandCreatedAt).getTime() || 0;
        const timeB = new Date(b.initialDemandCreatedAt).getTime() || 0;
        return timeA - timeB;
      }
      if (sort === 'newest') {
        const timeA = new Date(a.latestDemandCreatedAt).getTime() || 0;
        const timeB = new Date(b.latestDemandCreatedAt).getTime() || 0;
        return timeB - timeA;
      }
      return 0;
    });
  };

  const displayedProducts = useMemo(() => {
    const baseList = activeTab === 'normal' ? normalProductsList : ruptureProductsList;

    let filtered = baseList;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = baseList.filter(
        p => p.productName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }

    return sortAggregatedProducts(filtered, sortBy);
  }, [activeTab, normalProductsList, ruptureProductsList, searchQuery, sortBy]);

  const currentTotalItems = displayedProducts.length;
  const currentTotalPieces = displayedProducts.reduce((acc, p) => acc + p.totalMissingQty, 0);

  const handleOpenAllocationModal = (product: AggregatedProduct) => {
    setModalProduct({
      productName: product.productName,
      totalMissingQty: product.totalMissingQty,
    });
    setModalQty(product.totalMissingQty.toString());
  };

  const handleConfirmAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProduct || !onAutoAllocateStock) return;

    const qty = parseInt(modalQty);
    if (isNaN(qty) || qty <= 0) {
      alert('يرجى إدخال عدد صحيح موجب');
      return;
    }

    setIsProcessingModal(true);
    try {
      await onAutoAllocateStock(modalProduct.productName, qty);
      setToastMessage(`تم توزيع ${qty} قطعة من "${modalProduct.productName}" بنجاح`);
      setTimeout(() => setToastMessage(null), 3000);
      setModalProduct(null);
      setModalQty('');
    } catch (err) {
      console.error('Error allocating stock:', err);
      alert('حدث خطأ أثناء توزيع المخزون.');
    } finally {
      setIsProcessingModal(false);
    }
  };

  const handleToggleRupture = async (productName: string, isCurrentlyRupture: boolean) => {
    if (isCurrentlyRupture) {
      if (onRestoreEnRupture) {
        await onRestoreEnRupture(productName);
        setToastMessage(`تمت استعادة "${productName}" إلى قائمة المشتريات`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      if (onMarkEnRupture) {
        await onMarkEnRupture(productName);
        setToastMessage(`تم نقل "${productName}" إلى قائمة السلع غير المتوفرة`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top duration-200 border border-neutral-700">
          <CheckCircle2 className="w-5 h-5 text-orange-700" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Floating Glass Card with Custom White Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-lib-modern.jpg"
              alt="Lib Moderne"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-neutral-900">{t('stock.title')}</h2>
                <span className="bg-orange-50 text-orange-700 border border-orange-200/80 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  توزيع فوري
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                {t('stock.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 bg-white/90 border border-neutral-200/80 px-4 h-10 rounded-full shadow-xs">
              <span className="text-neutral-400">العناوين:</span>
              <strong className="text-neutral-900">{currentTotalItems}</strong>
              <span className="text-neutral-300">|</span>
              <span className="text-neutral-400">مجموع القطع:</span>
              <strong className="text-orange-700">{currentTotalPieces}</strong>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Normal vs Rupture */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-neutral-100/80 p-1 sm:p-1.5 rounded-full border border-neutral-200/60 text-[11px] sm:text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('normal')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-full transition-all duration-300 min-h-[34px] sm:min-h-[38px] ${
              activeTab === 'normal'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{t('stock.tab_normal')}</span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] ${
              activeTab === 'normal' ? 'bg-orange-700 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {normalProductsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rupture')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-full transition-all duration-300 min-h-[34px] sm:min-h-[38px] ${
              activeTab === 'rupture'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{t('stock.tab_rupture')}</span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] ${
              activeTab === 'rupture' ? 'bg-orange-700 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {ruptureProductsList.length}
            </span>
          </button>
        </div>

        {/* Search & Sort Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 absolute right-3 top-2.5 sm:right-3.5 sm:top-3" />
            <input
              type="text"
              placeholder="ابحث باسم الكتاب أو الصنف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-9 sm:pr-10 pl-3.5 sm:pl-4 h-9 sm:h-10 text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-[11px] sm:text-xs text-neutral-400 font-bold hidden sm:inline">الترتيب:</span>
            {[
              { key: 'alphabetical', label: t('stock.sort_alpha') },
              { key: 'oldest', label: t('stock.sort_oldest') },
              { key: 'newest', label: t('stock.sort_newest') },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortBy(opt.key as SortOption)}
                className={`h-7 sm:h-9 px-2.5 sm:px-3.5 text-[11px] sm:text-xs font-bold rounded-full transition-all ${
                  sortBy === opt.key
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white border border-neutral-200/80 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Products List Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
        {displayedProducts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-base font-extrabold text-neutral-900">
              {activeTab === 'normal' ? 'جميع السلع المطلوبة متوفرة' : 'لا توجد سلع مسجلة كغير متوفرة'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {activeTab === 'normal' ? 'لا توجد خصاصات معلقة للتوزيع حالياً' : 'قائمة السلع المقطوعة فارغة'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {displayedProducts.map((prod, idx) => (
              <div key={idx} className="py-4 first:pt-0 last:pb-0 group transition-colors">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  
                  {/* Item info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 font-black text-xs flex items-center justify-center shrink-0 border border-neutral-200/60">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                          {prod.productName}
                        </h3>
                        <span className="bg-neutral-100 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {prod.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                        <span>إجمالي المطلوب: <strong className="text-neutral-800">{prod.totalMissingQty} قطعة</strong></span>
                        <span>•</span>
                        <span>عدد الزبناء المنتظرين: <strong className="text-neutral-800">{prod.clients.length}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 self-end md:self-center flex-wrap">
                    {activeTab === 'normal' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAllocationModal(prod)}
                          className="h-8 sm:h-10 px-3 sm:px-5 text-xs sm:text-sm font-bold rounded-full bg-orange-700 hover:bg-orange-800 text-white flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300 shadow-md shadow-orange-700/20 hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>{t('stock.allocate_btn')} ({prod.totalMissingQty})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleRupture(prod.productName, false)}
                          className="h-8 sm:h-10 px-2.5 sm:px-4 text-xs font-bold rounded-full bg-neutral-100 hover:bg-rose-50 hover:text-rose-700 text-neutral-600 flex items-center justify-center gap-1 sm:gap-1.5 transition-colors border border-neutral-200/60"
                          title="وسم كغير متوفر (En Rupture)"
                        >
                          <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">{t('stock.mark_rupture')}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleRupture(prod.productName, true)}
                        className="h-8 sm:h-10 px-3.5 sm:px-5 text-xs sm:text-sm font-bold rounded-full bg-neutral-900 hover:bg-black text-white flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
                        <span>{t('stock.restore_normal')}</span>
                      </button>
                    )}
                  </div>

                </div>

                {/* Clients sub-list */}
                <div className="mt-3 pt-2.5 border-t border-neutral-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-neutral-400 ml-1">طلبات الزبناء:</span>
                  {prod.clients.map((cli, cIdx) => (
                    <span key={cIdx} className="bg-white border border-neutral-200/80 text-neutral-800 px-2.5 py-1 rounded-full text-xs font-medium shadow-2xs">
                      {cli.clientName} ({cli.quantity})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allocation Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                  <PackageCheck className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">توزيع السلعة الواصلة</h3>
                  <p className="text-xs text-neutral-500">تخصيص الكمية المستلمة للزبناء</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalProduct(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">اسم الكتاب / السلعة:</label>
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 text-xs sm:text-sm font-extrabold text-neutral-900">
                  {modalProduct.productName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  العدد المستلم الفعلي للبدء في توزيعه:
                </label>
                <input
                  ref={modalInputRef}
                  type="number"
                  min="1"
                  required
                  placeholder="0"
                  value={modalQty}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-2xl p-3 text-center text-lg font-black text-neutral-900 focus:outline-none focus:border-neutral-900"
                />
                <p className="text-[11px] text-neutral-400 font-medium mt-1 text-center">
                  المطلوب الإجمالي: {modalProduct.totalMissingQty} قطعة
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalProduct(null)}
                  className="px-3.5 py-1.5 sm:px-5 sm:py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessingModal}
                  className="px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-full shadow-lg shadow-orange-700/20 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {isProcessingModal ? 'جاري التوزيع...' : 'تأكيد التوزيع الفوري'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
