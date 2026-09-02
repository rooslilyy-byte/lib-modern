'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { 
  getFullStoreData,
  invalidateStoreCache,
  getActiveBatch, 
  archiveActiveBatch, 
  getMasterProducts, 
  getClientDemands, 
  createClientDemand, 
  updateClientDemand,
  updateDemandItemState, 
  deleteClientDemand,
  deleteBulkCustomers,
  autoAllocateStock,
  markProductEnRupture,
  restoreProductEnRupture
} from '@/lib/dataStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { PurchaseBatch, MasterProduct, ClientDemand } from '@/lib/types';

// Module-level SWR Cache for Instant (<10ms) Tab Navigation
let globalAppCache: {
  activeBatch: PurchaseBatch | null;
  masterProducts: MasterProduct[];
  demands: ClientDemand[];
  isInitialized: boolean;
} = {
  activeBatch: null,
  masterProducts: [],
  demands: [],
  isInitialized: false,
};

export interface AppShellData {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  activeBatch: PurchaseBatch | null;
  isLoading: boolean;
  loadData: () => Promise<void>;
  handleCreateDemand: (name: string, phone: string, items: any[]) => Promise<void>;
  handleUpdateDemand: (id: string, name: string, phone: string, items: any[]) => Promise<void>;
  handleUpdateItemState: (id: string, updates: any) => Promise<void>;
  handleAutoAllocateStock: (productName: string, receivedQty: number) => Promise<{ clientName: string; phone: string; fulfilledQty: number; link: string }[]>;
  handleMarkEnRupture: (productName: string) => Promise<void>;
  handleRestoreEnRupture: (productName: string) => Promise<void>;
  handleDeleteDemand: (id: string) => Promise<void>;
  handleDeleteBulkCustomers: (clientIds: string[]) => Promise<void>;
  handleArchiveBatch: (name: string) => Promise<void>;
}

interface AppShellProps {
  children: (data: AppShellData) => React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [activeBatch, setActiveBatch] = useState<PurchaseBatch | null>(globalAppCache.activeBatch);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>(globalAppCache.masterProducts);
  const [demands, setDemands] = useState<ClientDemand[]>(globalAppCache.demands);
  const [isLoading, setIsLoading] = useState<boolean>(!globalAppCache.isInitialized);

