'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileText, ShoppingCart, Users, CheckCircle2 } from 'lucide-react';
import { SupplierAggregatedItem, PurchaseBatch, ClientDemand } from '@/lib/types';
import { getSupplierAggregatedReport } from '@/lib/dataStore';

interface SupplierBuyingSheetProps {
  activeBatch: PurchaseBatch | null;
  demands?: ClientDemand[];
  onArchiveBatch?: (newBatchName: string) => void;
}

export default function SupplierBuyingSheet({
  activeBatch,
  demands,
}: SupplierBuyingSheetProps) {
  const [fetchedReport, setFetchedReport] = useState<SupplierAggregatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const data = await getSupplierAggregatedReport(activeBatch?.id);
      setFetchedReport(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!demands) {
      fetchReport();
    } else {
      setIsLoading(false);
    }
  }, [activeBatch, demands]);

  const computedReport = useMemo(() => {
    if (!demands) return null;
    const itemMap: Record<string, SupplierAggregatedItem> = {};

    for (const dem of demands) {
      if (!dem.items || !dem.client) continue;

      for (const item of dem.items) {
        if (item.is_delivered || item.is_in_stock) continue;

        const pName = item.product_name.trim();
        if (!itemMap[pName]) {
          itemMap[pName] = {
            productName: pName,
            totalQuantity: 0,
            clients: [],
          };
        }

        itemMap[pName].totalQuantity += item.quantity;
        itemMap[pName].clients.push({
          clientName: dem.client.name,
          phone: dem.client.phone,
          quantity: item.quantity,
          demandId: dem.id,
        });
      }
    }

    return Object.values(itemMap).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [demands]);

  const report = computedReport !== null ? computedReport : fetchedReport;

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
    <div className="space-y-4">
      
      {/* 1. Screen Header Controls (NO-PRINT) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold shrink-0">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">تقرير مشتريات الموردين</h2>
        </div>

        {/* Page-level action buttons: ONLY A4 Print button */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 h-9 rounded-lg">
            <span className="text-slate-500">العناوين:</span>
            <strong className="text-slate-900">{totalItemTypes}</strong>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">مجموع القطع:</span>
            <strong className="text-slate-900">{totalPiecesCount}</strong>
          </div>

          <button
            onClick={handlePrint}
            disabled={report.length === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold h-9 px-3.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>طباعة A4</span>
          </button>
        </div>
      </div>

      {/* 3. Screen UI Web View (NO-PRINT) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs no-print">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 font-medium text-xs">جاري تحميل تقرير المشتريات...</div>
        ) : report.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-emerald-200 bg-emerald-50/50 rounded-lg space-y-1.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-emerald-800 font-bold text-sm">جميع الكتب متوفرة في المخزون</p>
            <p className="text-xs text-emerald-600">لا توجد خصاصات معلقة للموردين في الوقت الحالي</p>
          </div>
        ) : (
          <>
            {/* Mobile Stacked Card View (< md) */}
            <div className="block md:hidden space-y-2">
              {report.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="bg-slate-800 text-white font-bold text-xs w-5 h-5 rounded flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-xs truncate">{item.productName}</h3>
                    </div>
                    <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold text-xs shrink-0">
                      {item.totalQuantity} قطعة
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block mb-1">طلبيات الزبناء:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.clients.map((cli, cIdx) => (
                        <span key={cIdx} className="bg-white border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                          {cli.clientName} ({cli.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3">اسم السلعة / الكتاب</th>
                    <th className="py-2 px-3 text-center w-28">إجمالي العدد</th>
                    <th className="py-2 px-3">تفاصيل الزبناء المنتظرين</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 text-xs sm:text-sm">{item.productName}</td>
                      <td className="py-2 px-3 text-center font-bold text-sm text-slate-900 bg-slate-50/50">
                        {item.totalQuantity}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        <div className="flex flex-wrap gap-1">
                          {item.clients.map((cli, cIdx) => (
                            <span key={cIdx} className="bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                              {cli.clientName} ({cli.quantity})
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* DEDICATED PRINTABLE PORTAL DIRECTLY AT DOCUMENT BODY */}
      {mounted && createPortal(
        <div id="printable-a4-report" className="print-only">
          <div className="printable-supplier font-cairo bg-white text-black">
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-izourane.jpg"
                  alt="شعار شركة إيزوران"
                  className="h-16 w-auto object-contain shrink-0"
                />
                <div>
                  <h1 className="text-2xl font-black text-black">شركة إيزوران</h1>
                  <p className="text-xs font-semibold text-slate-700">متابعة خصاصات الدخول المدرسي — قائمة المشتريات المعلقة</p>
                  <p className="text-xs font-mono text-slate-800 mt-0.5 text-right">الهاتف: <span dir="ltr">+212 661-556418</span></p>
                </div>
              </div>
              <div className="text-left text-xs text-slate-700 font-medium">
                <p><span className="font-bold">الدفعة:</span> {activeBatch?.batch_name}</p>
                <p><span className="font-bold">التاريخ:</span> {formattedDate}</p>
              </div>
            </div>

            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black border-y-2 border-slate-900">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">السلعة / الكتاب المطلوب</th>
                  <th className="py-2.5 px-3 text-center w-28">العدد المطلوب</th>
                  <th className="py-2.5 px-3">تفاصيل طلبات الزبناء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {report.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3 text-center font-bold">{idx + 1}</td>
                    <td className="py-3 px-3 font-extrabold text-sm">{item.productName}</td>
                    <td className="py-3 px-3 text-center font-black text-base">{item.totalQuantity}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {item.clients.map((cli, cIdx) => (
                          <span key={cIdx} className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            {cli.clientName} ({cli.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 font-black bg-slate-50">
                  <td colSpan={2} className="py-3 px-3 text-left">المجموع الإجمالي للقطع المطلوب شراؤها:</td>
                  <td className="py-3 px-3 text-center text-lg font-black text-slate-900">{totalPiecesCount}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between items-end text-xs font-bold text-slate-800">
              <div>
                <p>توقيع مسؤول المشتريات:</p>
                <div className="h-10"></div>
              </div>
              <div>
                <p>خاتم شركة إيزوران:</p>
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
