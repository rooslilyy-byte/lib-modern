'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell, { AppShellData } from '@/components/AppShell';
import { 
  Search, 
  ArrowRight, 
  Phone, 
  BookOpen, 
  CheckCircle2, 
  Package, 
  X,
  Users,
  ArrowDownAZ,
  ArrowUpZA,
  ListFilter,
  ChevronRight,
  ChevronLeft,
  Pencil,
  Trash2
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { MasterProduct } from '@/lib/types';
import { 
  PRODUCT_CATEGORIES, 
  ProductCategoryKey, 
  normalizeCategory, 
  getCategoryConfig, 
  getCategoryLabel 
} from '@/lib/categoryUtils';
import { compareProductNames, compareProductNamesDesc } from '@/lib/sortUtils';

const PAGE_SIZE = 100;

interface SearchPageContentProps {
  appData: AppShellData;
}

function SearchPageContent({ appData }: SearchPageContentProps) {
  const { masterProducts, handleUpdateProductCategory, handleUpdateMasterProduct, handleDeleteMasterProduct } = appData;
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mode: 'catalog' (Fast Categorization & Products Directory) or 'demands' (Search Customer Orders)
  const tabFromUrl = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<'catalog' | 'demands'>(
    tabFromUrl === 'demands' ? 'demands' : 'catalog'
  );

  useEffect(() => {
    if (tabFromUrl === 'demands') {
      setActiveTab('demands');
    } else if (tabFromUrl === 'catalog') {
      setActiveTab('catalog');
    }
  }, [tabFromUrl]);

  const handleTabSwitch = (tab: 'catalog' | 'demands') => {
    setActiveTab(tab);
    router.replace(`/search?tab=${tab}`, { scroll: false });
  };

  // Filter, Search, Sort & Pagination States for Catalog
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategoryKey>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<ProductCategoryKey>('books');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Product Confirmation State
  const [deletingProduct, setDeletingProduct] = useState<MasterProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, catalogSearch, sortOrder]);

  // States for Live Demands Search
  const [demandSearchQuery, setDemandSearchQuery] = useState('');
  const [demandResults, setDemandResults] = useState<any[]>([]);
  const [isLoadingDemandResults, setIsLoadingDemandResults] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Category counts calculation across all master products (Strictly 3 categories)
  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | ProductCategoryKey, number> = {
      all: masterProducts.length,
      books: 0,
      fournitures: 0,
      others: 0,
    };

    for (const p of masterProducts) {
      const cat = normalizeCategory(p.category);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.others++;
      }
    }
    return counts;
  }, [masterProducts]);

  // Filtered and Sorted master products
  const filteredProducts = useMemo(() => {
    const searchLower = catalogSearch.trim().toLowerCase();
    
    return masterProducts
      .filter((p) => {
        // Category filter
        if (selectedCategory !== 'all') {
          const cat = normalizeCategory(p.category);
          if (cat !== selectedCategory) return false;
        }

        // Text search filter
        if (searchLower) {
          const nameMatch = (p.name || '').toLowerCase().includes(searchLower);
          const catMatch = (p.category || '').toLowerCase().includes(searchLower);
          if (!nameMatch && !catMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'desc') {
          return compareProductNamesDesc(a.name, b.name);
        }
        return compareProductNames(a.name, b.name);
      });
  }, [masterProducts, selectedCategory, catalogSearch, sortOrder]);

  // Pagination calculation (100 products per page)
  const totalFiltered = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const fromIndex = (currentPage - 1) * PAGE_SIZE;
  const toIndex = Math.min(fromIndex + PAGE_SIZE, totalFiltered);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(fromIndex, toIndex);
  }, [filteredProducts, fromIndex, toIndex]);

  // Handle single-click category change
  const handleChangeCategory = useCallback(async (product: MasterProduct, newCat: ProductCategoryKey) => {
    const currentCat = normalizeCategory(product.category);
    if (currentCat === newCat) return; // No change needed

    setUpdatingProductId(product.id);
    try {
      const catConfig = getCategoryConfig(newCat);
      await handleUpdateProductCategory(product.id, catConfig.label, product.name);
      showToast(`تم تغيير صنف "${product.name}" إلى ${catConfig.label}`);
    } catch (err) {
      console.error('Failed to update category:', err);
      showToast(`حدث خطأ أثناء تحديث صنف "${product.name}"`);
    } finally {
      setUpdatingProductId(null);
    }
  }, [handleUpdateProductCategory, showToast]);

  // Open Edit Product Modal
  const handleOpenEditModal = useCallback((product: MasterProduct) => {
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditCategory(normalizeCategory(product.category));
  }, []);

  // Submit Edit Product
  const handleSaveEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      const categoryLabel = getCategoryLabel(editCategory);
      await handleUpdateMasterProduct(editingProduct.id, {
        name: editName.trim(),
        category: categoryLabel,
      });
      showToast(`تم تحديث المنتج "${editName.trim()}" بنجاح`);
      setEditingProduct(null);
    } catch (err) {
      console.error('Failed to update product:', err);
      showToast(`حدث خطأ أثناء تحديث المنتج`);
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingProduct, editName, editCategory, handleUpdateMasterProduct, showToast]);

  // Confirm Delete Product
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingProduct) return;

    setIsDeleting(true);
    const prodName = deletingProduct.name;
    try {
      await handleDeleteMasterProduct(deletingProduct.id, deletingProduct.name);
      showToast(`تم حذف المنتج "${prodName}" بنجاح`);
      setDeletingProduct(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
      showToast(`حدث خطأ أثناء حذف المنتج`);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingProduct, handleDeleteMasterProduct, showToast]);

  // Debounced Demands Search API
  useEffect(() => {
    const fetchResults = async () => {
      const trimmed = demandSearchQuery.trim();
      if (!trimmed) {
        setDemandResults([]);
        return;
      }
      setIsLoadingDemandResults(true);
      try {
        const res = await fetch(`/api/search-product?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success) {
          setDemandResults(data.results || []);
        } else {
          console.error(data.message);
        }
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        setIsLoadingDemandResults(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 250);
    return () => clearTimeout(debounceTimer);
  }, [demandSearchQuery]);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white font-bold text-xs sm:text-sm px-5 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top duration-200 border border-neutral-700">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/logo-lib-modern.jpg"
            alt="Lib Moderne"
            className="w-12 h-12 object-contain shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-neutral-900">
                {activeTab === 'catalog' ? 'دليل وقائمة المنتجات' : 'البحث عن خصاصات الزبناء'}
              </h2>
              <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {masterProducts.length} منتج مسجل
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {activeTab === 'catalog' 
                ? 'تصفح وتصنيف جميع المنتجات وترتيبها وتعديلها بنقرة واحدة' 
                : 'البحث عن خصاص محدد ومعرفة الزبائن المرتبطين به وحالة توفره'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center bg-neutral-100/90 p-1 rounded-2xl border border-neutral-200/70 self-start md:self-auto shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch('catalog')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/60 font-black'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5 text-amber-700" />
            <span>قائمة المنتجات والتصنيف</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('demands')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'demands'
                ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/60 font-black'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-amber-700" />
            <span>بحث عن منتج (الزبناء)</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: PRODUCTS DIRECTORY & FAST CATEGORIZATION         */}
      {/* ======================================================== */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          
          {/* Controls Card: Category Tabs + Search + E-Commerce Sorting */}
          <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 space-y-3.5">
            
            {/* 1. Category Filter Tabs (High contrast: Amber active vs White/Gray inactive) */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
              {/* All */}
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-amber-600 text-white shadow-sm font-black'
                    : 'bg-white text-gray-700 hover:bg-amber-50 hover:text-amber-700 border border-gray-200'
                }`}
              >
                <span>الكل</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {categoryCounts.all}
                </span>
              </button>

              {/* Specific 3 Categories (كتب / أدوات / أخرى) */}
              {PRODUCT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                const count = categoryCounts[cat.key] || 0;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-sm font-black'
                        : 'bg-white text-gray-700 hover:bg-amber-50 hover:text-amber-700 border border-gray-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 2. Text Search Input & Standard E-Commerce Sorting */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم في دليل المنتجات..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl pr-10 pl-10 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium shadow-xs transition-all"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute left-3 top-2.5 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Standard E-Commerce Sorting Controls */}
              <div className="flex items-center bg-neutral-100 p-1 rounded-2xl border border-neutral-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setSortOrder('asc')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    sortOrder === 'asc'
                      ? 'bg-white text-amber-700 shadow-xs font-black'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="ترتيب أبجدي تصاعدي"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>ترتيب أبجدي (أ - ي / A - Z)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    sortOrder === 'desc'
                      ? 'bg-white text-amber-700 shadow-xs font-black'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="ترتيب أبجدي تنازلي"
                >
                  <ArrowUpZA className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>ترتيب أبجدي عكسي (ي - أ / Z - A)</span>
                </button>
              </div>

            </div>

          </div>

          {/* Results Range & Progress Summary */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2 text-xs font-bold text-neutral-600">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>
                عرض <span className="font-mono font-black text-neutral-900">{totalFiltered > 0 ? fromIndex + 1 : 0}</span> إلى{' '}
                <span className="font-mono font-black text-neutral-900">{toIndex}</span> من أصل{' '}
                <span className="font-mono font-black text-amber-700">{totalFiltered}</span> منتج
              </span>
              {selectedCategory !== 'all' && (
                <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full text-[11px]">
                  صنف: {getCategoryLabel(selectedCategory)}
                </span>
              )}
              {totalFiltered < masterProducts.length && (
                <span className="text-neutral-400 text-[11px]">
                  (إجمالي قاعدة البيانات: {masterProducts.length})
                </span>
              )}
              <span className="text-neutral-400 text-[11px]">
                • {sortOrder === 'asc' ? 'أبجدياً (أ - ي)' : 'أبجدياً عكسياً (ي - أ)'}
              </span>
            </div>

            {(selectedCategory !== 'all' || catalogSearch || sortOrder !== 'asc') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setCatalogSearch('');
                  setSortOrder('asc');
                  setCurrentPage(1);
                }}
                className="text-amber-700 hover:text-amber-800 hover:underline font-bold text-xs shrink-0 cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>

          {/* Products List / Table Card */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl space-y-2">
              <Package className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="text-sm font-bold text-neutral-700">لا توجد منتجات مطابقة لهذا الفلتر</p>
              <p className="text-xs text-neutral-400">جرب اختيار صنف آخر أو إفراغ خانة البحث</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl overflow-hidden">
                
                {/* Desktop Products Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/70 border-b border-neutral-100 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">
                        <th className="px-6 py-3.5 w-16">#</th>
                        <th className="px-6 py-3.5">اسم المنتج</th>
                        <th className="px-6 py-3.5 text-center w-36">الصنف الحالي</th>
                        <th className="px-6 py-3.5 text-center w-[400px]">تغيير الصنف والإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {paginatedProducts.map((product, idx) => {
                        const currentCatKey = normalizeCategory(product.category);
                        const currentConfig = getCategoryConfig(product.category);
                        const isSavingThis = updatingProductId === product.id;

                        return (
                          <tr key={product.id || idx} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="px-6 py-3.5 text-xs font-mono text-neutral-400 font-bold">
                              {fromIndex + idx + 1}
                            </td>
                            <td className="px-6 py-3.5 font-extrabold text-neutral-900 text-sm max-w-sm">
                              <div className="flex items-center gap-2">
                                <span>{product.name}</span>
                                {isSavingThis && (
                                  <span className="w-3.5 h-3.5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full border ${currentConfig.badgeBg}`}>
                                <span>{currentConfig.label}</span>
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center justify-center gap-2">
                                {/* Fast Categorize Pills (Strictly 3 categories) */}
                                <div className="flex items-center gap-1.5">
                                  {PRODUCT_CATEGORIES.map((cat) => {
                                    const isCurrent = currentCatKey === cat.key;
                                    return (
                                      <button
                                        key={cat.key}
                                        type="button"
                                        disabled={isSavingThis}
                                        onClick={() => handleChangeCategory(product, cat.key)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                          isCurrent
                                            ? 'bg-amber-600 text-white font-bold border border-transparent shadow-xs scale-105 ring-2 ring-amber-600/20'
                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                        }`}
                                      >
                                        {cat.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="h-4 w-px bg-gray-200 mx-0.5"></div>

                                {/* Edit & Delete Action Buttons */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(product)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                    title="تعديل المنتج"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingProduct(product)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="حذف المنتج"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Product Cards */}
                <div className="lg:hidden divide-y divide-neutral-100">
                  {paginatedProducts.map((product, idx) => {
                    const currentCatKey = normalizeCategory(product.category);
                    const currentConfig = getCategoryConfig(product.category);
                    const isSavingThis = updatingProductId === product.id;

                    return (
                      <div key={product.id || idx} className="p-3.5 sm:p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-neutral-400 shrink-0">
                              #{fromIndex + idx + 1}
                            </span>
                            <h4 className="font-extrabold text-neutral-900 text-xs sm:text-sm leading-snug">
                              {product.name}
                            </h4>
                            {isSavingThis && (
                              <span className="w-3 h-3 border-2 border-amber-700 border-t-transparent rounded-full animate-spin shrink-0"></span>
                            )}
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${currentConfig.badgeBg}`}>
                            {currentConfig.label}
                          </span>
                        </div>

                        {/* Fast Category Toggle Buttons & Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100/80">
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-neutral-500 ml-1">تحديد الصنف:</span>
                            {PRODUCT_CATEGORIES.map((cat) => {
                              const isCurrent = currentCatKey === cat.key;
                              return (
                                <button
                                  key={cat.key}
                                  type="button"
                                  disabled={isSavingThis}
                                  onClick={() => handleChangeCategory(product, cat.key)}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-amber-600 text-white font-bold border border-transparent shadow-xs ring-1 ring-amber-600/20'
                                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50 hover:text-amber-700'
                                  }`}
                                >
                                  {cat.label}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(product)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="تعديل المنتج"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(product)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* 3. Responsive Pagination Controls Bar (100 items per page) */}
              {totalPages > 1 && (
                <div className="bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-cairo">
                  <div className="text-xs font-bold text-neutral-600">
                    عرض <span className="font-mono font-black text-neutral-900">{fromIndex + 1}</span> إلى{' '}
                    <span className="font-mono font-black text-neutral-900">{toIndex}</span> من أصل{' '}
                    <span className="font-mono font-black text-amber-700">{totalFiltered}</span> منتج
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Previous button */}
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-white text-gray-900 border border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 shrink-0" />
                      <span>السابق</span>
                    </button>

                    {/* Page Indicator */}
                    <div className="flex items-center gap-1.5 bg-neutral-100 px-3.5 py-1.5 sm:py-2 rounded-xl border border-neutral-200/80 text-xs font-bold">
                      <span className="text-neutral-500">الصفحة</span>
                      <span className="font-mono font-black text-amber-700">{currentPage}</span>
                      <span className="text-neutral-400">من</span>
                      <span className="font-mono font-black text-neutral-800">{totalPages}</span>
                    </div>

                    {/* Next button */}
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-white text-gray-900 border border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 shrink-0" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Product Modal */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div 
                className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900">تعديل بيانات المنتج</h3>
                      <p className="text-xs text-gray-500">تحديث اسم وتصنيف السلعة</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      اسم المنتج / الكتاب:
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم المنتج..."
                      className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-2xs"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      الفئة / الصنف:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRODUCT_CATEGORIES.map((cat) => {
                        const isSelected = editCategory === cat.key;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setEditCategory(cat.key)}
                            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-black'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:text-amber-700'
                            }`}
                          >
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEdit || !editName.trim()}
                      className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSavingEdit && (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      )}
                      <span>{isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Product Confirmation Modal */}
          {deletingProduct && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div 
                className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-sm p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-gray-900">حذف منتج</h3>
                    <p className="text-xs text-gray-500">حذف نهائي من دليل المنتجات</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed">
                  هل أنت متأكد من حذف هذا المنتج؟
                </p>

                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-bold text-gray-900 break-words">
                  {deletingProduct.name}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingProduct(null)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isDeleting && (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    )}
                    <span>{isDeleting ? 'جاري الحذف...' : 'حذف'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: SEARCH CUSTOMER DEMANDS & MISSING ITEMS         */}
      {/* ======================================================== */}
      {activeTab === 'demands' && (
        <div className="space-y-4">
          {/* Search Input Floating Glass Card */}
          <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-2.5 sm:space-y-3">
            <label className="block text-xs font-bold text-neutral-700">
              {t('search.input_placeholder')}
            </label>
            <div className="relative max-w-xl">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 absolute right-3.5 top-3 sm:right-4 sm:top-3.5" />
              <input
                type="text"
                placeholder={t('search.input_placeholder')}
                value={demandSearchQuery}
                onChange={(e) => setDemandSearchQuery(e.target.value)}
                className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-10 sm:pr-12 pl-4 sm:pl-5 py-2.5 sm:py-3 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium min-h-[40px] sm:min-h-[48px] shadow-xs transition-all"
              />
            </div>
          </div>

          {/* Live Search Results */}
          {isLoadingDemandResults ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl">
              <div className="w-10 h-10 border-4 border-neutral-900 border-t-orange-700 rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-neutral-700">جاري البحث عن السلعة والطلبات...</p>
            </div>
          ) : demandSearchQuery.trim() && demandResults.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl">
              <BookOpen className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-700">لا توجد نتائج مطابقة لبحثك</p>
              <p className="text-xs text-neutral-400 mt-1">تأكد من كتابة الاسم بدقة أو جرب كلمات أخرى</p>
            </div>
          ) : demandResults.length > 0 ? (
            <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/60 border-b border-neutral-100 text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5 font-extrabold">اسم المنتج المطلوب</th>
                      <th className="px-6 py-3.5 font-extrabold">اسم الزبون</th>
                      <th className="px-6 py-3.5 font-extrabold">رقم الهاتف (الواتساب)</th>
                      <th className="px-6 py-3.5 font-extrabold text-center">الكمية</th>
                      <th className="px-6 py-3.5 font-extrabold text-center">حالة السلعة</th>
                      <th className="px-6 py-3.5 font-extrabold text-left">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {demandResults.map((result) => (
                      <tr key={result.id} className="hover:bg-white transition-colors">
                        <td className="px-6 py-4 font-extrabold text-neutral-900 text-sm max-w-[260px] truncate">
                          {result.productName}
                        </td>
                        <td className="px-6 py-4 font-bold text-neutral-700 text-xs">
                          {result.clientName}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`tel:${result.clientPhone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-neutral-800 hover:text-orange-700 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200/60 transition-colors dir-ltr"
                          >
                            <Phone className="w-3 h-3 text-neutral-500" />
                            <span>{result.clientPhone}</span>
                          </a>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-neutral-900 text-sm">
                          {result.fulfilledQuantity && result.fulfilledQuantity > 0 && !result.isInStock ? (
                            <div className="flex flex-col items-center">
                              <span>{result.quantity} قطع</span>
                              <span className="text-[10px] text-rose-600 font-bold">
                                المتبقي: {Math.max(0, result.quantity - result.fulfilledQuantity)}
                              </span>
                            </div>
                          ) : (
                            <span>{result.quantity} قطع</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {result.isDelivered ? (
                            <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                              تم التسليم
                            </span>
                          ) : result.isInStock ? (
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                              جاهز للتسليم
                            </span>
                          ) : result.fulfilledQuantity && result.fulfilledQuantity > 0 ? (
                            <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                              توفير جزئي ({result.fulfilledQuantity}/{result.quantity})
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1 rounded-full border border-rose-200">
                              خصاص معلق
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-left">
                          <Link
                            href={`/customers/${encodeURIComponent(result.demandId)}`}
                            className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs px-3.5 sm:px-4 h-8 sm:h-9 rounded-full shadow-xs transition-all duration-300 hover:-translate-y-0.5"
                          >
                            <span>عرض الملف</span>
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-neutral-100">
                {demandResults.map((result) => (
                  <div key={result.id} className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 text-right">
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2">
                      <div>
                        <h4 className="font-extrabold text-neutral-900 text-xs sm:text-sm leading-snug">
                          {result.productName}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                          الكمية: <span className="font-bold text-neutral-800">{result.quantity} قطعة</span>
                        </p>
                      </div>
                      <div>
                        {result.isDelivered ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            تم التسليم
                          </span>
                        ) : result.isInStock ? (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            جاهز للتسليم
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                            خصاص
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-neutral-800 text-xs">{result.clientName}</p>
                        <p className="font-mono text-neutral-500 dir-ltr text-right text-[11px]">{result.clientPhone}</p>
                      </div>

                      <Link
                        href={`/customers/${encodeURIComponent(result.demandId)}`}
                        className="inline-flex items-center gap-1 bg-neutral-900 text-white font-bold text-[11px] sm:text-xs px-3 sm:px-4 h-7 sm:h-9 rounded-full shadow-xs"
                      >
                        <span>عرض</span>
                        <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl">
              <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-neutral-500">اكتب اسم كتاب أو زبون أعلاه للبحث في جميع الخصاصات</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function SearchPage() {
  return (
    <AppShell>
      {(appData) => (
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-orange-700 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <SearchPageContent appData={appData} />
        </Suspense>
      )}
    </AppShell>
  );
}
