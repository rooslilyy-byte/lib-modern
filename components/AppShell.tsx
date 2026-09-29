'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  restoreProductEnRupture,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  createSchoolList,
  updateSchoolList,
  deleteSchoolList,
  linkSchoolListClient,
  convertSchoolListToClient,
  updateProductCategory
} from '@/lib/dataStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { PurchaseBatch, MasterProduct, ClientDemand, Employee, SchoolList, SchoolListStatus } from '@/lib/types';
import { LanguageProvider, useLanguage } from '@/lib/languageContext';
import { Menu, PanelRightOpen, Phone, Globe } from 'lucide-react';

// Module-level SWR Cache for Instant (<10ms) Tab Navigation
let globalAppCache: {
  activeBatch: PurchaseBatch | null;
  masterProducts: MasterProduct[];
  demands: ClientDemand[];
  employees: Employee[];
  schoolLists: SchoolList[];
  isInitialized: boolean;
} = {
  activeBatch: null,
  masterProducts: [],
  demands: [],
  employees: [],
  schoolLists: [],
  isInitialized: false,
};

export interface AppShellData {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  employees: Employee[];
  schoolLists: SchoolList[];
  activeBatch: PurchaseBatch | null;
  isLoading: boolean;
  loadData: () => Promise<void>;
  handleCreateDemand: (name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number, ticketId?: string) => Promise<void>;
  handleUpdateDemand: (id: string, name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number, ticketId?: string) => Promise<void>;
  handleUpdateItemState: (id: string, updates: any) => Promise<void>;
  handleAutoAllocateStock: (productName: string, receivedQty: number) => Promise<{ clientName: string; phone: string; fulfilledQty: number; link: string }[]>;
  handleMarkEnRupture: (productName: string) => Promise<void>;
  handleRestoreEnRupture: (productName: string) => Promise<void>;
  handleDeleteDemand: (id: string) => Promise<void>;
  handleDeleteBulkCustomers: (clientIds: string[]) => Promise<void>;
  handleArchiveBatch: (name: string) => Promise<void>;
  handleCreateEmployee: (name: string) => Promise<Employee>;
  handleUpdateEmployee: (id: string, name: string) => Promise<Employee>;
  handleDeleteEmployee: (id: string) => Promise<void>;
  handleCreateSchoolList: (payload: { client_name: string; school_name: string; phone?: string | null; employee_id?: string | null; status?: SchoolListStatus; client_id?: string | null }) => Promise<SchoolList>;
  handleUpdateSchoolList: (id: string, updates: Partial<SchoolList>) => Promise<SchoolList>;
  handleDeleteSchoolList: (id: string) => Promise<void>;
  handleLinkSchoolListClient: (listId: string, clientId: string | null) => Promise<SchoolList>;
  handleConvertSchoolListToClient: (listId: string) => Promise<{ clientId: string; demandId: string; schoolList: SchoolList }>;
  handleUpdateProductCategory: (productId: string, category: string, productName?: string) => Promise<MasterProduct>;
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
  const [employees, setEmployees] = useState<Employee[]>(globalAppCache.employees);
  const [schoolLists, setSchoolLists] = useState<SchoolList[]>(globalAppCache.schoolLists);
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
      setEmployees(fullData.employees || []);
      setSchoolLists(fullData.schoolLists || []);

