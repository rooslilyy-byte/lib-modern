'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  PackageCheck,
  FileSpreadsheet,
  Phone,
  Menu,
  X,
  LogOut,
  UserCircle,
  Settings,
  Search as LucideSearch,
  PanelLeftClose,
} from 'lucide-react';

interface SidebarProps {
  isSupabaseActive: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

export default function Sidebar({
  isSupabaseActive,
  isOpen = false,
  onClose,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  const navItems = [
    { href: '/', label: 'الرئيسية', subtitle: 'Dashboard', icon: LayoutDashboard },
    { href: '/customers', label: 'دليل الزبائن', subtitle: 'Clients', icon: Users },
    { href: '/stock', label: 'استقبال وتوزيع السلع', subtitle: 'Stock & Dispatch', icon: PackageCheck },
    { href: '/search', label: 'بحث عن منتج', subtitle: 'Search Catalog', icon: LucideSearch },
    { href: '/reports', label: 'التقارير والمشتريات', subtitle: 'A4 Reports', icon: FileSpreadsheet },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href));

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-64 bg-orange-500 text-white border-r border-orange-600 no-print transition-all duration-300 shadow-xl font-cairo">

      {/* 1. Header & Brand Logo with Hide Sidebar Button */}
      <div className="p-4 border-b border-orange-600/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
            <img
              src="/logo-lib-modern-alt.jpg"
              alt="Lib Moderne - المكتبة العصرية"
              className="h-full w-auto object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-base text-white leading-tight truncate">
              المكتبة العصرية
            </h1>
            <p className="text-[10px] font-bold text-orange-100 uppercase tracking-wide truncate mt-0.5">
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
              className="hidden lg:flex p-2 text-white hover:bg-orange-600 rounded-full transition-colors min-h-[40px] min-w-[40px] items-center justify-center"
              title="إخفاء القائمة الجانبية"
            >
              <PanelLeftClose className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Mobile Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 text-white hover:bg-orange-600 rounded-full transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="إغلاق القائمة"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation List: Icon + Title */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-orange-100 uppercase tracking-wider">
            القائمة الرئيسية
          </span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose && onClose()}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 min-h-[44px] group ${
                active
                  ? 'bg-white text-orange-600 shadow-md font-black'
                  : 'text-white hover:bg-orange-600/80 hover:-translate-y-0.5'
              }`}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                active ? 'text-orange-600' : 'text-white'
              }`} />
              <span className="truncate leading-snug">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 3. Phone Contacts Card */}
      <div className="px-3 pb-2">
        <div className="bg-orange-600/70 border border-orange-400/40 rounded-2xl p-3 space-y-2 text-white shadow-inner">
          <div className="flex items-center gap-2 text-orange-100 text-xs font-bold">
            <Phone className="w-5 h-5 text-white shrink-0" />
            <span>أرقام هواتف المكتبة:</span>
          </div>
          <div className="space-y-1.5">
            <a
              href="tel:+212660563371"
              className="flex items-center justify-between text-xs font-mono font-black text-orange-600 hover:text-orange-700 bg-white px-3 py-1.5 rounded-full transition-colors dir-ltr shadow-xs"
            >
              <span>06.60.56.33.71</span>
              <span className="text-[10px] font-cairo text-neutral-500 font-bold">اتصال</span>
            </a>
            <a
              href="tel:+212660319868"
              className="flex items-center justify-between text-xs font-mono font-black text-orange-600 hover:text-orange-700 bg-white px-3 py-1.5 rounded-full transition-colors dir-ltr shadow-xs"
            >
              <span>06.60.31.98.68</span>
              <span className="text-[10px] font-cairo text-neutral-500 font-bold">اتصال</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. User profile & Logout */}
      <div className="px-3 pb-3 border-t border-orange-600/80 pt-3 relative space-y-2" ref={profileRef}>
        
        {/* User Account Button */}
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-white bg-orange-600/60 hover:bg-orange-600 transition-colors border border-orange-400/30"
          title="حساب المستخدم"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white text-orange-600 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              LM
            </div>
            <div className="text-right truncate">
              <p className="text-xs font-black text-white truncate">المكتبة العصرية</p>
              <p className="text-[10px] text-orange-100 font-medium">طاقم العمل</p>
            </div>
          </div>
          <Settings className="w-5 h-5 text-white shrink-0" />
        </button>

        {profileOpen && (
          <div className="absolute bottom-full right-3 left-3 mb-2 bg-white text-neutral-900 shadow-2xl rounded-2xl border border-neutral-200 p-2 animate-in fade-in zoom-in-95 duration-150 z-50">
            <div className="px-3 py-2 border-b border-neutral-100">
              <p className="text-xs font-bold text-neutral-900">المكتبة العصرية — Lib Moderne</p>
              <p dir="ltr" className="text-[11px] font-mono text-neutral-500 text-right mt-0.5">06.60.56.33.71</p>
            </div>
            <div className="py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <LogOut className="w-5 h-5 text-rose-600" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-orange-100 text-center mt-1 font-medium">
          نظام المكتبة العصرية • Lib Moderne
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ===== Desktop: Fixed Left Sidebar (when not collapsed) ===== */}
      {!isDesktopCollapsed && (
        <aside className="hidden lg:block fixed top-0 left-0 bottom-0 z-30 no-print animate-in fade-in duration-200">
          {sidebarContent}
        </aside>
      )}

      {/* ===== Mobile Slide-over Drawer (From Left) ===== */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex justify-start no-print animate-in fade-in duration-150">
          <div className="h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={onClose}></div>
        </div>
      )}
    </>
  );
}
