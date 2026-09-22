'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  PackageCheck, 
  FileText, 
  Database, 
  Phone, 
  Archive, 
  Menu, 
  X, 
  Layers
} from 'lucide-react';
import { PurchaseBatch } from '@/lib/types';

interface HeaderProps {
  activeTab: 'demands' | 'stock' | 'supplier' | 'master';
  setActiveTab: (tab: 'demands' | 'stock' | 'supplier' | 'master') => void;
  activeBatch: PurchaseBatch | null;
  onArchiveBatch: (newBatchName: string) => void;
  isSupabaseActive: boolean;
}

export default function Header({
  activeTab,
  setActiveTab,
  activeBatch,
  onArchiveBatch,
  isSupabaseActive
}: HeaderProps) {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;
    onArchiveBatch(newBatchName.trim());
    setNewBatchName('');
    setShowArchiveModal(false);
  };

  const navItems = [
    { id: 'demands', label: 'الرئيسية والطلبات', icon: BookOpen },
    { id: 'stock', label: 'توزيع السلع', icon: PackageCheck },
    { id: 'supplier', label: 'المشتريات (A4)', icon: FileText },
    { id: 'master', label: 'كتالوج السلع', icon: Database },
  ] as const;

  return (
    <>
      {/* Top Header Navbar */}
      <header className="bg-orange-500 text-white shadow-xl border-b border-orange-600 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          
          <div className="flex items-center justify-between gap-3">
            
            {/* Store Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
                <img src="/logo-lib-modern-alt.jpg" alt="Lib Moderne - المكتبة العصرية" className="h-full w-auto object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                    المكتبة العصرية
                  </h1>
                  <span className="text-xs font-semibold text-orange-100">Lib Moderne</span>
                  <span className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                    isSupabaseActive ? 'bg-white/20 text-white border border-white/30' : 'bg-amber-900/30 text-amber-100 border border-amber-400/30'
                  }`}>
                    {isSupabaseActive ? 'قاعدة البيانات' : 'وضع محلي'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-orange-100 font-medium flex items-center gap-2 mt-0.5">
                  <span className="hidden sm:inline">متابعة خصاصات الدخول المدرسي</span>
                  <span className="hidden sm:inline text-orange-200">•</span>
                  <a dir="ltr" href="tel:+212660563371" className="flex items-center gap-1 text-white hover:text-orange-100 font-mono font-bold">
                    <Phone className="w-4 h-4 text-white" />
                    <span>06.60.56.33.71 / 06.60.31.98.68</span>
                  </a>
                </p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-orange-600/70 border border-orange-400/40 rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs text-white">
                <Layers className="w-5 h-5 text-white" />
                <span className="text-orange-100">الدفعة الحالية:</span>
                <span className="font-bold text-white">{activeBatch?.batch_name || 'الدفعة الرئيسية'}</span>
              </div>

              <button
                onClick={() => setShowArchiveModal(true)}
                className="bg-white hover:bg-orange-50 text-orange-600 text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <Archive className="w-4 h-4 text-orange-600" />
                <span>أرشفة الدفعة</span>
              </button>
            </div>

            {/* Mobile Hamburger Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setShowArchiveModal(true)}
                className="bg-white text-orange-600 text-xs p-2 rounded-full shadow-sm"
                title="أرشفة الدفعة"
              >
                <Archive className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-white hover:bg-orange-600 rounded-full bg-orange-600/50"
              >
                {mobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
            </div>

          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center gap-2 mt-4 pt-3 border-t border-orange-600/80 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-orange-600 shadow-md font-black'
                      : 'text-white hover:bg-orange-600/80'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-600 bg-orange-600/95 backdrop-blur p-4 space-y-3 animate-in slide-in-from-top-2 text-white">
            <div className="bg-orange-700/60 p-3 rounded-2xl flex items-center justify-between text-xs border border-orange-500/40">
              <span className="text-orange-100">الدفعة الحالية:</span>
              <span className="font-bold text-white">{activeBatch?.batch_name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white text-orange-600 shadow-md font-black'
                        : 'bg-orange-700/50 text-white hover:bg-orange-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-orange-400 mb-4">
              <Archive className="w-6 h-6" />
              <h3 className="text-lg font-bold">أرشفة الدفعة الحالية وبدء جديدة</h3>
            </div>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              سيتم نقل طلبات الدفعة الحالية ({activeBatch?.batch_name}) للأرشيف، وإنشاء دفعة جديدة فارغة.
            </p>
            <form onSubmit={handleArchive} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  اسم الدفعة الجديدة:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دفعة شتنبر / الأسبوع 2"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/20"
                >
                  تأكيد الأرشفة والبدء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
