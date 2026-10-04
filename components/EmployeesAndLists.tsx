'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  Link2,
  Unlink,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserPlus,
  AlertCircle,
  Phone,
  Check,
  X,
  UserCheck,
  Building,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Calendar,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { Employee, SchoolList, SchoolListStatus, ReadinessStatus, DeliveryStatus, ClientDemand } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';
import { convertSchoolListToClient } from '@/lib/dataStore';

type ActiveTab = 'lists' | 'employees';
type StatusFilter = 'all' | 'pending' | 'done';

interface EmployeesAndListsProps {
  demands: ClientDemand[];
  employees: Employee[];
  schoolLists: SchoolList[];
  onCreateEmployee: (name: string) => Promise<Employee>;
  onUpdateEmployee: (id: string, name: string) => Promise<Employee>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onCreateSchoolList: (payload: {
    client_name: string;
    school_name: string;
    phone?: string | null;
    ticket_id?: string | null;
    avance_amount?: number | null;
    total_amount?: number | null;
    employee_id?: string | null;
    status?: SchoolListStatus;
    readiness_status?: ReadinessStatus | string | null;
    delivery_status?: DeliveryStatus | string | null;
    client_id?: string | null;
  }) => Promise<SchoolList>;
  onUpdateSchoolList: (id: string, updates: Partial<SchoolList>) => Promise<SchoolList>;
  onDeleteSchoolList: (id: string) => Promise<void>;
  onLinkSchoolListClient: (listId: string, clientId: string | null) => Promise<SchoolList>;
  onConvertSchoolListToClient?: (listId: string) => Promise<{ clientId: string; demandId: string; schoolList: SchoolList }>;
  onRefreshData?: () => Promise<void>;
}

