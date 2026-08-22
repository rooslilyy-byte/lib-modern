'use client';

import React, { useState } from 'react';
import { Database, Plus, Search, BookOpen, Tag, Sparkles } from 'lucide-react';
import { MasterProduct } from '@/lib/types';

interface MasterProductsManagerProps {
  products: MasterProduct[];
  onAddProduct: (name: string, category: string) => Promise<void>;
}

export default function MasterProductsManager({
  products,
  onAddProduct,
}: MasterProductsManagerProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('كتب الابتدائية');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'كتب الابتدائية',
    'كتب الإعدادية',
    'كتب التأهيلية',
    'دفاتر وكراسات',
    'أدوات ومستلزمات',
    'معاجم وقصص',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddProduct(name.trim(), category);
      setName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    !searchQuery.trim() || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Add Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">كتالوج السلع والمواد الرئيسية</h2>
            <p className="text-xs text-slate-500">إدارة دليل الكتب والمستلزمات لتزويد خاصية التكميل التلقائي السريع أثناء الإدخال</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>اسم الكتاب أو السلعة:</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: الممتاز في التربية الإسلامية - 1 بكالوريا"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>الفئة / الصنف:</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-bold"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الإضافة...' : 'إضافة سلع للكتالوج'}</span>
          </button>
        </form>
      </div>

      {/* 2. Master Products Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الفئة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800"
            />
          </div>

          <div className="text-xs font-bold text-slate-500 shrink-0">
            إجمالي السلع المسجلة: <span className="text-slate-900">{products.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[480px]">
            <thead>
              <tr className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">اسم السلعة / الكتاب</th>
                <th className="py-3 px-4">الفئة</th>
                <th className="py-3 px-4 text-center">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                    لا توجد نتائج مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod, idx) => (
                  <tr key={prod.id || idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-extrabold text-slate-900 text-sm">{prod.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-500">
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
