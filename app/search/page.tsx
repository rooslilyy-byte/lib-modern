'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Search, ArrowRight, Phone, BookOpen } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

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
      {() => <SearchPageContent searchQuery={searchQuery} setSearchQuery={setSearchQuery} results={results} isLoadingResults={isLoadingResults} />}
    </AppShell>
  );
}

function SearchPageContent({
  searchQuery,
  setSearchQuery,
  results,
  isLoadingResults
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  results: any[];
  isLoadingResults: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner Floating Glass Card with Custom White Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
            <img
              src="/logo-lib-modern-alt.jpg"
              alt="Lib Moderne"
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-neutral-900">{t('search.title')}</h2>
              <span className="bg-orange-50 text-orange-600 border border-orange-200/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                بحث فوري
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">{t('search.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Search Box Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-3">
        <label className="block text-xs font-bold text-neutral-700">
          {t('search.input_placeholder')}
        </label>
        <div className="relative max-w-xl">
          <Search className="w-5 h-5 text-neutral-400 absolute right-4 top-3.5" />
          <input
            type="text"
            placeholder={t('search.input_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/90 border border-neutral-200/80 rounded-full pr-12 pl-5 py-3 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium min-h-[48px] shadow-xs transition-all"
          />
        </div>
      </div>

      {/* Results List */}
      {isLoadingResults ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl">
          <div className="w-10 h-10 border-4 border-neutral-900 border-t-orange-500 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-neutral-700">جاري البحث عن السلعة والطلبات...</p>
        </div>
      ) : searchQuery.trim() && results.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl">
          <BookOpen className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-neutral-700">لا توجد نتائج مطابقة لبحثك</p>
          <p className="text-xs text-neutral-400 mt-1">تأكد من كتابة الاسم بدقة أو جرب كلمات أخرى</p>
        </div>
      ) : results.length > 0 ? (
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
                {results.map((result) => (
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
                        className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-neutral-800 hover:text-orange-600 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200/60 transition-colors dir-ltr"
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
                        className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs px-4 h-9 rounded-full shadow-xs transition-all duration-300 hover:-translate-y-0.5"
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
            {results.map((result) => (
              <div key={result.id} className="p-4 space-y-3 text-right">
                <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2.5">
                  <div>
                    <h4 className="font-extrabold text-neutral-900 text-sm leading-snug">
                      {result.productName}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1">
                      الكمية: <span className="font-bold text-neutral-800">{result.quantity} قطعة</span>
                    </p>
                  </div>
                  <div>
                    {result.isDelivered ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        تم التسليم
                      </span>
                    ) : result.isInStock ? (
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                        جاهز للتسليم
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                        خصاص
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-800">{result.clientName}</p>
                    <p className="font-mono text-neutral-500 dir-ltr text-right">{result.clientPhone}</p>
                  </div>

                  <Link
                    href={`/customers/${encodeURIComponent(result.demandId)}`}
                    className="inline-flex items-center gap-1.5 bg-neutral-900 text-white font-bold text-xs px-4 h-9 rounded-full shadow-xs"
                  >
                    <span>عرض</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
