'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ShoppingCart, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { SupplierAggregatedItem, PurchaseBatch, ClientDemand } from '@/lib/types';
import { getSupplierAggregatedReport } from '@/lib/dataStore';
import { compareProductNames } from '@/lib/sortUtils';
import { useLanguage } from '@/lib/languageContext';

type ReportTab = 'normal' | 'rupture';

interface SupplierBuyingSheetProps {
  activeBatch: PurchaseBatch | null;
  demands?: ClientDemand[];
  onArchiveBatch?: (newBatchName: string) => void;
}

export default function SupplierBuyingSheet({
  activeBatch,
  demands,
}: SupplierBuyingSheetProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ReportTab>('normal');
  const [fetchedReport, setFetchedReport] = useState<SupplierAggregatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReport = async (tab: ReportTab) => {
    setIsLoading(true);
    try {
      const data = await getSupplierAggregatedReport(activeBatch?.id, tab);
      setFetchedReport(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!demands) {
      fetchReport(activeTab);
    } else {
      setIsLoading(false);
    }
  }, [activeBatch, demands, activeTab]);

  const { normalReport, ruptureReport } = useMemo(() => {
    if (!demands) return { normalReport: [], ruptureReport: [] };
    const normalMap: Record<string, SupplierAggregatedItem> = {};
    const ruptureMap: Record<string, SupplierAggregatedItem> = {};

    for (const dem of demands) {
      if (!dem.items || !dem.client) continue;

      for (const item of dem.items) {
        if (item.is_delivered || item.is_in_stock) continue;

        const isRupture = item.status === 'en_rupture';
        const targetMap = isRupture ? ruptureMap : normalMap;

        const totalQty = Number(item.quantity) || 0;
        const fulfilledQty = Number(item.fulfilled_quantity) || 0;
        const stillNeeded = Math.max(0, totalQty - fulfilledQty);
        if (stillNeeded <= 0) continue;

        const pName = item.product_name.trim();
        if (!targetMap[pName]) {
          targetMap[pName] = {
            productName: pName,
            totalQuantity: 0,
            clients: [],
          };
        }

        targetMap[pName].totalQuantity += stillNeeded;
        targetMap[pName].clients.push({
          clientName: dem.client.name,
          phone: dem.client.phone,
          quantity: stillNeeded,
          demandId: dem.id,
        });
      }
    }

    return {
      normalReport: Object.values(normalMap),
      ruptureReport: Object.values(ruptureMap),
    };
  }, [demands]);

  const rawReport = demands 
    ? (activeTab === 'normal' ? normalReport : ruptureReport) 
    : fetchedReport;

  // Alphabetical sorting
  const report = useMemo(() => {
    return [...rawReport].sort((a, b) => compareProductNames(a.productName, b.productName));
  }, [rawReport]);

  const handlePrint = () => {
    window.print();
  };

  const totalItemTypes = report.length;
  const totalPiecesCount = report.reduce((acc, curr) => acc + curr.totalQuantity, 0);

  const formattedDate = new Date().toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* 1. Screen Header Controls Floating Glass Card with Custom Logo (NO-PRINT) */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4 no-print">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
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
                <h2 className="text-base sm:text-lg font-black text-neutral-900">
                  {activeTab === 'normal' ? t('report.title') : t('report.rupture_title')}
                </h2>
                <span className="bg-orange-50 text-orange-600 border border-orange-200/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  طباعة رسمية
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                {activeTab === 'normal' 
                  ? 'قائمة السلع والكتب المعلقة للشراء من الموردين ودور النشر'
                  : 'قائمة السلع الموسومة كغير متوفرة حالياً بالأسواق'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 bg-white/90 border border-neutral-200/80 px-4 h-11 rounded-full shadow-xs">
              <span className="text-neutral-400">العناوين:</span>
              <strong className="text-neutral-900">{totalItemTypes}</strong>
              <span className="text-neutral-300">|</span>
              <span className="text-neutral-400">مجموع القطع:</span>
              <strong className="text-orange-600">{totalPiecesCount}</strong>
            </div>

            <button
              onClick={handlePrint}
              disabled={report.length === 0}
              className="bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold h-11 px-6 rounded-full shadow-md flex items-center gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-orange-500" />
              <span>{t('report.print_btn')}</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Normal vs Rupture */}
        <div className="flex items-center gap-2 bg-neutral-100/80 p-1.5 rounded-full border border-neutral-200/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('normal')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all duration-300 ${
              activeTab === 'normal'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-orange-500" />
            <span>المشتريات العادية</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'normal' ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {demands ? normalReport.length : (activeTab === 'normal' ? report.length : '-')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rupture')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all duration-300 ${
              activeTab === 'rupture'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>السلع غير المتوفرة</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'rupture' ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {demands ? ruptureReport.length : (activeTab === 'rupture' ? report.length : '-')}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Screen UI Web View Floating Glass Card (NO-PRINT) */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 no-print">
        {isLoading ? (
          <div className="text-center py-12 text-neutral-400 font-bold text-xs">جاري تحميل التقرير...</div>
        ) : report.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-base font-extrabold text-neutral-900">
              {activeTab === 'normal' ? 'جميع الكتب متوفرة في المخزون' : 'لا توجد سلع مسجلة كغير متوفرة حالياً'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {activeTab === 'normal' 
                ? 'لا توجد خصاصات معلقة للموردين في الوقت الحالي'
                : 'جميع السلع المطلوبة متوفرة أو مسجلة في قائمة المشتريات العادية'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {report.map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-xl bg-neutral-100 text-neutral-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-neutral-200/60">
                    #{idx + 1}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sm text-neutral-900 truncate">{item.productName}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.clients.map((cli, cIdx) => (
                        <span key={cIdx} className="bg-neutral-100 text-neutral-700 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
                          {cli.clientName} ({cli.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="self-end md:self-center">
                  <span className="bg-neutral-900 text-white font-black text-xs px-4 py-1.5 rounded-full shadow-xs">
                    {item.totalQuantity} قطعة
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. DEDICATED PRINTABLE A4 PORTAL DIRECTLY AT DOCUMENT BODY */}
      {mounted && createPortal(
        <div id="printable-a4-report" className="print-only">
          <div className="printable-supplier font-cairo bg-white text-black">
            
            {/* A4 Printable Header */}
            <div className="border-b-2 border-neutral-900 pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-neutral-900 p-2 rounded-xl inline-block shrink-0">
                  <img
                    src="/logo-lib-modern-alt.jpg"
                    alt="Lib Moderne - المكتبة العصرية"
                    className="h-14 w-auto object-contain block"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-black">
                    المكتبة العصرية — Lib Moderne
                  </h1>
                  <p className="text-xs font-bold text-neutral-700 mt-0.5">
                    {activeTab === 'normal'
                      ? 'متابعة خصاصات الدخول المدرسي — قائمة المشتريات المعلقة للموردين'
                      : 'متابعة خصاصات الدخول المدرسي — قائمة السلع المقطوعة (En Rupture)'}
                  </p>
                  <p className="text-xs font-mono text-neutral-800 mt-1 text-right">
                    الهاتف: <span dir="ltr" className="font-bold">06.60.56.33.71 / 06.60.31.98.68</span>
                  </p>
                </div>
              </div>
              <div className="text-left text-xs text-neutral-700 font-medium">
                <p><span className="font-bold">الدفعة:</span> {activeBatch?.batch_name || 'الدفعة الرئيسية'}</p>
                <p><span className="font-bold">تاريخ الطباعة:</span> {formattedDate}</p>
              </div>
            </div>

            {/* A4 Table */}
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-neutral-900 font-black border-y-2 border-neutral-900">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">
                    {activeTab === 'normal' ? 'السلعة / الكتاب المطلوب' : 'السلعة / الكتاب غير المتوفر'}
                  </th>
                  <th className="py-2.5 px-3 text-center w-28">العدد المطلوب</th>
                  <th className="py-2.5 px-3">تفاصيل طلبات الزبناء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                {report.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3 text-center font-bold">{idx + 1}</td>
                    <td className="py-3 px-3 font-extrabold text-sm">{item.productName}</td>
                    <td className="py-3 px-3 text-center font-black text-base">{item.totalQuantity}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {item.clients.map((cli, cIdx) => (
                          <span key={cIdx} className="bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded text-[10px]">
                            {cli.clientName} ({cli.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-900 font-black bg-neutral-50">
                  <td colSpan={2} className="py-3 px-3 text-left">
                    {activeTab === 'normal' 
                      ? 'المجموع الإجمالي للقطع المطلوب شراؤها:' 
                      : 'المجموع الإجمالي للقطع غير المتوفرة:'}
                  </td>
                  <td className="py-3 px-3 text-center text-lg font-black text-neutral-900">{totalPiecesCount}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures / Stamp Footer */}
            <div className="mt-12 pt-6 border-t border-neutral-300 flex justify-between items-end text-xs font-bold text-neutral-800">
              <div>
                <p>توقيع مسؤول المشتريات:</p>
                <div className="h-10"></div>
              </div>
              <div>
                <p>خاتم وتوقيع المكتبة العصرية (Lib Moderne):</p>
                <div className="h-10"></div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
