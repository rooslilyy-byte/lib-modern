'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Users,
  PackageCheck,
  FileText,
  Phone,
  Menu,
  X,
  LogOut,
  UserCircle,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  isSupabaseActive: boolean;
}

export default function Sidebar({ isSupabaseActive }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
    { href: '/', label: 'الرئيسية', icon: BarChart3 },
    { href: '/customers', label: 'دليل الزبائن', icon: Users },
    { href: '/stock', label: 'استقبال وتوزيع السلع', icon: PackageCheck },
    { href: '/reports', label: 'التقارير والمشتريات', icon: FileText },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href));

  const activeItem = navItems.find(item => isActive(item.href)) || navItems[0];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-64 bg-white border-l border-slate-200 no-print">

      {/* Logo & Branding (wide rectangle logo, stacked) */}
      <div className="flex flex-col items-center justify-center text-center p-4 border-b border-slate-200">
        <img
          src="/logo-izourane.jpg"
          alt="شعار شركة إيزوران"
          className="h-12 w-auto object-contain"
        />
        <span className="text-sm font-bold text-slate-900 mt-1.5">شركة إيزوران</span>
      </div>

      {/* Navigation: icon + label always visible */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">القائمة الرئيسية</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
                active
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Phone shortcut */}
      <div className="px-3 pb-2">
        <a
          href="tel:+212661556418"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[40px]"
        >
          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
          <span dir="ltr" className="font-mono text-right w-full">+212 661-556418</span>
        </a>
      </div>

      {/* User profile popover */}
      <div className="px-3 pb-3 border-t border-slate-200 pt-3 relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          title="حساب المستخدم"
        >
          <UserCircle className="w-5 h-5 text-slate-400 shrink-0" />
          <span>مستخدم الشركة</span>
        </button>

        {profileOpen && (
          <div className="absolute bottom-full right-3 left-3 mb-2 bg-white shadow-lg rounded-xl border border-slate-200 py-2 animate-in fade-in duration-150 z-50">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">مستخدم الشركة</p>
              <p dir="ltr" className="text-xs text-slate-500 text-right">+212 661-556418</p>
            </div>
            <div className="py-1">
              <div className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 cursor-not-allowed">
                <UserCircle className="w-4 h-4 text-slate-400" />
                <span>الملف الشخصي</span>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 cursor-not-allowed">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>إعدادات الحساب</span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-400 text-center mt-2">
          نظام إدارة الخصاصات POS v2.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ===== Desktop: Static single sidebar (Right side, RTL) ===== */}
      <aside className="hidden lg:block fixed top-0 right-0 bottom-0 z-30 no-print">
        {sidebarContent}
      </aside>

      {/* ===== Mobile: Top bar + slide-out drawer ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white text-slate-900 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shadow-sm no-print min-h-[56px] w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            title="القائمة الرئيسية"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/logo-izourane.jpg" alt="شعار شركة إيزوران" className="h-8 w-auto object-contain shrink-0" />
            <div>
              <h1 className="font-extrabold text-xs text-slate-900 leading-tight">شركة إيزوران</h1>
              <span className="text-[10px] text-slate-500 font-bold block">{activeItem?.label}</span>
            </div>
          </div>
        </div>

        <a
          dir="ltr"
          href="tel:+212661556418"
          className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-1.5 min-h-[44px] hover:text-slate-900"
        >
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span>+212 661-556418</span>
        </a>
      </div>

      {/* Mobile Slide-over Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-start no-print animate-in fade-in duration-150">
          <div className="h-full shadow-2xl animate-in slide-in-from-right duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)}></div>
        </div>
      )}
    </>
  );
}
