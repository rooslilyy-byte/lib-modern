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
import { LanguageProvider, useLanguage } from '@/lib/languageContext';
import { Menu, PanelRightOpen, Phone, Globe } from 'lucide-react';

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

function AppShellContent({ children }: AppShellProps) {
  const router = useRouter();
  const { language, setLanguage, toggleLanguage, t, dir } = useLanguage();
  const [activeBatch, setActiveBatch] = useState<PurchaseBatch | null>(globalAppCache.activeBatch);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>(globalAppCache.masterProducts);
  const [demands, setDemands] = useState<ClientDemand[]>(globalAppCache.demands);
  const [isLoading, setIsLoading] = useState<boolean>(!globalAppCache.isInitialized);

  // Sidebar controls
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const loadData = useCallback(async (isSilent = globalAppCache.isInitialized) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const fullData = await getFullStoreData(isSilent);

      setActiveBatch(fullData.activeBatch);
      setMasterProducts(fullData.masterProducts);
      setDemands(fullData.demands);

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

  const handleCreateDemand = async (name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number) => {
    await createClientDemand(name, phone, items, avanceAmount, totalAmount);
    await loadData(true);
  };

  const handleUpdateDemand = async (id: string, name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number) => {
    await updateClientDemand(id, name, phone, items, avanceAmount, totalAmount);
    await loadData(true);
  };

  const handleUpdateItemState = async (itemId: string, updates: { is_in_stock?: boolean; is_delivered?: boolean }) => {
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
    setDemands(prev => {
      const next = prev.filter(d => d.id !== id && d.client?.id !== id);
      globalAppCache.demands = next;
      return next;
    });

    await deleteClientDemand(id);
    await loadData(true);
  };

  const handleDeleteBulkCustomers = async (clientIds: string[]) => {
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
    <div className={`min-h-[100dvh] bg-[#F8F9FA] flex font-cairo overflow-x-hidden ${dir === 'rtl' ? 'dir-rtl' : 'dir-ltr'}`} suppressHydrationWarning>
      
      {/* Sidebar Component */}
      <Sidebar 
        isSupabaseActive={isSupabaseConfigured}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktopCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      />

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col min-h-[100dvh] w-full transition-all duration-300 ${
          isDesktopCollapsed ? 'lg:mr-0' : 'lg:mr-64'
        }`}
        suppressHydrationWarning
      >
        {/* Top Header Navbar with Mobile Toggle, Central Title, Phone Dial */}
        <header className="sticky top-0 z-20 bg-orange-700 text-white shadow-md border-b border-orange-800 px-2.5 sm:px-6 py-2 sm:py-3 flex items-center justify-between no-print gap-2">
          
          {/* Right Controls in RTL: Hamburger for Mobile & Show Sidebar for Collapsed Desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 text-white hover:bg-orange-800 rounded-full min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center transition-colors"
              title="إظهار القائمة الجانبية"
            >
              <Menu className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </button>

            {/* Desktop Expand Button (Shown when sidebar is collapsed) */}
            {isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(false)}
                className="hidden lg:flex items-center gap-2 p-1.5 sm:p-2 rounded-full text-white hover:bg-orange-800 transition-all min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] justify-center"
                title="إظهار القائمة الجانبية"
              >
                <PanelRightOpen className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </button>
            )}

            {/* Top Brand Tag */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <img
                src="/logo no background.png"
                alt="Lib Moderne"
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
              />
              <div className="hidden xl:block">
                <h2 className="font-black text-xs text-white leading-tight">المكتبة العصرية</h2>
                <span className="text-[10px] text-orange-100 font-bold block leading-none">Lib Moderne</span>
              </div>
            </div>
          </div>

          {/* Central Title */}
          <div className="flex-1 text-center px-1 sm:px-2 min-w-0">
            <h1 className="text-xs sm:text-lg md:text-xl font-black text-white tracking-tight leading-tight drop-shadow-xs truncate">
              نظام إدارة المكتبة العصرية
            </h1>
            <p className="hidden md:block text-[11px] font-bold text-orange-100 mt-0.5">
              Lib Moderne • نظام تدبير وتوزيع خصاصات الدخول المدرسي
            </p>
          </div>

          {/* Left Controls in RTL: Quick Contacts */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Phone Quick Dial Pill */}
            <a
              dir="ltr"
              href="tel:+212660563371"
              className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-mono font-black text-orange-700 bg-white hover:bg-orange-50 px-2.5 py-1 sm:px-4 sm:py-2 rounded-full transition-all shadow-xs border border-white/80 min-h-[32px] sm:min-h-[40px]"
              title="اتصال سريع بالمكتبة"
            >
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700 shrink-0" />
              <span className="hidden sm:inline">06.60.56.33.71</span>
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6" suppressHydrationWarning>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-28 space-y-4">
              <div className="w-12 h-12 border-4 border-neutral-900 border-t-orange-700 rounded-full animate-spin shadow-md"></div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-800">جاري تحميل بيانات المكتبة العصرية...</p>
                <p className="text-xs text-neutral-400 mt-1 font-semibold">Lib Moderne POS</p>
              </div>
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

        {/* Footer */}
        <footer className="bg-white/80 backdrop-blur-md text-neutral-500 text-xs py-4 border-t border-neutral-200/80 mt-auto no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <p className="font-bold text-neutral-800 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span>{t('brand.full')}</span>
              <span className="text-neutral-300">•</span>
              <span className="text-neutral-600">الهاتف:</span>
              <span dir="ltr" className="font-mono text-neutral-900 font-bold">06.60.56.33.71 / 06.60.31.98.68</span>
            </p>
            <p className="text-neutral-400 font-medium">© {new Date().getFullYear()} Lib Moderne POS.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <LanguageProvider>
      <AppShellContent>{children}</AppShellContent>
    </LanguageProvider>
  );
}
