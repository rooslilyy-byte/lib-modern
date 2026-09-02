'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Search, ArrowRight, Phone, BookOpen } from 'lucide-react';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      setIsLoadingResults(true);
      try {
        const res = await fetch(`/api/search-product?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.results || []);
        } else {
          console.error(data.message);
        }
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        setIsLoadingResults(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <AppShell>
      {() => (
        <div className="space-y-4" dir="rtl">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">البحث عن منتج</h2>
                <p className="text-xs text-slate-500">البحث عن خصاص محدد ومعرفة الزبائن المرتبطين به</p>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اكتب اسم الكتاب أو المنتج للبحث:
              </label>
              <div className="relative max-w-xl">
                <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="مثال: الواضح في اللغة العربية..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-11 pl-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-slate-800 font-medium min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Results List */}
          {isLoadingResults ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="w-8 h-8 border-3 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-600">جاري البحث عن السلعة...</p>
            </div>
          ) : searchQuery.trim() && results.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-bold text-slate-600">لا توجد نتائج مطابقة لبحثك</p>
            </div>
          ) : results.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3 font-black">اسم المنتج المطلوب</th>
                      <th className="px-6 py-3 font-black">اسم الزبون</th>
                      <th className="px-6 py-3 font-black">رقم الهاتف (الواتساب)</th>
                      <th className="px-6 py-3 font-black text-center">الكمية</th>
                      <th className="px-6 py-3 font-black text-center">حالة السلعة</th>
                      <th className="px-6 py-3 font-black text-left">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {results.map((result) => (
                      <tr key={result.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-extrabold text-slate-900 text-sm max-w-[260px] truncate">
                          {result.productName}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-700 text-xs">
                          {result.clientName}
                        </td>
                        <td className="px-6 py-3.5">
                          <a
                            href={`tel:${result.clientPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold font-mono text-slate-700 hover:text-slate-900 bg-slate-100/90 hover:bg-slate-200/90 px-2 py-0.5 rounded border border-slate-200 transition-colors dir-ltr"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{result.clientPhone}</span>
                          </a>
                        </td>
                        <td className="px-6 py-3.5 text-center font-black text-slate-900 text-sm">
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
                        <td className="px-6 py-3.5 text-center">
                          {result.isDelivered ? (
                            <span className="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1">
                              تم التسليم
                            </span>
                          ) : result.isInStock ? (
                            <span className="bg-blue-50 text-blue-700 text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1">
                              جاهز للتسليم
                            </span>
                          ) : result.fulfilledQuantity && result.fulfilledQuantity > 0 ? (
                            <span className="bg-amber-50 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 border border-amber-200">
                              توفير جزئي ({result.fulfilledQuantity}/{result.quantity})
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-700 text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1">
                              خصاص معلق
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-left">
                          <Link
                            href={`/customers/${encodeURIComponent(result.demandId)}`}
                            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3 h-8 rounded-lg shadow-2xs transition-colors"
                          >
                            <span>عرض الطلب</span>
                            <ArrowRight className="w-3 h-3 rotate-180" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {results.map((result) => (
                  <div key={result.id} className="p-4 space-y-3 text-right">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                          {result.productName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          الكمية: <span className="font-bold text-slate-800">{result.quantity} قطعة</span>
                          {result.fulfilledQuantity && result.fulfilledQuantity > 0 && !result.isInStock && (
                            <span className="text-rose-600 font-bold mr-2">
                              (المتبقي: {Math.max(0, result.quantity - result.fulfilledQuantity)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        {result.isDelivered ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            تم التسليم
                          </span>
                        ) : result.isInStock ? (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            جاهز للتسليم
                          </span>
                        ) : result.fulfilledQuantity && result.fulfilledQuantity > 0 ? (
                          <span className="bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-200">
                            توفير جزئي ({result.fulfilledQuantity}/{result.quantity})
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            خصاص
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium">الزبون:</span>{' '}
                        <span className="font-bold text-slate-800">{result.clientName}</span>
                      </div>

                      <a
                        href={`tel:${result.clientPhone}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 dir-ltr"
                      >
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{result.clientPhone}</span>
                      </a>
                    </div>

                    <div className="pt-1">
                      <Link
                        href={`/customers/${encodeURIComponent(result.demandId)}`}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>عرض ملف الطلب الكامل</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-bold text-slate-500">اكتب اسم المنتج المطلوب في مربع البحث أعلاه لبدء عملية البحث.</p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
