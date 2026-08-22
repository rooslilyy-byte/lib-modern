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
  Layers,
  Sparkles
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
      <header className="bg-slate-900 text-white shadow-xl border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          
          <div className="flex items-center justify-between gap-3">
            
            {/* Store Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
                <img src="/logo-izourane.jpg" alt="شعار شركة إيزوران" className="h-12 w-auto object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-slate-100 tracking-tight">
                    مكتبة وراقة اهل سوس
                  </h1>
                  <span className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isSupabaseActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {isSupabaseActive ? 'قاعدة البيانات' : 'وضع محلي'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-sky-300 font-medium flex items-center gap-2 mt-0.5">
                  <span className="hidden sm:inline">متابعة خصاصات الدخول المدرسي</span>
                  <span className="hidden sm:inline text-slate-600">•</span>
                  <a dir="ltr" href="tel:+212661556418" className="flex items-center gap-1 text-slate-300 hover:text-sky-300 font-mono">
                    <Phone className="w-3 h-3 text-sky-400" />
                    <span>+212 661-556418</span>
                  </a>
                </p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-slate-400">الدفعة الحالية:</span>
                <span className="font-semibold text-slate-200">{activeBatch?.batch_name || 'الدفعة الرئيسية'}</span>
              </div>

              <button
                onClick={() => setShowArchiveModal(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20 active:scale-95"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>أرشفة الدفعة</span>
              </button>
            </div>

            {/* Mobile Hamburger Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setShowArchiveModal(true)}
                className="bg-amber-600 text-white text-xs p-2 rounded-lg"
                title="أرشفة الدفعة"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur p-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">الدفعة الحالية:</span>
              <span className="font-bold text-sky-400">{activeBatch?.batch_name}</span>
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
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'text-sky-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <Archive className="w-6 h-6" />
              <h3 className="text-lg font-bold">أرشفة الدفعة الحالية وبدء جديدة</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              سيتم نقل طلبات الدفعة الحالية ({activeBatch?.batch_name}) للأرشيف، وإنشاء دفعة جديدة فارغة.
            </p>
            <form onSubmit={handleArchive} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  اسم الدفعة الجديدة:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دفعة شتنتبر / الأسبوع 2"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-lg shadow-amber-600/20"
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
