'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  PackageCheck, 
  CheckCircle2, 
  Search, 
  X
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { updateMasterProductStock } from '@/lib/dataStore';

interface StockAllocationProps {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onUpdateItemState: (
    itemId: string, 
    updates: { is_in_stock?: boolean; is_delivered?: boolean }
  ) => Promise<void>;
  onAutoAllocateStock?: (
    productName: string, 
    receivedQty: number
  ) => Promise<{ clientName: string; phone: string; fulfilledQty: number; link: string }[]>;
}

export default function StockAllocation({
  demands,
  masterProducts,
  onUpdateItemState,
  onAutoAllocateStock,
}: StockAllocationProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [processingProduct, setProcessingProduct] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Modal State
  const [modalProduct, setModalProduct] = useState<{ productName: string; totalMissingQty: number } | null>(null);
  const [modalQty, setModalQty] = useState<string>('');
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  const modalInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (modalProduct) {
      setTimeout(() => {
        modalInputRef.current?.focus();
      }, 50);
    }
  }, [modalProduct]);

  // 1. Calculate Active Missing Products Aggregation
  const missingProductsList = useMemo(() => {
    const map: Record<string, {
      productName: string;
      category: string;
      totalMissingQty: number;
      availableStock: number;
      clients: { clientName: string; phone: string; quantity: number; demandCreatedAt: string }[];
    }> = {};

    for (const dem of demands) {
      if (!dem.items || !dem.client) continue;
      for (const item of dem.items) {
        if (!item.is_in_stock && !item.is_delivered) {
          const pName = item.product_name.trim();
          if (!map[pName]) {
            const masterProd = masterProducts.find(
              mp => mp.name.trim().toLowerCase() === pName.toLowerCase()
            );
            map[pName] = {
              productName: pName,
              category: masterProd?.category || 'كتاب مدرسي',
              totalMissingQty: 0,
              availableStock: masterProd?.available_stock || 0,
              clients: [],
            };
          }
          map[pName].totalMissingQty += item.quantity;
          map[pName].clients.push({
            clientName: dem.client.name,
            phone: dem.client.phone,
            quantity: item.quantity,
            demandCreatedAt: dem.created_at || new Date().toISOString(),
          });
        }
      }
    }

    const list = Object.values(map).map(item => ({
      ...item,
      clients: item.clients.sort((a, b) => new Date(a.demandCreatedAt).getTime() - new Date(b.demandCreatedAt).getTime())
    }));

    return list.sort((a, b) => b.totalMissingQty - a.totalMissingQty);
  }, [demands, masterProducts]);

  // Filter missing products by search query
  const filteredMissingProducts = useMemo(() => {
    if (!searchQuery.trim()) return missingProductsList;
    const q = searchQuery.trim().toLowerCase();
    return missingProductsList.filter(
      p => p.productName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [missingProductsList, searchQuery]);

  // Total summary metrics
  const totalMissingItemsCount = missingProductsList.length;
  const totalMissingPiecesCount = missingProductsList.reduce((acc, p) => acc + p.totalMissingQty, 0);

  // Handle Modal Open
  const handleOpenModal = (productName: string, totalMissingQty: number) => {
    setModalProduct({ productName, totalMissingQty });
    setModalQty('');
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
        const targetProd = missingProductsList.find(p => p.productName === productName);

        if (targetProd) {
          for (const cli of targetProd.clients) {
            if (remaining <= 0) break;
            for (const dem of demands) {
              if (remaining <= 0) break;
              if (dem.client?.phone === cli.phone && dem.items) {
                for (const it of dem.items) {
                  if (it.product_name.trim().toLowerCase() === productName.toLowerCase() && !it.is_in_stock && !it.is_delivered) {
                    const needed = it.quantity;
                    await onUpdateItemState(it.id, { is_in_stock: true });
                    remaining -= needed;
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

      // Show lightweight 2.5s Toast notification
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
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
      
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
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
              <strong className="text-slate-900">{totalMissingItemsCount}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-slate-500">القطع المطلوبة:</span>
              <strong className="text-slate-900">{totalMissingPiecesCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN VIEW: Active Missing Products List Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
        
        {/* Search Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <span className="text-sm sm:text-base font-bold text-slate-900">قائمة الخصاصات المطلوب توفيرها</span>

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

        {/* Missing Products List / Table */}
        {filteredMissingProducts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-800 text-xs">جميع كتب هذه الدفعة متوفرة بالكامل</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredMissingProducts.map((item) => {
              const isProcessing = processingProduct === item.productName;

              return (
                <div 
                  key={item.productName}
                  className="border border-slate-200 bg-white hover:border-slate-300 rounded-lg py-2 px-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 transition-colors"
                >
                  {/* Left: Product Name & Required Quantity */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h4 className="text-base font-bold text-slate-900 leading-tight truncate">
                      {item.productName}
                    </h4>
                    <p className="text-sm text-slate-500">
                      الكمية المطلوبة: <strong className="text-slate-800 font-semibold">{item.totalMissingQty} قطعة</strong>
                    </p>
                  </div>

                  {/* Right: Compact Standard Button */}
                  <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-2 md:pt-0 justify-end">
                    <button
                      onClick={() => handleOpenModal(item.productName, item.totalMissingQty)}
                      disabled={isProcessing}
                      className="h-8 px-3.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 w-full md:w-auto shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>{isProcessing ? 'جاري التوزيع...' : 'جاهز'}</span>
                    </button>
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
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                    استلام: {modalProduct.productName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    الكمية المطلوبة: <span className="text-slate-900 font-semibold">{modalProduct.totalMissingQty} قطعة</span>
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
                  className="flex-1 h-8 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
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
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white backdrop-blur-xs shadow-lg border border-slate-700 rounded-xl px-3.5 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-xs tracking-wide">
            تمت إضافة وتوزيع السلعة بنجاح
          </span>
        </div>
      )}

    </div>
  );
}
