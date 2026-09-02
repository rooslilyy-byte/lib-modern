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
  AlertCircle
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { updateMasterProductStock } from '@/lib/dataStore';

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
  onUpdateItemState,
  onAutoAllocateStock,
  onMarkEnRupture,
  onRestoreEnRupture,
}: StockAllocationProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('normal');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingProduct, setProcessingProduct] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [modalProduct, setModalProduct] = useState<{ productName: string; totalMissingQty: number } | null>(null);
  const [modalQty, setModalQty] = useState<string>('');
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  // Local demands state for instantaneous UI updates without snapping back
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

  // 1. Calculate Active Missing Products Aggregation (Partition Normal vs En Rupture)
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
            continue; // Fully fulfilled row, no longer missing
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

  // Helper to detect Arabic text
  const isArabic = (str: string) => /[\u0600-\u06FF]/.test(str);

  // Sorting Function
  const sortAggregatedProducts = (list: AggregatedProduct[], sort: SortOption) => {
    return [...list].sort((a, b) => {
      if (sort === 'alphabetical') {
        const aArabic = isArabic(a.productName);
        const bArabic = isArabic(b.productName);

        // Arabic product names first (أ to ي), followed by Latin names (A to Z)
        if (aArabic && !bArabic) return -1;
        if (!aArabic && bArabic) return 1;

        if (aArabic && bArabic) {
          return a.productName.localeCompare(b.productName, 'ar', { sensitivity: 'base' });
        }
        return a.productName.localeCompare(b.productName, 'fr', { sensitivity: 'base' });
      }

      if (sort === 'oldest') {
        // Ascending order based on initial demand creation time
        const timeA = new Date(a.initialDemandCreatedAt).getTime() || 0;
        const timeB = new Date(b.initialDemandCreatedAt).getTime() || 0;
        return timeA - timeB;
      }

      if (sort === 'newest') {
        // Descending order based on latest demand creation time
        const timeA = new Date(a.latestDemandCreatedAt).getTime() || 0;
        const timeB = new Date(b.latestDemandCreatedAt).getTime() || 0;
        return timeB - timeA;
      }

      return 0;
    });
  };

  // Filter and sort products based on active tab, search query, and selected sort
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

  // Metrics for active view
  const currentTotalItems = displayedProducts.length;
  const currentTotalPieces = displayedProducts.reduce((acc, p) => acc + p.totalMissingQty, 0);

  // Summary counts for badges
  const totalNormalItems = normalProductsList.length;
  const totalRuptureItems = ruptureProductsList.length;

  // Handle Modal Open
  const handleOpenModal = (productName: string, totalMissingQty: number) => {
    setModalProduct({ productName, totalMissingQty });
    setModalQty('');
  };

  // Handle Mark Product En Rupture
  const handleMarkEnRupture = async (productName: string) => {
    const cleanName = productName.trim().toLowerCase();
    setProcessingProduct(productName);

    // 1. Immediately & synchronously update local React state
    setLocalDemands(prev =>
      prev.map(dem => {
        if (!dem.items) return dem;
        return {
          ...dem,
          items: dem.items.map(it => {
            if (it.product_name.trim().toLowerCase() === cleanName && !it.is_in_stock && !it.is_delivered) {
              return { ...it, status: 'en_rupture' as const };
            }
            return it;
          })
        };
      })
    );

    try {
      if (onMarkEnRupture) {
        await onMarkEnRupture(productName);
      }
      setToastMessage(`تم وسم "${productName}" كغير متوفر ونقلها إلى قائمة السلع غير المتوفرة`);
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Error marking product en rupture:', err);
      alert('حدث خطأ أثناء تغيير حالة السلعة، يرجى المحاولة مرة أخرى.');
      // Revert if error occurs
      setLocalDemands(demands);
    } finally {
      setProcessingProduct(null);
    }
  };

  // Handle Restore Product from Rupture
  const handleRestoreEnRupture = async (productName: string) => {
    const cleanName = productName.trim().toLowerCase();
    setProcessingProduct(productName);

    // 1. Immediately & synchronously update local React state
    setLocalDemands(prev =>
      prev.map(dem => {
        if (!dem.items) return dem;
        return {
          ...dem,
          items: dem.items.map(it => {
            if (it.product_name.trim().toLowerCase() === cleanName && it.status === 'en_rupture') {
              return { ...it, status: 'pending' as const };
            }
            return it;
          })
        };
      })
    );

    try {
      if (onRestoreEnRupture) {
        await onRestoreEnRupture(productName);
      }
      setToastMessage(`تمت إعادة "${productName}" إلى قائمة الخصاصات العادية`);
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Error restoring product:', err);
      alert('حدث خطأ أثناء استرجاع السلعة، يرجى المحاولة مرة أخرى.');
      setLocalDemands(demands);
    } finally {
      setProcessingProduct(null);
    }
  };

  // Handle Allocation Submit from Modal
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProduct) return;

    const parsedQty = parseInt(modalQty.trim(), 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      alert('يرجى إدخال كمية مستلمة صحيحة أكبر من الصفر');
      return;
    }

    const productName = modalProduct.productName;
    setProcessingProduct(productName);
    setIsProcessingModal(true);

    try {
      if (onAutoAllocateStock) {
        await onAutoAllocateStock(productName, parsedQty);
      } else {
        // Fallback manually if onAutoAllocateStock is not provided
        let remaining = parsedQty;
        const allPending = [...normalProductsList, ...ruptureProductsList];
        const targetProd = allPending.find(p => p.productName === productName);

        if (targetProd) {
          for (const cli of targetProd.clients) {
            if (remaining <= 0) break;
            for (const dem of localDemands) {
              if (remaining <= 0) break;
              if (dem.client?.phone === cli.phone && dem.items) {
                for (const it of dem.items) {
                  if (it.product_name.trim().toLowerCase() === productName.toLowerCase() && !it.is_in_stock && !it.is_delivered) {
                    const currentFulfilled = Number(it.fulfilled_quantity || 0);
                    const totalQty = Number(it.quantity) || 0;
                    const needed = Math.max(0, totalQty - currentFulfilled);
                    if (needed <= 0) continue;

                    if (remaining >= needed) {
                      await onUpdateItemState(it.id, { is_in_stock: true, fulfilled_quantity: totalQty });
                      remaining -= needed;
                    } else {
                      const newFulfilled = currentFulfilled + remaining;
                      await onUpdateItemState(it.id, { is_in_stock: false, fulfilled_quantity: newFulfilled });
                      remaining = 0;
                      break;
                    }
                  }
                }
              }
            }
          }
          if (remaining > 0) {
            await updateMasterProductStock(productName, remaining);
          }
        }
      }

      setModalProduct(null);
      setModalQty('');

      // Show Toast notification
      setToastMessage('تمت إضافة وتوزيع السلعة بنجاح');
      setTimeout(() => {
        setToastMessage(null);
      }, 2500);

    } catch (err) {
      console.error('Error allocating stock:', err);
      alert('حدث خطأ أثناء تخصيص السلعة، يرجى إعادة المحاولة.');
    } finally {
      setProcessingProduct(null);
      setIsProcessingModal(false);
    }
  };

  return (
    <div className="space-y-3 relative">
      
      {/* 1. Header Banner & Section Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">توزيع واستقبال السلع</h2>
              <p className="text-[11px] text-slate-500">توزيع مباشر للسلع الواصلة على الزبناء حسب الأسبقية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-slate-500">العناوين:</span>
              <strong className="text-slate-900">{currentTotalItems}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-slate-500">القطع المطلوبة:</span>
              <strong className="text-slate-900">{currentTotalPieces}</strong>
            </div>
          </div>
        </div>

        {/* Section Switcher: Normal Pending vs Out of Stock */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('normal')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md transition-all ${
              activeTab === 'normal'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>قائمة الخصاصات العادية</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {totalNormalItems}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rupture')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md transition-all ${
              activeTab === 'rupture'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>سلع غير متوفرة</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'rupture' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {totalRuptureItems}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MAIN VIEW: Products List Table with Sort & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
        
        {/* Search & Sort Filter Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <span className="text-base font-bold text-slate-800">
            {activeTab === 'normal' ? 'قائمة الخصاصات المطلوب توفيرها' : 'سلع غير متوفرة (Out of stock)'}
          </span>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Minimalist Sorting Dropdown */}
            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 h-8 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-slate-800 transition-colors cursor-pointer appearance-none"
              >
                <option value="alphabetical">أبجدياً (أ - ي ثم A - Z)</option>
                <option value="oldest">الطلب الأقدم أولاً</option>
                <option value="newest">الطلب الأحدث أولاً</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="البحث بالاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 h-8 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-medium transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Missing Products List / Table */}
        {displayedProducts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-800 text-xs">
              {activeTab === 'normal' 
                ? 'جميع كتب هذه الدفعة متوفرة بالكامل' 
                : 'لا توجد سلع مسجلة كغير متوفرة حالياً'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedProducts.map((item) => {
              const isProcessing = processingProduct === item.productName;

              return (
                <div 
                  key={item.productName}
                  className="border border-slate-200 bg-white hover:border-slate-300 rounded-lg py-2.5 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 transition-colors"
                >
                  {/* Left: Product Name & Required Quantity */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-slate-900 leading-tight truncate">
                        {item.productName}
                      </h4>
                      {activeTab === 'rupture' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          غير متوفر
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      الكمية المطلوبة: <strong className="text-slate-800 font-semibold">{item.totalMissingQty} قطعة</strong>
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className="text-xs text-slate-400">
                        {item.clients.length} {item.clients.length === 1 ? 'زبون' : 'زبناء'}
                      </span>
                    </p>
                  </div>

                  {/* Right: Action Buttons (Mobile-Responsive 50/50 Grid, Desktop Flex) */}
                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center mt-3 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                    
                    {/* Blue Ready (جاهز) Button */}
                    <button
                      onClick={() => handleOpenModal(item.productName, item.totalMissingQty)}
                      disabled={isProcessing}
                      className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 w-full sm:w-auto shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                      <span className="truncate">{isProcessing ? 'جاري...' : 'جاهز'}</span>
                    </button>

                    {/* In Normal Tab: Green 'غير متوفر' Button */}
                    {activeTab === 'normal' ? (
                      <button
                        onClick={() => handleMarkEnRupture(item.productName)}
                        disabled={isProcessing}
                        title="وسم السلعة كغير متوفرة ونقلها لقسم سلع غير متوفرة"
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 w-full sm:w-auto shrink-0"
                      >
                        <Ban className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="truncate">غير متوفر</span>
                      </button>
                    ) : (
                      /* In Rupture Tab: Restore Button */
                      <button
                        onClick={() => handleRestoreEnRupture(item.productName)}
                        disabled={isProcessing}
                        title="إلغاء الانقطاع وإعادة السلعة لقائمة الخصاصات العادية"
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 w-full sm:w-auto shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate">إلغاء الانقطاع</span>
                      </button>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 3. Confirmation Input Modal */}
      {modalProduct && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalProduct(null);
              setModalQty('');
            }
          }}
        >
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xl max-w-sm w-full space-y-3.5 text-right relative animate-in zoom-in-95 duration-150" dir="rtl">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                    استلام: {modalProduct.productName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الكمية المطلوبة: <span className="text-blue-700 font-semibold">{modalProduct.totalMissingQty} قطعة</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalProduct(null);
                  setModalQty('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleModalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  عدد القطع المستلمة:
                </label>
                <input
                  ref={modalInputRef}
                  type="number"
                  min="1"
                  autoFocus
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="الكمية..."
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg h-9 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-slate-800 transition-colors text-center"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isProcessingModal}
                  className="flex-1 h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isProcessingModal ? 'جاري...' : 'تأكيد'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalProduct(null);
                    setModalQty('');
                  }}
                  className="h-8 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 4. Sleek Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white backdrop-blur-xs shadow-lg border border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 max-w-md text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-xs tracking-wide">
            {toastMessage}
          </span>
        </div>
      )}

    </div>
  );
}