      globalAppCache = {
        activeBatch: fullData.activeBatch,
        masterProducts: fullData.masterProducts,
        demands: fullData.demands,
        employees: fullData.employees || [],
        schoolLists: fullData.schoolLists || [],
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

  const handleCreateDemand = useCallback(async (name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number, ticketId?: string) => {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanTicketId = (ticketId || '').trim() || null;
    const tempId = 'temp-' + Date.now();
    const validItems = (Array.isArray(items) ? items : []).filter(it => it && it.product_name && it.product_name.trim());
    
    // Optimistic Demand Insertion
    const optimisticDemand: ClientDemand = {
      id: tempId,
      client_id: 'client-' + tempId,
      batch_id: activeBatch?.id || 'batch-001',
      status: 'pending',
      created_at: new Date().toISOString(),
      avance_amount: avanceAmount || 0,
      total_amount: totalAmount || 0,
      client: {
        id: 'client-' + tempId,
        name: cleanName,
        phone: cleanPhone,
        ticket_id: cleanTicketId,
        created_at: new Date().toISOString(),
      },
      items: validItems.map((it, idx) => ({
        id: `item-${tempId}-${idx}`,
        demand_id: tempId,
        product_name: it.product_name.trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        fulfilled_quantity: 0,
        is_in_stock: false,
        is_delivered: false,
        status: 'pending',
      })),
    };

    setDemands(prev => {
      const next = [optimisticDemand, ...prev];
      globalAppCache.demands = next;
      return next;
    });

    try {
      await createClientDemand(name, phone, validItems, avanceAmount, totalAmount, ticketId);
    } finally {
      await loadData(true);
    }
  }, [activeBatch, loadData]);

  const handleUpdateDemand = useCallback(async (id: string, name: string, phone: string, items: any[], avanceAmount?: number, totalAmount?: number, ticketId?: string) => {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanTicketId = ticketId !== undefined ? (ticketId.trim() || null) : undefined;
    const validItems = (Array.isArray(items) ? items : []).filter(it => it && it.product_name && it.product_name.trim());

    // Optimistic Demand Update
    setDemands(prev => {
      const next = prev.map(dem => {
        if (dem.id !== id && dem.client?.id !== id) return dem;
        const updatedItems = validItems.map((it, idx) => ({
          id: it.id || `item-upd-${id}-${idx}`,
          demand_id: dem.id,
          product_name: it.product_name.trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          fulfilled_quantity: Number(it.fulfilled_quantity) || 0,
          is_in_stock: Boolean(it.is_in_stock),
          is_delivered: Boolean(it.is_delivered),
          status: it.status || (it.is_in_stock ? 'ready' : 'pending'),
        }));

        return {
          ...dem,
          avance_amount: avanceAmount !== undefined ? avanceAmount : dem.avance_amount,
          total_amount: totalAmount !== undefined ? totalAmount : dem.total_amount,
          client: {
            id: dem.client?.id || dem.client_id || ('client-' + dem.id),
            name: cleanName,
            phone: cleanPhone,
            ticket_id: cleanTicketId !== undefined ? cleanTicketId : (dem.client?.ticket_id || null),
            created_at: dem.client?.created_at || new Date().toISOString(),
          },
          items: updatedItems,
        };
      });
      globalAppCache.demands = next;
      return next;
    });

    try {
      await updateClientDemand(id, name, phone, validItems, avanceAmount, totalAmount, ticketId);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleUpdateItemState = useCallback(async (itemId: string, updates: { is_in_stock?: boolean; is_delivered?: boolean }) => {
    setDemands(prev => {
      const next = prev.map(dem => ({
        ...dem,
        items: dem.items?.map(it => it.id === itemId ? { ...it, ...updates } : it)
      }));
      globalAppCache.demands = next;
      return next;
    });

    try {
      await updateDemandItemState(itemId, updates);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleAutoAllocateStock = useCallback(async (productName: string, receivedQty: number) => {
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
    return res;
  }, [loadData]);

  const handleMarkEnRupture = useCallback(async (productName: string) => {
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
  }, [loadData]);

  const handleRestoreEnRupture = useCallback(async (productName: string) => {
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
  }, [loadData]);

  const handleDeleteDemand = useCallback(async (id: string) => {
    setDemands(prev => {
      const next = prev.filter(d => d.id !== id && d.client?.id !== id);
      globalAppCache.demands = next;
      return next;
    });

    try {
      await deleteClientDemand(id);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleDeleteBulkCustomers = useCallback(async (clientIds: string[]) => {
    setDemands(prev => {
      const next = prev.filter(d => d.client?.id && !clientIds.includes(d.client.id));
      globalAppCache.demands = next;
      return next;
    });

    try {
      await deleteBulkCustomers(clientIds);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleArchiveBatch = useCallback(async (newBatchName: string) => {
    try {
      await archiveActiveBatch(newBatchName);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  // --- EMPLOYEES HANDLERS ---
  const handleCreateEmployee = useCallback(async (name: string) => {
    const tempId = `emp-${Date.now()}`;
    const optimisticEmp: Employee = { id: tempId, name: name.trim(), created_at: new Date().toISOString() };
    setEmployees(prev => {
      const next = [...prev, optimisticEmp];
      globalAppCache.employees = next;
      return next;
    });

    try {
      const res = await createEmployee(name);
      if (res && res.id) {
        setEmployees(prev => {
          const next = prev.map(e => e.id === tempId ? res : e);
          globalAppCache.employees = next;
          return next;
        });
      }
      return res;
    } catch (err) {
      await loadData(true);
      throw err;
    }
  }, [loadData]);

  const handleUpdateEmployee = useCallback(async (id: string, name: string) => {
    setEmployees(prev => {
      const next = prev.map(e => e.id === id ? { ...e, name: name.trim() } : e);
      globalAppCache.employees = next;
      return next;
    });

    try {
      const res = await updateEmployee(id, name);
      return res;
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleDeleteEmployee = useCallback(async (id: string) => {
    setEmployees(prev => {
      const next = prev.filter(e => e.id !== id);
      globalAppCache.employees = next;
      return next;
    });

    try {
      await deleteEmployee(id);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  // --- SCHOOL LISTS HANDLERS ---
  const handleCreateSchoolList = useCallback(async (payload: {
    client_name: string;
    school_name: string;
    phone?: string | null;
    employee_id?: string | null;
    status?: SchoolListStatus;
    client_id?: string | null;
  }) => {
    const tempId = `list-${Date.now()}`;
    const assignedEmp = employees.find(e => e.id === payload.employee_id);
    const linkedClient = demands.find(d => d.client?.id === payload.client_id)?.client;
    const optimisticList: SchoolList = {
      id: tempId,
      client_name: payload.client_name.trim(),
      school_name: payload.school_name.trim(),
      phone: payload.phone || null,
      employee_id: payload.employee_id || null,
      status: payload.status || 'pending',
      client_id: payload.client_id || null,
      created_at: new Date().toISOString(),
      employee: assignedEmp,
      client: linkedClient,
    };

    setSchoolLists(prev => {
      const next = [optimisticList, ...prev];
      globalAppCache.schoolLists = next;
      return next;
    });

    try {
      const res = await createSchoolList(payload);
      if (res && res.id) {
        setSchoolLists(prev => {
          const next = prev.map(l => l.id === tempId ? res : l);
          globalAppCache.schoolLists = next;
          return next;
        });
      }
      return res;
    } catch (err) {
      await loadData(true);
      throw err;
    }
  }, [employees, demands, loadData]);

  const handleUpdateSchoolList = useCallback(async (id: string, updates: Partial<SchoolList>) => {
    setSchoolLists(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      globalAppCache.schoolLists = next;
      return next;
    });

    try {
      const res = await updateSchoolList(id, updates);
      return res;
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleDeleteSchoolList = useCallback(async (id: string) => {
    setSchoolLists(prev => {
      const next = prev.filter(l => l.id !== id);
      globalAppCache.schoolLists = next;
      return next;
    });

    try {
      await deleteSchoolList(id);
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleLinkSchoolListClient = useCallback(async (listId: string, clientId: string | null) => {
    const linkedClient = demands.find(d => d.client?.id === clientId)?.client;
    setSchoolLists(prev => {
      const next = prev.map(l => l.id === listId ? {
        ...l,
        client_id: clientId || null,
        client: linkedClient,
        status: clientId ? 'pending' : l.status,
      } : l);
      globalAppCache.schoolLists = next;
      return next;
    });

    try {
      const res = await linkSchoolListClient(listId, clientId);
      return res;
    } finally {
      await loadData(true);
    }
  }, [demands, loadData]);

  const handleConvertSchoolListToClient = useCallback(async (listId: string) => {
    try {
      const res = await convertSchoolListToClient(listId);
      if (res && res.schoolList) {
        setSchoolLists(prev => {
          const next = prev.map(l => l.id === listId ? res.schoolList : l);
          globalAppCache.schoolLists = next;
          return next;
        });
      }
      return res;
    } finally {
      await loadData(true);
    }
  }, [loadData]);

  const handleUpdateProductCategory = useCallback(async (productId: string, category: string, productName?: string) => {
    // Optimistic master product update
    setMasterProducts(prev => {
      const next = prev.map(p => {
        if ((productId && p.id === productId) || (productName && p.name.trim().toLowerCase() === productName.trim().toLowerCase())) {
          return { ...p, category };
        }
        return p;
      });
      globalAppCache.masterProducts = next;
      return next;
    });

    try {
      const updated = await updateProductCategory(productId, category, productName);
      setMasterProducts(prev => {
        const next = prev.map(p => {
          if ((productId && p.id === productId) || (productName && p.name.trim().toLowerCase() === productName.trim().toLowerCase())) {
            return { ...p, ...updated, category: updated.category || category };
          }
          return p;
        });
        globalAppCache.masterProducts = next;
        return next;
      });
      return updated;
    } catch (err) {
      await loadData(true);
      throw err;
    }
  }, [loadData]);

  const appShellData: AppShellData = useMemo(() => ({
    demands,
    masterProducts,
    employees,
    schoolLists,
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
    handleCreateEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleCreateSchoolList,
    handleUpdateSchoolList,
    handleDeleteSchoolList,
    handleLinkSchoolListClient,
    handleConvertSchoolListToClient,
    handleUpdateProductCategory,
  }), [
    demands,
    masterProducts,
    employees,
    schoolLists,
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
    handleCreateEmployee,
    handleUpdateEmployee,
    handleDeleteEmployee,
    handleCreateSchoolList,
    handleUpdateSchoolList,
    handleDeleteSchoolList,
    handleLinkSchoolListClient,
    handleConvertSchoolListToClient,
    handleUpdateProductCategory,
  ]);

  return (
    <div className={`min-h-screen w-full max-w-full bg-[#F8F9FA] flex font-cairo overflow-x-hidden ${dir === 'rtl' ? 'dir-rtl' : 'dir-ltr'}`} suppressHydrationWarning>
      
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
        className={`flex-1 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden transition-all duration-300 ${
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
        <main className="flex-1 flex-grow max-w-7xl w-full max-w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden" suppressHydrationWarning>
          {isLoading ? (
            <div className="space-y-5 animate-pulse">
              <div className="h-28 bg-white/60 backdrop-blur-md rounded-3xl border border-white/60 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-200 rounded-2xl"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-neutral-200 rounded-full w-48"></div>
                  <div className="h-3 bg-neutral-100 rounded-full w-32"></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-white/60 backdrop-blur-md rounded-3xl border border-white/60 p-4 space-y-3">
                    <div className="h-3 bg-neutral-200 rounded-full w-24"></div>
                    <div className="h-6 bg-neutral-200 rounded-full w-16"></div>
                  </div>
                ))}
              </div>
              <div className="h-64 bg-white/60 backdrop-blur-md rounded-3xl border border-white/60 p-6 space-y-4">
                <div className="h-4 bg-neutral-200 rounded-full w-40"></div>
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-neutral-100 rounded-2xl w-full"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            children(appShellData)
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