  const loadData = useCallback(async (isSilent = globalAppCache.isInitialized) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const fullData = await getFullStoreData(isSilent);

      setActiveBatch(fullData.activeBatch);
      setMasterProducts(fullData.masterProducts);
      setDemands(fullData.demands);

      // Update global SWR cache
      globalAppCache = {
        activeBatch: fullData.activeBatch,
        masterProducts: fullData.masterProducts,
        demands: fullData.demands,
        isInitialized: true,
      };
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDemand = async (name: string, phone: string, items: any[]) => {
    await createClientDemand(name, phone, items);
    await loadData(true);
  };

  const handleUpdateDemand = async (id: string, name: string, phone: string, items: any[]) => {
    await updateClientDemand(id, name, phone, items);
    await loadData(true);
  };

  const handleUpdateItemState = async (itemId: string, updates: { is_in_stock?: boolean; is_delivered?: boolean }) => {
    // Optimistic item update
    setDemands(prev => {
      const next = prev.map(dem => ({
        ...dem,
        items: dem.items?.map(it => it.id === itemId ? { ...it, ...updates } : it)
      }));
      globalAppCache.demands = next;
      return next;
    });

    await updateDemandItemState(itemId, updates);
    await loadData(true);
  };

  const handleAutoAllocateStock = async (productName: string, receivedQty: number) => {
    // OPTIMISTIC LOCAL ALLOCATION UPDATE WITH PROGRESSIVE FULFILLMENT
    const cleanName = productName.trim().toLowerCase();
    let remaining = Math.max(1, Math.floor(receivedQty));

    setDemands(prev => {
      const sortedDemands = [...prev].sort((a, b) => 
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );

      const updated = sortedDemands.map(dem => {
        if (!dem.items || remaining <= 0) return dem;
        const newItems = dem.items.map(it => {
          if (remaining <= 0) return it;
          if (it.product_name.trim().toLowerCase() === cleanName && !it.is_in_stock && !it.is_delivered) {
            const currentFulfilled = Number(it.fulfilled_quantity || 0);
            const totalQty = Number(it.quantity) || 0;
            const stillNeeded = Math.max(0, totalQty - currentFulfilled);

            if (stillNeeded <= 0) return it;

            if (remaining < stillNeeded) {
              const newFulfilled = currentFulfilled + remaining;
              remaining = 0;
              return { ...it, fulfilled_quantity: newFulfilled, is_in_stock: false };
            } else {
              remaining -= stillNeeded;
              return { ...it, fulfilled_quantity: totalQty, is_in_stock: true };
            }
          }
          return it;
        });
        return { ...dem, items: newItems };
      });

      globalAppCache.demands = updated;
      return updated;
    });

    const res = await autoAllocateStock(productName, receivedQty);
    await loadData(true);
    router.refresh();
    return res;
  };

  const handleMarkEnRupture = async (productName: string) => {
    const cleanName = productName.trim().toLowerCase();
    // Optimistic item update to en_rupture
    setDemands(prev => {
      const updated = prev.map(dem => {
        if (!dem.items) return dem;
        const newItems = dem.items.map(it => {
          if (it.product_name.trim().toLowerCase() === cleanName && !it.is_in_stock && !it.is_delivered) {
            return { ...it, status: 'en_rupture' as const };
          }
          return it;
        });
        return { ...dem, items: newItems };
      });
      globalAppCache.demands = updated;
      return updated;
    });

    invalidateStoreCache();
    await markProductEnRupture(productName);
    invalidateStoreCache();
    await loadData(true);
    router.refresh();
  };

  const handleRestoreEnRupture = async (productName: string) => {
    const cleanName = productName.trim().toLowerCase();
    // Optimistic item update back to pending
    setDemands(prev => {
      const updated = prev.map(dem => {
        if (!dem.items) return dem;
        const newItems = dem.items.map(it => {
          if (it.product_name.trim().toLowerCase() === cleanName && it.status === 'en_rupture') {
            return { ...it, status: 'pending' as const };
          }
          return it;
        });
        return { ...dem, items: newItems };
      });
      globalAppCache.demands = updated;
      return updated;
    });

    invalidateStoreCache();
    await restoreProductEnRupture(productName);
    invalidateStoreCache();
    await loadData(true);
    router.refresh();
  };

  const handleDeleteDemand = async (id: string) => {
    // Optimistically filter out deleted demand
    setDemands(prev => {
      const next = prev.filter(d => d.id !== id && d.client?.id !== id);
      globalAppCache.demands = next;
      return next;
    });

    await deleteClientDemand(id);
    await loadData(true);
  };

  const handleDeleteBulkCustomers = async (clientIds: string[]) => {
    // Optimistically filter out deleted clients
    setDemands(prev => {
      const next = prev.filter(d => d.client?.id && !clientIds.includes(d.client.id));
      globalAppCache.demands = next;
      return next;
    });

    await deleteBulkCustomers(clientIds);
    await loadData(true);
  };

  const handleArchiveBatch = async (newBatchName: string) => {
    await archiveActiveBatch(newBatchName);
    await loadData(true);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex font-cairo dir-rtl overflow-x-hidden" suppressHydrationWarning>
      <Sidebar isSupabaseActive={isSupabaseConfigured} />

      <div className="flex-1 lg:mr-64 flex flex-col min-h-[100dvh] pt-14 lg:pt-0 w-full" suppressHydrationWarning>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" suppressHydrationWarning>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-600">جاري تحميل بيانات شركة إيزوران...</p>
            </div>
          ) : (
            children({
              demands,
              masterProducts,
              activeBatch,
              isLoading,
              loadData,
              handleCreateDemand,
              handleUpdateDemand,
              handleUpdateItemState,
              handleAutoAllocateStock,
              handleMarkEnRupture,
              handleRestoreEnRupture,
              handleDeleteDemand,
              handleDeleteBulkCustomers,
              handleArchiveBatch,
            })
          )}
        </main>

        <footer className="bg-white text-slate-500 text-xs py-4 text-center border-t border-slate-200 mt-auto no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-bold text-slate-700">
              شركة إيزوران — الهاتف: <span dir="ltr" className="font-mono text-slate-700">+212 661-556418</span>
            </p>
            <p>© {new Date().getFullYear()} نظام متابعة وتوزيع خصاصات الدخول المدرسي POS.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
