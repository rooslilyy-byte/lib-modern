'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, BookOpen, Tag } from 'lucide-react';
import { MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';

interface MasterProductsManagerProps {
  products: MasterProduct[];
  onAddProduct: (name: string, category: string) => Promise<void>;
}

function MasterProductsManager({
  products,
  onAddProduct,
}: MasterProductsManagerProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('كتب الابتدائية');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = useMemo(() => [
    'كتب الابتدائية',
    'كتب الإعدادية',
    'كتب التأهيلية',
    'دفاتر وكراسات',
    'أدوات ومستلزمات',
    'معاجم وقصص',
  ], []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddProduct(name.trim(), category);
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, category, onAddProduct]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* 1. Header & Add Form Floating Glass Card with Custom White Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-3.5 mb-6 border-b border-neutral-100 pb-4 flex-wrap">
          <img
            src="/logo-lib-modern.jpg"
            alt="Lib Moderne"
            className="w-12 h-12 object-contain shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-neutral-900">كتالوج السلع والمواد الرئيسية</h2>
            <p className="text-xs text-neutral-500 font-medium">إدارة دليل الكتب والمستلزمات لتزويد خاصية التكميل التلقائي السريع أثناء الإدخال</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-orange-700" />
              <span>اسم الكتاب أو السلعة:</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: الممتاز في التربية الإسلامية - 1 بكالوريا"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-bold h-9 sm:h-11 transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-orange-700" />
              <span>الفئة / الصنف:</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-bold h-9 sm:h-11 transition-all shadow-xs"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-neutral-900 hover:bg-black text-white font-bold text-xs sm:text-sm px-4 sm:px-6 h-9 sm:h-11 rounded-full flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
            <span>{isSubmitting ? 'جاري الإضافة...' : 'إضافة سلع للكتالوج'}</span>
          </button>
        </form>
      </div>

      {/* 2. Master Products Catalog Table Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الفئة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-10 pl-4 h-10 text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 shadow-xs"
            />
          </div>

          <div className="text-xs font-bold text-neutral-500 shrink-0">
            إجمالي السلع المسجلة: <span className="text-neutral-900">{products.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="border border-neutral-200/80 rounded-2xl overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[480px]">
            <thead>
              <tr className="bg-neutral-50 text-neutral-900 font-extrabold border-b border-neutral-200/80">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">اسم السلعة / الكتاب</th>
                <th className="py-3 px-4">الفئة</th>
                <th className="py-3 px-4 text-center">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-neutral-400 font-bold">
                    لا توجد نتائج مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod, idx) => (
                  <tr key={prod.id || idx} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-2.5 px-4 text-center font-bold text-neutral-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-extrabold text-neutral-900 text-sm">{prod.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="bg-neutral-100 text-neutral-700 font-bold px-3 py-1 rounded-full text-[11px]">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-neutral-500 font-medium">
                      {prod.created_at ? new Date(prod.created_at).toLocaleDateString('ar-MA') : 'مسجل'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}

export default React.memo(MasterProductsManager);