export default function EmployeesAndLists({
  demands,
  employees,
  schoolLists,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onCreateSchoolList,
  onUpdateSchoolList,
  onDeleteSchoolList,
  onLinkSchoolListClient,
  onConvertSchoolListToClient,
  onRefreshData,
}: EmployeesAndListsProps) {
  const router = useRouter();
  const { t } = useLanguage();

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<ActiveTab>('lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  // Converting to Client Action State
  const [convertingListId, setConvertingListId] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success', duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastType(type);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // --- Modals State ---
  // 1. Employee Modal (Add / Edit)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeNameInput, setEmployeeNameInput] = useState('');

  // 2. School List Modal (Add / Edit)
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<SchoolList | null>(null);
  const [listClientName, setListClientName] = useState('');
  const [listSchoolName, setListSchoolName] = useState('');
  const [listPhone, setListPhone] = useState('');
  const [listTicketId, setListTicketId] = useState('');
  const [listAvanceAmount, setListAvanceAmount] = useState('');
  const [listTotalAmount, setListTotalAmount] = useState('');
  const [listEmployeeId, setListEmployeeId] = useState('');
  const [listStatus, setListStatus] = useState<SchoolListStatus>('pending');
  const [listReadinessStatus, setListReadinessStatus] = useState<ReadinessStatus>('جاهزة جزئيا');
  const [listDeliveryStatus, setListDeliveryStatus] = useState<DeliveryStatus>('في انتظار التسليم');
  const [listClientId, setListClientId] = useState<string>('');

  // 3. Smart Link Modal (Link existing list to a Client)
  const [linkingList, setLinkingList] = useState<SchoolList | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // 4. Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'employee' | 'list';
    id: string;
    name: string;
  } | null>(null);

  // 5. Dedicated School List Details Modal
  const [viewingListDetails, setViewingListDetails] = useState<SchoolList | null>(null);

  // 6. Compact Dropdown Trigger State & Click-outside Handler
  const [activeDropdown, setActiveDropdown] = useState<{ listId: string; type: 'readiness' | 'delivery' } | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeDropdown && dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeDropdown]);

  // --- Unique Clients from Demands Dictionary ---
  const uniqueClientsList = useMemo(() => {
    const clientMap = new Map<string, { id: string; name: string; phone: string; demandStatus: string; totalItems: number; fulfilledItems: number }>();

    for (const dem of demands) {
      if (!dem.client) continue;
      const c = dem.client;
      const totalItems = (dem.items || []).length;
      const fulfilledItems = (dem.items || []).filter(it => it.is_in_stock || it.is_delivered || ((it.fulfilled_quantity || 0) >= it.quantity)).length;

      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, {
          id: c.id,
          name: c.name,
          phone: c.phone,
          demandStatus: dem.status,
          totalItems,
          fulfilledItems,
        });
      }
    }

    return Array.from(clientMap.values());
  }, [demands]);

  // --- Filtered Lists ---
  const filteredSchoolLists = useMemo(() => {
    return schoolLists.filter(item => {
      const isDone = item.status === 'done' || item.delivery_status === 'طلبية مستلمة';

      // 1. Status Filter
      if (statusFilter === 'done' && !isDone) return false;
      if (statusFilter === 'pending' && isDone) return false;

      // 2. Employee Filter
      if (employeeFilter !== 'all') {
        if (employeeFilter === 'unassigned' && item.employee_id) return false;
        if (employeeFilter !== 'unassigned' && item.employee_id !== employeeFilter) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const clientMatch = item.client_name?.toLowerCase().includes(q);
        const schoolMatch = item.school_name?.toLowerCase().includes(q);
        const empMatch = item.employee?.name?.toLowerCase().includes(q);
        const phoneMatch = item.phone?.includes(q);
        const ticketMatch = item.ticket_id?.toLowerCase().includes(q);
        const readinessMatch = item.readiness_status?.toLowerCase().includes(q);
        const deliveryMatch = item.delivery_status?.toLowerCase().includes(q);
        const linkedClientMatch = item.client?.name?.toLowerCase().includes(q) || item.client?.phone?.includes(q);
        if (!clientMatch && !schoolMatch && !empMatch && !linkedClientMatch && !phoneMatch && !ticketMatch && !readinessMatch && !deliveryMatch) return false;
      }

      return true;
    });
  }, [schoolLists, statusFilter, employeeFilter, searchQuery]);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(emp => emp.name.toLowerCase().includes(q));
  }, [employees, searchQuery]);

  // Employee Stats mapping
  const employeeStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number; pending: number }>();
    for (const emp of employees) {
      map.set(emp.id, { total: 0, done: 0, pending: 0 });
    }
    for (const list of schoolLists) {
      if (list.employee_id && map.has(list.employee_id)) {
        const stat = map.get(list.employee_id)!;
        stat.total += 1;
        if (list.status === 'done') stat.done += 1;
        else stat.pending += 1;
      }
    }
    return map;
  }, [employees, schoolLists]);

  // --- Handlers: Employee CRUD ---
  const handleOpenAddEmployee = () => {
    setEditingEmployee(null);
    setEmployeeNameInput('');
    setIsEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeNameInput(emp.name);
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = employeeNameInput.trim();
    if (!clean) return;

    if (editingEmployee) {
      // Edit
      const empId = editingEmployee.id;
      setIsEmployeeModalOpen(false);
      showToast(`تم تعديل اسم الموظف إلى "${clean}" بنجاح`, 'success');
      onUpdateEmployee(empId, clean).catch(err => {
        console.error('Error updating employee:', err);
        showToast('حدث خطأ أثناء تعديل الموظف في الخلفية', 'error');
      });
    } else {
      // Create
      setIsEmployeeModalOpen(false);
      showToast(`تمت إضافة الموظف "${clean}" بنجاح`, 'success');
      onCreateEmployee(clean).catch(err => {
        console.error('Error creating employee:', err);
        showToast('حدث خطأ أثناء إضافة الموظف في الخلفية', 'error');
      });
    }
  };

  // --- Handlers: School List CRUD ---
  const handleOpenAddList = () => {
    setEditingList(null);
    setListClientName('');
    setListSchoolName('');
    setListPhone('');
    setListTicketId('');
    setListAvanceAmount('');
    setListTotalAmount('');
    setListEmployeeId(employees[0]?.id || '');
    setListStatus('pending');
    setListReadinessStatus('جاهزة جزئيا');
    setListDeliveryStatus('في انتظار التسليم');
    setListClientId('');
    setIsListModalOpen(true);
  };

  const handleOpenEditList = (list: SchoolList) => {
    setEditingList(list);
    setListClientName(list.client_name);
    setListSchoolName(list.school_name);
    setListPhone(list.phone || list.client?.phone || '');
    setListTicketId(list.ticket_id || '');
    setListAvanceAmount(list.avance_amount !== null && list.avance_amount !== undefined ? String(list.avance_amount) : '');
    setListTotalAmount(list.total_amount !== null && list.total_amount !== undefined ? String(list.total_amount) : '');
    setListEmployeeId(list.employee_id || '');
    setListStatus(list.status || 'pending');
    setListReadinessStatus((list.readiness_status as ReadinessStatus) || 'جاهزة جزئيا');
    setListDeliveryStatus((list.delivery_status as DeliveryStatus) || (list.status === 'done' ? 'طلبية مستلمة' : 'في انتظار التسليم'));
    setListClientId(list.client_id || '');
    setIsListModalOpen(true);
  };

  const handleSaveSchoolList = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClient = listClientName.trim();
    const cleanSchool = listSchoolName.trim();
    const cleanPhone = listPhone.trim() || null;
    const cleanTicketId = listTicketId.trim() || null;
    const cleanAvance = listAvanceAmount.trim() !== '' ? Number(listAvanceAmount) : 0;
    const cleanTotal = listTotalAmount.trim() !== '' ? Number(listTotalAmount) : 0;
    if (!cleanClient || !cleanSchool) return;

    const finalStatus: SchoolListStatus = listDeliveryStatus === 'طلبية مستلمة' ? 'done' : listStatus;

    if (editingList) {
      // Edit
      const listId = editingList.id;
      const updates: Partial<SchoolList> = {
        client_name: cleanClient,
        school_name: cleanSchool,
        phone: cleanPhone,
        ticket_id: cleanTicketId,
        avance_amount: cleanAvance,
        total_amount: cleanTotal,
        employee_id: listEmployeeId || null,
        status: finalStatus,
        readiness_status: listReadinessStatus,
        delivery_status: listDeliveryStatus,
        client_id: listClientId || null,
      };
      setIsListModalOpen(false);
      showToast(`تم حفظ تعديل لائحة "${cleanClient}" بنجاح`, 'success');
      onUpdateSchoolList(listId, updates).catch(err => {
        console.error('Error updating school list:', err);
        showToast('حدث خطأ أثناء تعديل اللائحة في الخلفية', 'error');
      });
    } else {
      // Create
      setIsListModalOpen(false);
      showToast(`تم تسجيل لائحة جديدة للزبون "${cleanClient}" بنجاح`, 'success');
      onCreateSchoolList({
        client_name: cleanClient,
        school_name: cleanSchool,
        phone: cleanPhone,
        ticket_id: cleanTicketId,
        avance_amount: cleanAvance,
        total_amount: cleanTotal,
        employee_id: listEmployeeId || null,
        status: 'pending',
        readiness_status: 'جاهزة جزئيا',
        delivery_status: 'في انتظار التسليم',
        client_id: null,
      }).catch(err => {
        console.error('Error creating school list:', err);
        showToast('حدث خطأ أثناء إنشاء اللائحة في الخلفية', 'error');
      });
    }
  };

  // WhatsApp Action Handler
  const handleWhatsAppClick = (list: SchoolList, phoneNum?: string | null) => {
    const rawPhone = phoneNum || list.phone || list.client?.phone;
    if (!rawPhone || !rawPhone.trim()) {
      showToast('لا يوجد رقم هاتف لهذا الزبون', 'error');
      return;
    }

    const cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '').replace(/^0/, '212');
    if (!cleanPhone) {
      showToast('لا يوجد رقم هاتف لهذا الزبون', 'error');
      return;
    }

    const message = `السلام عليكم ورحمة الله وبركاته
يسرّنا إخباركم من المكتبة العصرية أيت ملول بأن طلبيتكم الخاصة باللوازم المدرسية التي قمتم بحجزها جاهزة للتسليم.

المكان: المكتبة العصرية
شارع المقاومة حي العهد الجديد أمام البريد بنك أيت ملول
الهاتف: 06.60.56.33.71 / 06.60.31.98.68

شكراً لثقتكم بنا، ومرحباً بكم.`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // Instant Readiness Dropdown Change
  const handleReadinessChange = (list: SchoolList, readiness: string) => {
    showToast(`تم تحديث الجاهزية إلى "${readiness}"`, 'success');
    onUpdateSchoolList(list.id, { readiness_status: readiness as ReadinessStatus }).catch(err => {
      console.error('Error updating readiness:', err);
      showToast('حدث خطأ أثناء تحديث حالة الجاهزية', 'error');
    });
  };

  // Instant Delivery Dropdown Change
  const handleDeliveryChange = (list: SchoolList, delivery: string) => {
    const isReceived = delivery === 'طلبية مستلمة';
    const nextStatus: SchoolListStatus = isReceived ? 'done' : 'pending';
    showToast(`تم تحديث حالة التسليم إلى "${delivery}"`, 'success');
    onUpdateSchoolList(list.id, {
      delivery_status: delivery as DeliveryStatus,
      status: nextStatus,
    }).catch(err => {
      console.error('Error updating delivery status:', err);
      showToast('حدث خطأ أثناء تحديث حالة التسليم', 'error');
    });
  };

  // --- Handlers: Smart Client Linking ---
  const handleOpenSmartLink = (list: SchoolList) => {
    setLinkingList(list);
    setClientSearchQuery(list.client_name || '');
  };

  const handleConfirmLinkClient = (clientId: string) => {
    if (!linkingList) return;
    const targetList = linkingList;
    setLinkingList(null);

    const clientObj = uniqueClientsList.find(c => c.id === clientId);
    showToast(`تم ربط اللائحة بالزبون "${clientObj?.name || ''}" وتعيينها كقيد الانتظار ⏳`, 'success', 3500);

    onLinkSchoolListClient(targetList.id, clientId).catch(err => {
      console.error('Error linking client to list:', err);
      showToast('حدث خطأ أثناء ربط الزبون باللائحة', 'error');
    });
  };

  const handleUnlinkClient = (list: SchoolList) => {
    showToast(`تم إلغاء ربط الزبون باللائحة "${list.client_name}"`, 'success');
    onLinkSchoolListClient(list.id, null).catch(err => {
      console.error('Error unlinking client:', err);
      showToast('حدث خطأ أثناء إلغاء الربط', 'error');
    });
  };

  // --- Magic Action Handler: Convert School List to Client / Missing Demands ---
  const handleConvertToClient = useCallback(async (list: SchoolList) => {
    if (convertingListId) return;
    setConvertingListId(list.id);
    try {
      let res: { clientId: string; demandId: string; schoolList: SchoolList };
      if (onConvertSchoolListToClient) {
        res = await onConvertSchoolListToClient(list.id);
      } else {
        res = await convertSchoolListToClient(list.id);
        if (onUpdateSchoolList && res?.clientId) {
          await onUpdateSchoolList(list.id, { client_id: res.clientId });
        }
      }
      showToast(`تمت إضافة "${list.client_name}" للخصاص بنجاح ✨`, 'success', 2500);
    } catch (err) {
      console.error('Error converting school list to client:', err);
      showToast('حدث خطأ أثناء تحويل اللائحة إلى زبون خصاص', 'error', 4000);
    } finally {
      setConvertingListId(null);
    }
  }, [convertingListId, onConvertSchoolListToClient, onUpdateSchoolList, showToast]);

  // --- Delete Handler ---
  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    const { type, id, name } = deleteConfirm;
    setDeleteConfirm(null);

    if (type === 'employee') {
      showToast(`تم حذف الموظف "${name}" بنجاح`, 'success');
      onDeleteEmployee(id).catch(err => {
        console.error('Error deleting employee:', err);
        showToast('حدث خطأ أثناء حذف الموظف', 'error');
      });
    } else {
      showToast(`تم حذف لائحة "${name}" بنجاح`, 'success');
      onDeleteSchoolList(id).catch(err => {
        console.error('Error deleting school list:', err);
        showToast('حدث خطأ أثناء حذف اللائحة', 'error');
      });
    }
  };

  // Filtered clients for the Smart Link modal
  const filteredClientsForModal = useMemo(() => {
    if (!clientSearchQuery.trim()) return uniqueClientsList;
    const q = clientSearchQuery.trim().toLowerCase();
    return uniqueClientsList.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [uniqueClientsList, clientSearchQuery]);

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top duration-200 border ${
          toastType === 'error'
            ? 'bg-rose-950/95 border-rose-600/80 text-rose-100'
            : 'bg-neutral-900 border-neutral-700'
        }`}>
          {toastType === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-orange-700 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo-lib-modern.jpg"
            alt="Lib Moderne"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0 rounded-xl"
          />
          <h2 className="text-base sm:text-lg font-black text-neutral-900">
            الموظفين واللوائح المدرسية
          </h2>
        </div>

        {/* Tab Switcher: Compact Brand Segmented Control */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-neutral-100/90 p-1 rounded-xl sm:rounded-2xl border border-neutral-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('lists')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-lg sm:rounded-xl transition-all duration-200 min-h-[34px] sm:min-h-[38px] text-xs sm:text-sm font-semibold group ${
              activeTab === 'lists'
                ? 'bg-orange-700 text-white shadow-md shadow-orange-700/20 font-black'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70'
            }`}
          >
            <ClipboardList className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'lists' ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-900'}`} />
            <span>اللوائح المدرسية</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${
              activeTab === 'lists' ? 'bg-white text-orange-700 shadow-2xs font-black' : 'bg-neutral-200/80 text-neutral-800'
            }`}>
              {schoolLists.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-lg sm:rounded-xl transition-all duration-200 min-h-[34px] sm:min-h-[38px] text-xs sm:text-sm font-semibold group ${
              activeTab === 'employees'
                ? 'bg-orange-700 text-white shadow-md shadow-orange-700/20 font-black'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70'
            }`}
          >
            <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'employees' ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-900'}`} />
            <span>طاقم الموظفين</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${
              activeTab === 'employees' ? 'bg-white text-orange-700 shadow-2xs font-black' : 'bg-neutral-200/80 text-neutral-800'
            }`}>
              {employees.length}
            </span>
          </button>
        </div>

        {/* Search & Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 absolute right-3 top-2.5 sm:right-3.5 sm:top-3" />
            <input
              type="text"
              placeholder={activeTab === 'lists' ? 'ابحث باسم الزبون، المدرسة، أو الموظف...' : 'ابحث باسم الموظف...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-9 sm:pr-10 pl-3.5 sm:pl-4 h-9 sm:h-10 text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'lists' && (
              <>
                {/* Status Filter Segmented Control */}
                <div className="flex items-center gap-1 bg-neutral-100/90 p-1 rounded-xl border border-neutral-200/80 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      statusFilter === 'all'
                        ? 'bg-orange-700 text-white shadow-xs font-black'
                        : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/60'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-white shadow-xs font-black'
                        : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/60'
                    }`}
                  >
                    في الانتظار
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('done')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      statusFilter === 'done'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/60'
                    }`}
                  >
                    مكتملة
                  </button>
                </div>

                {/* Employee Filter dropdown */}
                {employees.length > 0 && (
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="h-9 px-3 text-xs font-bold bg-white border border-neutral-200/80 rounded-full text-neutral-700 focus:outline-none focus:border-neutral-900 shadow-xs cursor-pointer"
                  >
                    <option value="all">جميع الموظفين</option>
                    <option value="unassigned">غير معين</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                )}

                {/* Add New List Button */}
                <button
                  type="button"
                  onClick={handleOpenAddList}
                  className="h-9 px-3.5 sm:px-4 text-xs font-bold rounded-full bg-orange-700 hover:bg-orange-800 text-white flex items-center gap-1.5 shadow-md shadow-orange-700/20 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة لائحة</span>
                </button>
              </>
            )}

            {activeTab === 'employees' && (
              <button
                type="button"
                onClick={handleOpenAddEmployee}
                className="h-9 px-4 text-xs font-bold rounded-full bg-orange-700 hover:bg-orange-800 text-white flex items-center gap-1.5 shadow-md shadow-orange-700/20 transition-all duration-200 hover:-translate-y-0.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة موظف جديد</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Content Area */}

      {/* TAB 1: School Lists */}
      {activeTab === 'lists' && (
        <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
          {filteredSchoolLists.length === 0 ? (
            <div className="text-center py-16 px-4">
              <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-base font-extrabold text-neutral-900">لا توجد لوائح مدرسية مسجلة</p>
              <p className="text-xs text-neutral-400 mt-1">
                {searchQuery || statusFilter !== 'all' || employeeFilter !== 'all'
                  ? 'لا توجد لوائح تطابق معايير البحث والفلترة'
                  : 'ابدأ بالضغط على "إضافة لائحة" لتسجيل لائحة مدرسية جديدة لموظف'}
              </p>
              {!(searchQuery || statusFilter !== 'all' || employeeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={handleOpenAddList}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold rounded-full shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول لائحة مدرسية</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100" ref={dropdownContainerRef}>
              {filteredSchoolLists.map((list, idx) => {
                const contactPhone = list.phone || list.client?.phone;
                const currentReadiness = (list.readiness_status as string) || 'جاهزة بالكامل';
                const currentDelivery = (list.delivery_status as string) || (list.status === 'done' ? 'طلبية مستلمة' : 'في انتظار التسليم');
                const isDelivered = currentDelivery === 'طلبية مستلمة' || list.status === 'done';

                return (
                  <div key={list.id} className="py-3 first:pt-0 last:pb-0 group transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3.5 w-full">
                      
                      {/* Left/Right (RTL): Row Number, Clickable Client Name & Status Badges */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-neutral-100 text-neutral-800 font-black text-xs flex items-center justify-center shrink-0 border border-neutral-200/60">
                          #{idx + 1}
                        </span>

                        {/* Client Name: Opens dedicated School List Details Modal */}
                        <button
                          type="button"
                          onClick={() => setViewingListDetails(list)}
                          className="text-right font-extrabold text-sm sm:text-base text-neutral-900 hover:text-orange-700 hover:underline transition-colors cursor-pointer truncate max-w-[200px] sm:max-w-none shrink-0"
                          title="انقر لعرض كافة تفاصيل هذه اللائحة المدرسية"
                        >
                          {list.client_name}
                        </button>

                        {/* Ticket / Bon Badge if available */}
                        {list.ticket_id && (
                          <span className="bg-neutral-900 text-white text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0 shadow-2xs">
                            <Ticket className="w-3 h-3 text-orange-400 shrink-0" />
                            <span>#{list.ticket_id}</span>
                          </span>
                        )}

                        {/* Status Badges Display beside Client Name */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {/* 1. Readiness Badge */}
                          {currentReadiness === 'جاهزة بالكامل' ? (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/60 inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span>جاهزة بالكامل</span>
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-800 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200/60 inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>جاهزة جزئيا</span>
                            </span>
                          )}

                          {/* 2. Delivery Badge */}
                          {isDelivered ? (
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/60 inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span>طلبية مستلمة</span>
                            </span>
                          ) : (
                            <span className="bg-orange-50 text-orange-700 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-orange-200/60 inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                              <span>في انتظار التسليم</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions Container */}
                      {/* Responsive Action controls order: [Trash] [Edit] [WhatsApp Icon] [Dropdown 1: الجاهزية] [Dropdown 2: الحالة] [زر إضافة للخصاص] */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start pt-1.5 sm:pt-0 border-t sm:border-t-0 border-neutral-100/80">
                        
                        {/* 1. Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'list', id: list.id, name: list.client_name })}
                          className="h-[32px] sm:h-[34px] w-[32px] sm:w-[34px] min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-neutral-200 bg-white hover:border-rose-300 hover:bg-rose-50 text-neutral-400 hover:text-rose-600 flex items-center justify-center transition-colors shrink-0 shadow-2xs"
                          title="حذف اللائحة"
                          aria-label="حذف اللائحة"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {/* 2. Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditList(list)}
                          className="h-[32px] sm:h-[34px] w-[32px] sm:w-[34px] min-h-[32px] min-w-[32px] p-1.5 rounded-lg border border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50 text-neutral-600 hover:text-amber-700 flex items-center justify-center transition-colors shrink-0 shadow-2xs"
                          title="تعديل بيانات اللائحة"
                          aria-label="تعديل بيانات اللائحة"
                        >
                          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {/* 3. Official WhatsApp SVG Icon Button */}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppClick(list, contactPhone)}
                          className={`h-[32px] sm:h-[34px] w-[32px] sm:w-[34px] min-h-[32px] min-w-[32px] p-1.5 rounded-lg border transition-all flex items-center justify-center shrink-0 shadow-2xs ${
                            contactPhone
                              ? 'border-emerald-200 text-emerald-600 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 active:scale-95 bg-emerald-50/40'
                              : 'border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed'
                          }`}
                          title={contactPhone ? `إرسال عبر واتساب (${contactPhone})` : 'لا يوجد رقم هاتف مسجل'}
                          aria-label="إرسال عبر واتساب"
                          disabled={!contactPhone}
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 448 512">
                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                          </svg>
                        </button>

                        {/* 4. Dropdown Trigger: الجاهزية */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown?.listId === list.id && activeDropdown?.type === 'readiness' ? null : { listId: list.id, type: 'readiness' });
                            }}
                            className="h-[32px] sm:h-[34px] min-h-[32px] text-xs py-1 px-2.5 rounded-lg border border-neutral-200/90 bg-white text-neutral-800 font-bold hover:border-amber-400 hover:bg-amber-50/40 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer transition-all shadow-2xs shrink-0 flex items-center gap-1.5"
                            title="تعديل حالة الجاهزية"
                          >
                            <span>الجاهزية</span>
                            <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                          </button>

                          {activeDropdown?.listId === list.id && activeDropdown?.type === 'readiness' && (
                            <div className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-xl p-1.5 min-w-[145px] text-right space-y-1 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReadinessChange(list, 'جاهزة بالكامل');
                                  setActiveDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                                  currentReadiness === 'جاهزة بالكامل'
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  جاهزة بالكامل
                                </span>
                                {currentReadiness === 'جاهزة بالكامل' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReadinessChange(list, 'جاهزة جزئيا');
                                  setActiveDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                                  currentReadiness === 'جاهزة جزئيا'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                  جاهزة جزئيا
                                </span>
                                {currentReadiness === 'جاهزة جزئيا' && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 5. Dropdown Trigger: الحالة */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown?.listId === list.id && activeDropdown?.type === 'delivery' ? null : { listId: list.id, type: 'delivery' });
                            }}
                            className="h-[32px] sm:h-[34px] min-h-[32px] text-xs py-1 px-2.5 rounded-lg border border-neutral-200/90 bg-white text-neutral-800 font-bold hover:border-amber-400 hover:bg-amber-50/40 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer transition-all shadow-2xs shrink-0 flex items-center gap-1.5"
                            title="تعديل حالة التسليم"
                          >
                            <span>الحالة</span>
                            <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                          </button>

                          {activeDropdown?.listId === list.id && activeDropdown?.type === 'delivery' && (
                            <div className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 z-50 bg-white border border-neutral-200/90 rounded-2xl shadow-xl p-1.5 min-w-[155px] text-right space-y-1 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeliveryChange(list, 'في انتظار التسليم');
                                  setActiveDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                                  currentDelivery === 'في انتظار التسليم'
                                    ? 'bg-orange-50 text-orange-800'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                  في انتظار التسليم
                                </span>
                                {currentDelivery === 'في انتظار التسليم' && <Check className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeliveryChange(list, 'طلبية مستلمة');
                                  setActiveDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                                  currentDelivery === 'طلبية مستلمة'
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  طلبية مستلمة
                                </span>
                                {currentDelivery === 'طلبية مستلمة' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 6. Compact Demand Button: إضافة للخصاص (renders ONLY if !list.client_id) */}
                        {!list.client_id && (
                          <button
                            type="button"
                            disabled={convertingListId === list.id}
                            onClick={() => handleConvertToClient(list)}
                            className="h-[32px] sm:h-[34px] min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-lg bg-orange-700 hover:bg-orange-800 active:scale-95 text-white flex items-center justify-center gap-1.5 transition-all shadow-2xs shrink-0 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                            title="إضافة للخصاص (تحويل الزبون لدليل الخصاصات وإضافة الكتب المطلوبة فوراً)"
                          >
                            {convertingListId === list.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                                <span>جاري التحويل...</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                <span>إضافة للخصاص</span>
                              </>
                            )}
                          </button>
                        )}

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Employees */}
      {activeTab === 'employees' && (
        <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-base font-extrabold text-neutral-900">لا يوجد موظفون مسجلون</p>
              <p className="text-xs text-neutral-400 mt-1">
                {searchQuery ? 'لا يوجد موظف يطابق اسم البحث' : 'أضف أسماء طاقم العمل لتعيين وتتبع لوائح كل موظف'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={handleOpenAddEmployee}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold rounded-full shadow-md transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة أول موظف</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredEmployees.map((emp) => {
                const stats = employeeStatsMap.get(emp.id) || { total: 0, done: 0, pending: 0 };
                const initials = emp.name.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={emp.id}
                    className="bg-white border border-neutral-200/80 rounded-2xl p-4 space-y-3.5 shadow-2xs hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-neutral-900 truncate">
                            {emp.name}
                          </h3>
                          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
                            طاقم العمل • المكتبة العصرية
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditEmployee(emp)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
                          title="تعديل اسم الموظف"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'employee', id: emp.id, name: emp.name })}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors"
                          title="حذف الموظف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200/60 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold block">إجمالي اللوائح</span>
                        <strong className="text-neutral-900 font-extrabold text-sm">{stats.total}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 font-bold block">مكتملة</span>
                        <strong className="text-emerald-700 font-extrabold text-sm">{stats.done}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-600 font-bold block">في الانتظار</span>
                        <strong className="text-amber-700 font-extrabold text-sm">{stats.pending}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL 1: Add / Edit Employee --- */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                  <Users className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                    {editingEmployee ? 'تعديل اسم الموظف' : 'إضافة موظف جديد'}
                  </h3>
                  <p className="text-xs text-neutral-500">طاقم عمل المكتبة العصرية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  اسم الموظف الكامل:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: عبد الرحيم، محمد، فاطمة..."
                  value={employeeNameInput}
                  onChange={(e) => setEmployeeNameInput(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-full shadow-md shadow-orange-700/20 transition-all hover:-translate-y-0.5"
                >
                  {editingEmployee ? 'حفظ التعديل' : 'إضافة الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Add / Edit School List --- */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                  <ClipboardList className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                    {editingList ? 'تعديل اللائحة المدرسية' : 'إضافة لائحة مدرسية جديدة'}
                  </h3>
                  <p className="text-xs text-neutral-500">تسجيل ومتابعة لائحة الزبون</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchoolList} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  اسم الزبون / صاحب اللائحة:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="اسم الزبون..."
                  value={listClientName}
                  onChange={(e) => setListClientName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  اسم المؤسسة / المدرسة:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مدرسة الفارابي، الإشعاع، المنار..."
                  value={listSchoolName}
                  onChange={(e) => setListSchoolName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  رقم الهاتف / الواتساب (اختياري):
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5" />
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="06XXXXXXXX / 07XXXXXXXX"
                    value={listPhone}
                    onChange={(e) => setListPhone(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pr-10 pl-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white text-left font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  الموظف المكلف باللائحة:
                </label>
                <select
                  value={listEmployeeId}
                  onChange={(e) => setListEmployeeId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white cursor-pointer"
                >
                  <option value="">-- بدون تعيين موظف --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {/* Row A (Full Width): رقم التيكيت */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  رقم التيكيت:
                </label>
                <div className="relative">
                  <Ticket className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="مثال: D125"
                    value={listTicketId}
                    onChange={(e) => setListTicketId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pr-10 pl-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* Row B (2 Columns - 50% / 50%): التسبيق & المبلغ الإجمالي */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Column 1: التسبيق */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    التسبيق (د.م):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={listAvanceAmount}
                    onChange={(e) => setListAvanceAmount(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white font-mono text-left"
                    dir="ltr"
                  />
                </div>

                {/* Column 2: المبلغ الإجمالي */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    المبلغ الإجمالي (د.م):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={listTotalAmount}
                    onChange={(e) => setListTotalAmount(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsListModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-full shadow-md shadow-orange-700/20 transition-all hover:-translate-y-0.5"
                >
                  {editingList ? 'حفظ التعديلات' : 'تسجيل اللائحة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Smart Linking Modal --- */}
      {linkingList && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-700 text-white flex items-center justify-center font-bold shadow-md shadow-orange-700/20">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                    الربط الذكي بزبون الخصاص
                  </h3>
                  <p className="text-xs text-neutral-500">
                    ربط لائحة &quot;{linkingList.client_name}&quot; بزبون مسجل في دليل الزبائن
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingList(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanatory Info Card */}
            <div className="bg-orange-50/80 border border-orange-200/80 rounded-2xl p-3 text-xs text-neutral-800 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                عند ربط هذه اللائحة بزبون الخصاص، ستتحول حالتها فوراً إلى <strong>&quot;في الانتظار (Pending)&quot;</strong>، وبمجرد اكتمال توفير جميع الكتب المطلوبة للزبون بنسبة <strong>100%</strong> عبر شاشة توزيع السلع، سيقوم النظام تلقائياً بتحديث حالة هذه اللائحة إلى <strong>&quot;مكتملة (Done)&quot;</strong>.
              </p>
            </div>

            {/* Search Input for Clients */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5" />
              <input
                type="text"
                autoFocus
                placeholder="ابحث باسم الزبون أو رقم الهاتف..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pr-9 pl-4 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white"
              />
            </div>

            {/* Clients List Results */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 max-h-60 pr-1">
              {filteredClientsForModal.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs font-bold">
                  لا يوجد زبون مطابق للبحث في دليل الطلبيات.
                </div>
              ) : (
                filteredClientsForModal.map(cli => (
                  <div key={cli.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-50 px-2 rounded-xl transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs sm:text-sm font-extrabold text-neutral-900">{cli.name}</strong>
                        <span dir="ltr" className="text-[11px] font-mono text-neutral-500 font-bold">
                          {cli.phone}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 font-medium mt-0.5">
                        حالة الطلب: {cli.demandStatus === 'completed' ? 'مكتمل' : 'معلق / جزئي'} • المتوفر: {cli.fulfilledItems}/{cli.totalItems}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmLinkClient(cli.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-full transition-all shadow-2xs hover:-translate-y-0.5 flex items-center gap-1 shrink-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>ربط اللائحة</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setLinkingList(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Delete Confirmation --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">تأكيد الحذف</h3>
                <p className="text-xs text-neutral-500">
                  {deleteConfirm.type === 'employee' ? 'حذف الموظف' : 'حذف اللائحة المدرسية'}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف{' '}
              <strong className="text-neutral-900">&quot;{deleteConfirm.name}&quot;</strong>؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-all"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Dedicated School List Details Modal --- */}
      {viewingListDetails && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-700 text-white flex items-center justify-center font-bold shadow-md shadow-orange-700/20">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-neutral-900">
                    تفاصيل اللائحة المدرسية
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {viewingListDetails.client_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingListDetails(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Grid Cards */}
            <div className="space-y-3">
              {/* Card 1: Client & School */}
              <div className="bg-neutral-50/90 border border-neutral-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-neutral-400 block">صاحب اللائحة</span>
                    <strong className="text-sm sm:text-base font-extrabold text-neutral-900 block">
                      {viewingListDetails.client_name}
                    </strong>
                  </div>
                  {viewingListDetails.client_id ? (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200/60 inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      مرتبط بدليل الزبائن
                    </span>
                  ) : (
                    <span className="bg-neutral-200/70 text-neutral-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                      غير مسجل في الخصاص
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-neutral-200/60">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-orange-700 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 block">المؤسسة / المدرسة</span>
                      <strong className="text-xs font-bold text-neutral-800">
                        {viewingListDetails.school_name || 'غير محدد'}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 block">رقم الهاتف</span>
                      {viewingListDetails.phone || viewingListDetails.client?.phone ? (
                        <a
                          href={`tel:${viewingListDetails.phone || viewingListDetails.client?.phone}`}
                          className="text-xs font-bold font-mono text-emerald-700 hover:underline dir-ltr block"
                        >
                          {viewingListDetails.phone || viewingListDetails.client?.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-neutral-400 font-medium">غير متوفر</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Status & Readiness */}
              <div className="bg-neutral-50/90 border border-neutral-200/80 rounded-2xl p-4 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold text-neutral-400 block mb-1.5">حالة الجاهزية</span>
                  {((viewingListDetails.readiness_status as string) || 'جاهزة بالكامل') === 'جاهزة بالكامل' ? (
                    <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/60 inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      جاهزة بالكامل
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200/60 inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      جاهزة جزئيا
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-bold text-neutral-400 block mb-1.5">حالة التسليم</span>
                  {(((viewingListDetails.delivery_status as string) || (viewingListDetails.status === 'done' ? 'طلبية مستلمة' : 'في انتظار التسليم')) === 'طلبية مستلمة') ? (
                    <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/60 inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      طلبية مستلمة
                    </span>
                  ) : (
                    <span className="bg-orange-50 text-orange-700 text-xs font-bold px-3 py-1 rounded-full border border-orange-200/60 inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      في انتظار التسليم
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2.5: Ticket & Financial Pricing Details */}
              <div className="bg-neutral-50/90 border border-neutral-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">رقم التيكيت</span>
                  {viewingListDetails.ticket_id ? (
                    <span className="bg-neutral-900 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-2xs">
                      <Ticket className="w-3.5 h-3.5 text-orange-400" />
                      <span>{viewingListDetails.ticket_id}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400 font-medium">غير محدد</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">التسبيق</span>
                  <strong className="text-xs sm:text-sm font-extrabold text-emerald-700 font-mono">
                    {viewingListDetails.avance_amount != null ? `${Number(viewingListDetails.avance_amount).toFixed(2)} د.م` : '0.00 د.م'}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">المبلغ الإجمالي</span>
                  <strong className="text-xs sm:text-sm font-extrabold text-neutral-900 font-mono">
                    {viewingListDetails.total_amount != null ? `${Number(viewingListDetails.total_amount).toFixed(2)} د.م` : '0.00 د.م'}
                  </strong>
                </div>
              </div>

              {/* Card 3: Employee & Creation Date */}
              <div className="bg-neutral-50/90 border border-neutral-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Users className="w-4 h-4 text-orange-700" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 block">الموظف المكلف</span>
                    <strong className="text-xs font-bold text-neutral-900">
                      {viewingListDetails.employee?.name || employees.find(e => e.id === viewingListDetails.employee_id)?.name || 'غير معين'}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Calendar className="w-4 h-4 text-neutral-600" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 block">تاريخ التسجيل</span>
                    <strong className="text-xs font-bold text-neutral-800">
                      {viewingListDetails.created_at ? new Date(viewingListDetails.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'غير محدد'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const listToEdit = viewingListDetails;
                    setViewingListDetails(null);
                    handleOpenEditList(listToEdit);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full transition-colors inline-flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل اللائحة</span>
                </button>

                {(viewingListDetails.phone || viewingListDetails.client?.phone) && (
                  <button
                    type="button"
                    onClick={() => handleWhatsAppClick(viewingListDetails, viewingListDetails.phone || viewingListDetails.client?.phone)}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span>إرسال واتساب</span>
                  </button>
                )}

                {!viewingListDetails.client_id && (
                  <button
                    type="button"
                    disabled={convertingListId === viewingListDetails.id}
                    onClick={() => {
                      const target = viewingListDetails;
                      handleConvertToClient(target);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-orange-700 hover:bg-orange-800 text-white rounded-full transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إضافة للخصاص</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingListDetails(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
