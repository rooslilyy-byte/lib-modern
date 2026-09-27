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
  Sparkles,
  UserCheck,
  Building,
  Filter,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Employee, SchoolList, SchoolListStatus, ClientDemand } from '@/lib/types';
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
    employee_id?: string | null;
    status?: SchoolListStatus;
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
  const [listEmployeeId, setListEmployeeId] = useState('');
  const [listStatus, setListStatus] = useState<SchoolListStatus>('pending');
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

  // --- Filtering & Stats ---
  const totalListsCount = schoolLists.length;
  const doneListsCount = useMemo(() => schoolLists.filter(l => l.status === 'done').length, [schoolLists]);
  const pendingListsCount = useMemo(() => schoolLists.filter(l => l.status === 'pending').length, [schoolLists]);
  const totalEmployeesCount = employees.length;

  // Filtered Lists
  const filteredSchoolLists = useMemo(() => {
    return schoolLists.filter(item => {
      // 1. Status Filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

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
        const linkedClientMatch = item.client?.name?.toLowerCase().includes(q) || item.client?.phone?.includes(q);
        if (!clientMatch && !schoolMatch && !empMatch && !linkedClientMatch) return false;
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
    setListEmployeeId(employees[0]?.id || '');
    setListStatus('pending');
    setListClientId('');
    setIsListModalOpen(true);
  };

  const handleOpenEditList = (list: SchoolList) => {
    setEditingList(list);
    setListClientName(list.client_name);
    setListSchoolName(list.school_name);
    setListEmployeeId(list.employee_id || '');
    setListStatus(list.status);
    setListClientId(list.client_id || '');
    setIsListModalOpen(true);
  };

  const handleSaveSchoolList = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClient = listClientName.trim();
    const cleanSchool = listSchoolName.trim();
    if (!cleanClient || !cleanSchool) return;

    if (editingList) {
      // Edit
      const listId = editingList.id;
      const updates: Partial<SchoolList> = {
        client_name: cleanClient,
        school_name: cleanSchool,
        employee_id: listEmployeeId || null,
        status: listStatus,
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
        employee_id: listEmployeeId || null,
        status: listStatus,
        client_id: listClientId || null,
      }).catch(err => {
        console.error('Error creating school list:', err);
        showToast('حدث خطأ أثناء إنشاء اللائحة في الخلفية', 'error');
      });
    }
  };

  // One-click Toggle Status
  const handleToggleListStatus = (list: SchoolList) => {
    const nextStatus: SchoolListStatus = list.status === 'done' ? 'pending' : 'done';
    const msg = nextStatus === 'done'
      ? `تم وسم لائحة "${list.client_name}" كمكتملة بنجاح ✅`
      : `تم تحويل لائحة "${list.client_name}" إلى قيد الانتظار ⏳`;
    showToast(msg, 'success');

    onUpdateSchoolList(list.id, { status: nextStatus }).catch(err => {
      console.error('Error toggling list status:', err);
      showToast('حدث خطأ أثناء تغيير حالة اللائحة', 'error');
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
      }
      showToast(`تم تحويل "${list.client_name}" وإضافته للخصاص بنجاح ✨`, 'success', 2500);
      if (onRefreshData) {
        await onRefreshData();
      }
      const targetId = res.demandId || res.clientId;
      if (targetId) {
        router.push(`/customers/${encodeURIComponent(targetId)}?edit=true`);
      }
    } catch (err) {
      console.error('Error converting school list to client:', err);
      showToast('حدث خطأ أثناء تحويل اللائحة إلى زبون خصاص', 'error', 4000);
      setConvertingListId(null);
    }
  }, [convertingListId, onConvertSchoolListToClient, onRefreshData, router, showToast]);

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
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-lib-modern.jpg"
              alt="Lib Moderne"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-neutral-900">
                  الموظفين واللوائح المدرسية
                </h2>
                <span className="bg-orange-50 text-orange-700 border border-orange-200/80 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  ربط وتوزيع ذكي
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                متابعة لوائح الكتب المدرسية لكل موظف والربط التلقائي بخصاصات الزبناء
              </p>
            </div>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 bg-white/90 border border-neutral-200/80 px-3.5 h-9 rounded-full shadow-xs">
              <span className="text-neutral-400">إجمالي اللوائح:</span>
              <strong className="text-neutral-900">{totalListsCount}</strong>
              <span className="text-neutral-300">|</span>
              <span className="text-emerald-600">مكتملة: {doneListsCount}</span>
              <span className="text-neutral-300">|</span>
              <span className="text-amber-600">في الانتظار: {pendingListsCount}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 bg-white/90 border border-neutral-200/80 px-3.5 h-9 rounded-full shadow-xs">
              <Users className="w-3.5 h-3.5 text-orange-700" />
              <span className="text-neutral-400">الموظفين:</span>
              <strong className="text-orange-700">{totalEmployeesCount}</strong>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Brand Segmented Control */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-neutral-100/90 p-1 sm:p-1.5 rounded-2xl border border-neutral-200/80 text-[11px] sm:text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('lists')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl transition-all duration-200 min-h-[36px] sm:min-h-[40px] group ${
              activeTab === 'lists'
                ? 'bg-orange-700 text-white shadow-md shadow-orange-700/20 font-black'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70'
            }`}
          >
            <ClipboardList className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'lists' ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-900'}`} />
            <span>اللوائح المدرسية (School Lists)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-colors ${
              activeTab === 'lists' ? 'bg-white text-orange-700 shadow-2xs font-black' : 'bg-neutral-200/80 text-neutral-800'
            }`}>
              {schoolLists.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl transition-all duration-200 min-h-[36px] sm:min-h-[40px] group ${
              activeTab === 'employees'
                ? 'bg-orange-700 text-white shadow-md shadow-orange-700/20 font-black'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70'
            }`}
          >
            <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'employees' ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-900'}`} />
            <span>طاقم الموظفين (Employees)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-colors ${
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
            <div className="divide-y divide-neutral-100">
              {filteredSchoolLists.map((list, idx) => {
                const assignedEmp = employees.find(e => e.id === list.employee_id) || list.employee;
                const isLinked = Boolean(list.client_id);
                const linkedClient = uniqueClientsList.find(c => c.id === list.client_id) || list.client;

                return (
                  <div key={list.id} className="py-4 first:pt-0 last:pb-0 group transition-colors">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5">
                      
                      {/* Left: Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 font-black text-xs flex items-center justify-center shrink-0 border border-neutral-200/60 mt-0.5">
                          #{idx + 1}
                        </span>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm sm:text-base text-neutral-900">
                              {list.client_name}
                            </h3>
                            
                            {/* School Badge */}
                            <span className="bg-neutral-100 text-neutral-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-neutral-200/60">
                              <GraduationCap className="w-3 h-3 text-orange-700" />
                              {list.school_name}
                            </span>

                            {/* Status Badge */}
                            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                              list.status === 'done'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                : 'bg-amber-50 text-amber-700 border-amber-200/80'
                            }`}>
                              {list.status === 'done' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>مكتملة (Done)</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>في الانتظار (Pending)</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Sub-info: Assigned Employee & Smart Link Info */}
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-neutral-500 flex-wrap pt-0.5">
                            {/* Assigned Employee */}
                            <span className="flex items-center gap-1 font-medium">
                              <span className="text-neutral-400">الموظف المكلف:</span>
                              <strong className="text-neutral-800 bg-neutral-50 px-2 py-0.5 rounded-md border border-neutral-200/60">
                                {assignedEmp ? assignedEmp.name : 'غير معيّن'}
                              </strong>
                            </span>

                            <span className="text-neutral-300">•</span>

                            {/* Linked Client Info */}
                            {isLinked ? (
                              <div className="flex items-center gap-1.5 bg-orange-50/80 border border-orange-200/60 text-orange-950 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                <Link2 className="w-3 h-3 text-orange-700 shrink-0" />
                                <button
                                  type="button"
                                  onClick={() => router.push(`/customers/${encodeURIComponent(linkedClient?.id || list.client_id!)}`)}
                                  className="hover:underline flex items-center gap-1 text-orange-900"
                                  title="فتح ملف الزبون في دليل الخصاص"
                                >
                                  <span>زبون الخصاص: {linkedClient?.name || 'مرتبط'}</span>
                                  <ExternalLink className="w-3 h-3 text-orange-700" />
                                </button>
                                {linkedClient?.phone && (
                                  <span dir="ltr" className="text-[11px] font-mono text-neutral-600">
                                    ({linkedClient.phone})
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkClient(list)}
                                  className="text-neutral-400 hover:text-rose-600 mr-1"
                                  title="إلغاء الربط بالزبون"
                                >
                                  <Unlink className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenSmartLink(list)}
                                className="text-orange-700 hover:text-orange-800 font-bold hover:underline flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/50"
                              >
                                <Link2 className="w-3 h-3" />
                                <span>ربط بزبون في الدليل (Smart Link)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 sm:gap-2 self-end lg:self-center flex-wrap">
                        {/* Magic Action Button: Add to Missing Demands */}
                        {list.status !== 'done' && (
                          <button
                            type="button"
                            disabled={convertingListId === list.id}
                            onClick={() => handleConvertToClient(list)}
                            className="h-8 sm:h-9 px-3 sm:px-3.5 text-xs font-black rounded-full bg-orange-700 hover:bg-orange-800 active:scale-95 text-white flex items-center gap-1.5 transition-all shadow-md shadow-orange-700/20 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
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

                        {/* Toggle Status Quick Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleListStatus(list)}
                          className={`h-8 sm:h-9 px-3 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all shadow-xs ${
                            list.status === 'done'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title={list.status === 'done' ? 'تغيير إلى قيد الانتظار' : 'وسم كمكتملة'}
                        >
                          {list.status === 'done' ? (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>إرجاع كـ قيد الانتظار</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>تعيين كمكتملة (Done)</span>
                            </>
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditList(list)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors border border-neutral-200/60"
                          title="تعديل بيانات اللائحة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ type: 'list', id: list.id, name: list.client_name })}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-neutral-100 hover:bg-rose-50 hover:text-rose-600 text-neutral-500 flex items-center justify-center transition-colors border border-neutral-200/60"
                          title="حذف اللائحة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  حالة اللائحة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setListStatus('pending')}
                    className={`py-2 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      listStatus === 'pending'
                        ? 'bg-amber-50 border-amber-400 text-amber-800 font-extrabold shadow-2xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>في الانتظار (Pending)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setListStatus('done')}
                    className={`py-2 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      listStatus === 'done'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-extrabold shadow-2xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>مكتملة (Done)</span>
                  </button>
                </div>
              </div>

              {/* Optional Link to Existing Client in Demand Directory */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ربط بزبون من دليل الخصاصات (اختياري):
                </label>
                <select
                  value={listClientId}
                  onChange={(e) => setListClientId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white cursor-pointer"
                >
                  <option value="">-- بدون ربط بزبون خصاص --</option>
                  {uniqueClientsList.map(cli => (
                    <option key={cli.id} value={cli.id}>
                      {cli.name} ({cli.phone})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">
                  عند ربط الزبون، سيتم تفعيل التحديث التلقائي لحالة اللائحة إلى &apos;مكتملة&apos; عند وصول كامل خصاصاته للمخزن.
                </p>
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

    </div>
  );
}
