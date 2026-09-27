'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  PackageCheck,
  ClipboardList,
  FileSpreadsheet,
  Phone,
  Menu,
  X,
  LogOut,
  UserCircle,
  Settings,
  Search as LucideSearch,
  PanelRightClose,
  KeyRound,
  Package,
  ChevronDown,
  ListFilter,
  Layers
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

interface SidebarProps {
  isSupabaseActive: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

function Sidebar({
  isSupabaseActive,
  isOpen = false,
  onClose,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSearchPage = pathname?.startsWith('/search') || pathname?.startsWith('/products');
  const [productsExpanded, setProductsExpanded] = useState(isSearchPage);

  // Auto-expand when navigating to search/products page
  useEffect(() => {
    if (isSearchPage) {
      setProductsExpanded(true);
    }
  }, [isSearchPage]);

  // Close profile popover on outside click / route change
  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isActive = useCallback((href: string) =>
    href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href)), [pathname]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  const currentTab = searchParams?.get('tab') || 'catalog';

  const sidebarContent = (
    <div className="flex flex-col h-full w-64 bg-orange-700 text-white border-l border-orange-800 no-print transition-all duration-300 shadow-xl font-cairo">

      {/* 1. Header & Brand Logo with Hide Sidebar Button */}
      <div className="p-3 sm:p-4 border-b border-orange-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <img
            src="/logo no background.png"
            alt="Lib Moderne - المكتبة العصرية"
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-black text-xs sm:text-base text-white leading-tight truncate">
              المكتبة العصرية
            </h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-orange-100 uppercase tracking-wide truncate mt-0.5">
              Lib Moderne POS
            </p>
          </div>
        </div>

        {/* Hide Sidebar / Collapse Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Desktop Collapse Button */}
          {onToggleDesktopCollapse && (
            <button
              type="button"
              onClick={onToggleDesktopCollapse}
              className="hidden lg:flex p-1.5 sm:p-2 text-white hover:bg-orange-800 rounded-full transition-colors min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          )}

          {/* Mobile Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 text-white hover:bg-orange-800 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation List: Icon + Title + Accordion for Products */}
      <nav className="flex-1 px-2.5 sm:px-3 py-2 sm:py-3.5 space-y-1 sm:space-y-1.5 overflow-y-auto">
        <div className="px-2.5 pb-1 flex items-center justify-between">
          <span className="text-[10px] sm:text-[11px] font-bold text-orange-100 uppercase tracking-wider">
            القائمة الرئيسية
          </span>
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse"></span>
        </div>

        {/* 1. الرئيسية */}
        <Link
          href="/"
          onClick={() => onClose && onClose()}
          className={`w-full flex items-center gap-2.5 sm:gap-3.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
            pathname === '/'
              ? 'bg-white text-orange-700 shadow-md font-black'
              : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            pathname === '/' ? 'text-orange-700' : 'text-white'
          }`} />
          <span className="truncate leading-snug">الرئيسية</span>
        </Link>

        {/* 2. دليل الزبائن */}
        <Link
          href="/customers"
          onClick={() => onClose && onClose()}
          className={`w-full flex items-center gap-2.5 sm:gap-3.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
            isActive('/customers')
              ? 'bg-white text-orange-700 shadow-md font-black'
              : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
          }`}
        >
          <Users className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isActive('/customers') ? 'text-orange-700' : 'text-white'
          }`} />
          <span className="truncate leading-snug">دليل الزبائن</span>
        </Link>

        {/* 3. استقبال وتوزيع السلع */}
        <Link
          href="/stock"
          onClick={() => onClose && onClose()}
          className={`w-full flex items-center gap-2.5 sm:gap-3.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
            isActive('/stock')
              ? 'bg-white text-orange-700 shadow-md font-black'
              : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
          }`}
        >
          <PackageCheck className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isActive('/stock') ? 'text-orange-700' : 'text-white'
          }`} />
          <span className="truncate leading-snug">استقبال وتوزيع السلع</span>
        </Link>

        {/* 4. الموظفين واللوائح */}
        <Link
          href="/lists"
          onClick={() => onClose && onClose()}
          className={`w-full flex items-center gap-2.5 sm:gap-3.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
            isActive('/lists')
              ? 'bg-white text-orange-700 shadow-md font-black'
              : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
          }`}
        >
          <ClipboardList className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isActive('/lists') ? 'text-orange-700' : 'text-white'
          }`} />
          <span className="truncate leading-snug">الموظفين واللوائح</span>
        </Link>

        {/* 5. المنتجات (Nested Accordion) */}
        <div className="space-y-1 pt-0.5">
          <button
            type="button"
            onClick={() => setProductsExpanded(prev => !prev)}
            className={`w-full flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
              isSearchPage
                ? 'bg-orange-800/90 text-white font-black'
                : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <Package className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isSearchPage ? 'text-orange-200' : 'text-white'
              }`} />
              <span className="truncate leading-snug">المنتجات</span>
            </div>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 text-orange-200 group-hover:text-white ${
              productsExpanded ? 'rotate-180' : ''
            }`} />
          </button>

          {/* Sub-links with Indentation & High-contrast styles */}
          {productsExpanded && (
            <div className="mr-3 pr-3 pl-1 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200 border-r-2 border-orange-400/40">
              {/* a) بحث عن منتج */}
              <Link
                href="/search?tab=demands"
                onClick={() => onClose && onClose()}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                  isSearchPage && currentTab === 'demands'
                    ? 'bg-white text-orange-700 shadow-md font-black'
                    : 'text-orange-100 hover:text-white hover:bg-orange-800/70'
                }`}
              >
                <LucideSearch className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">بحث عن منتج</span>
              </Link>

              {/* b) قائمة المنتجات */}
              <Link
                href="/search?tab=catalog"
                onClick={() => onClose && onClose()}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                  isSearchPage && currentTab !== 'demands'
                    ? 'bg-white text-orange-700 shadow-md font-black'
                    : 'text-orange-100 hover:text-white hover:bg-orange-800/70'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">قائمة المنتجات</span>
              </Link>
            </div>
          )}
        </div>

        {/* 6. التقارير والمشتريات */}
        <Link
          href="/reports"
          onClick={() => onClose && onClose()}
          className={`w-full flex items-center gap-2.5 sm:gap-3.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[38px] sm:min-h-[44px] group ${
            isActive('/reports')
              ? 'bg-white text-orange-700 shadow-md font-black'
              : 'text-white hover:bg-orange-800/80 hover:-translate-y-0.5'
          }`}
        >
          <FileSpreadsheet className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
            isActive('/reports') ? 'text-orange-700' : 'text-white'
          }`} />
          <span className="truncate leading-snug">التقارير والمشتريات</span>
        </Link>
      </nav>

      {/* 3. Phone Contacts Card (No Hyperlinks, Non-navigating compact buttons) */}
      <div className="px-2.5 sm:px-3 pb-1.5 sm:pb-2">
        <div className="bg-orange-800/70 border border-orange-600/40 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 space-y-1.5 text-white shadow-inner">
          <div className="flex items-center gap-1.5 text-orange-100 text-[10px] sm:text-xs font-bold">
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span>أرقام هواتف المكتبة:</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-between text-[11px] sm:text-xs font-mono font-bold text-orange-700 hover:bg-orange-50/90 active:bg-orange-100 bg-white px-2.5 py-1 rounded-full transition-colors dir-ltr shadow-2xs cursor-default"
              title="هاتف المكتبة العصرية"
            >
              <span>06.60.56.33.71</span>
              <span className="text-[9px] sm:text-[10px] font-cairo text-neutral-500 font-bold">هاتف</span>
            </button>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-between text-[11px] sm:text-xs font-mono font-bold text-orange-700 hover:bg-orange-50/90 active:bg-orange-100 bg-white px-2.5 py-1 rounded-full transition-colors dir-ltr shadow-2xs cursor-default"
              title="هاتف المكتبة العصرية"
            >
              <span>06.60.31.98.68</span>
              <span className="text-[9px] sm:text-[10px] font-cairo text-neutral-500 font-bold">هاتف</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. User profile & Logout */}
      <div className="px-2.5 sm:px-3 pb-2 sm:pb-3 border-t border-orange-800/80 pt-2 sm:pt-2.5 relative space-y-1.5 sm:space-y-2" ref={profileRef}>
        
        {/* User Account Button */}
        <button
          type="button"
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-bold text-white bg-orange-800/60 hover:bg-orange-800 transition-colors border border-orange-600/30 min-h-[36px] sm:min-h-[40px]"
          title="حساب المستخدم والإعدادات"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-orange-700 flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0 shadow-2xs">
              LM
            </div>
            <div className="text-right truncate">
              <p className="text-[11px] sm:text-xs font-black text-white truncate leading-tight">المكتبة العصرية</p>
              <p className="text-[9px] sm:text-[10px] text-orange-100 font-medium leading-none">طاقم العمل</p>
            </div>
          </div>
          <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white shrink-0" />
        </button>

        {profileOpen && (
          <div className="absolute bottom-full right-2.5 left-2.5 sm:right-3 sm:left-3 mb-2 bg-white text-neutral-900 shadow-2xl rounded-2xl border border-neutral-200 p-2 animate-in fade-in zoom-in-95 duration-150 z-50">
            <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-neutral-100">
              <p className="text-xs font-bold text-neutral-900">المكتبة العصرية — Lib Moderne</p>
              <p dir="ltr" className="text-[10px] sm:text-[11px] font-mono text-neutral-500 text-right mt-0.5">06.60.56.33.71</p>
            </div>
            <div className="py-1 space-y-1">
              {/* Change Password Option */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setShowPasswordModal(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-neutral-700 hover:bg-orange-50 hover:text-orange-700 rounded-xl transition-colors min-h-[34px]"
              >
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5 text-orange-700 shrink-0" />
                <span>تغيير الرمز السري</span>
              </button>

              {/* Logout Option */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-h-[34px]"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        )}

        <div className="text-[9px] sm:text-[10px] text-orange-100 text-center mt-0.5 font-medium">
          نظام المكتبة العصرية • Lib Moderne
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ===== Desktop: Fixed Right Sidebar for RTL (when not collapsed) ===== */}
      {!isDesktopCollapsed && (
        <aside className="hidden lg:block fixed top-0 right-0 bottom-0 z-30 no-print animate-in fade-in duration-200">
          {sidebarContent}
        </aside>
      )}

      {/* ===== Mobile Slide-over Drawer (From Right) ===== */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex justify-end no-print animate-in fade-in duration-150">
          <div className="h-full shadow-2xl animate-in slide-in-from-right duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={onClose}></div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
}

export default React.memo(Sidebar);

