'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { ClientDemand } from '@/lib/types';
import { compareProductNames } from '@/lib/sortUtils';

interface ThermalReceiptProps {
  demand: ClientDemand;
  onClose: () => void;
}

function ThermalReceipt({ demand, onClose }: ThermalReceiptProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  const formattedDate = React.useMemo(() => {
    return new Date().toLocaleDateString('ar-MA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const getStatusText = React.useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل التسليم';
      case 'partial': return 'تسليم جزئي';
      default: return 'قيد الانتظار';
    }
  }, []);

  const sortedItems = React.useMemo(() => {
    return [...(demand.items || [])].sort((a, b) =>
      compareProductNames(a.product_name, b.product_name)
    );
  }, [demand.items]);

  const renderSingleReceiptCopy = () => (
    <div className="receipt-single-copy bg-white text-black font-cairo dir-rtl p-1">
      {/* Top Center Logo */}
      <div className="text-center mb-2">
        <img
          src="/logo-lib-modern.jpg"
          alt="Lib Moderne - المكتبة العصرية"
          className="h-10 w-auto object-contain mx-auto block mb-1"
        />
        <p className="text-base font-black text-center mt-1 text-black leading-tight">
          المكتبة العصرية — Lib Moderne
        </p>
        <p dir="ltr" className="text-[10px] font-extrabold font-mono mt-0.5 text-black">
          06.60.56.33.71 / 06.60.31.98.68
        </p>

        <div className="receipt-divider border-t border-dashed border-black my-1.5"></div>

        <div className="inline-block border border-black px-2.5 py-0.5 text-[10px] font-black bg-neutral-100 text-black">
          وصل حجز وتوصية خصاص مدرسي
        </div>
      </div>

      {/* Metadata Box */}
      <div className="border border-dashed border-black p-2 rounded text-[10px] space-y-1 mb-2 text-black bg-white">
        <div className="flex justify-between items-center">
          <span className="font-extrabold">الزبون:</span>
          <span className="font-bold">{demand.client?.name || 'غير مسمى'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-extrabold">الهاتف:</span>
          <span className="font-mono dir-ltr font-bold">{demand.client?.phone}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-extrabold">تاريخ الطلب:</span>
          <span className="font-medium">{new Date(demand.created_at || Date.now()).toLocaleDateString('ar-MA')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-extrabold">حالة الطلب:</span>
          <span className="font-black">{getStatusText(demand.status)}</span>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-right text-[9.5px] border-collapse mb-1 text-black">
        <thead>
          <tr className="border-b-2 border-black font-black">
            <th className="py-1 px-0.5 text-center w-5">#</th>
            <th className="py-1 px-1">الكتاب / السلعة</th>
            <th className="py-1 px-0.5 text-center w-8">الكمية</th>
            <th className="py-1 px-0.5 text-center w-12">التسليم</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, idx) => (
            <tr key={item.id || idx} className="border-b border-neutral-300">
              <td className="py-1 px-0.5 text-center font-bold">{idx + 1}</td>
              <td className="py-1 px-1 font-semibold leading-tight">{item.product_name}</td>
              <td className="py-1 px-0.5 text-center font-black">{item.quantity}</td>
              <td className="py-1 px-0.5 text-center">
                {item.is_delivered ? (
                  <span className="font-extrabold text-black">مسلَم</span>
                ) : item.is_in_stock ? (
                  <span className="font-bold text-black">بالمتجر</span>
                ) : (
                  <span className="font-normal text-neutral-700">معلق</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financials & Totals Box */}
      <div className="border-t-2 border-b-2 border-black py-1.5 px-1 my-1.5 text-[9.5px] space-y-1 text-black bg-neutral-50 font-bold">
        <div className="flex justify-between items-center">
          <span>المبلغ الإجمالي (Total):</span>
          <span className="font-black font-mono">
            {(demand.total_amount || 0) > 0 ? `${demand.total_amount} DH` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>التسبيق المؤدى (Avance):</span>
          <span className="font-black font-mono">
            {(demand.avance_amount || 0) > 0 ? `${demand.avance_amount} DH` : '0 DH'}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-dashed border-black pt-1">
          <span className="font-extrabold">المبلغ المتبقي (Le Reste):</span>
          <span className="font-black font-mono text-[10.5px]">
            {(demand.total_amount || 0) > 0 
              ? `${Math.max(0, (demand.total_amount || 0) - (demand.avance_amount || 0))} DH`
              : '—'}
          </span>
        </div>
      </div>

      {/* Signatures Side-by-Side */}
      <div className="pt-1.5 border-t border-dashed border-black text-[9.5px] flex justify-between items-end mt-1.5 text-black">
        <div className="text-right">
          <p className="font-extrabold">توقيع الزبون:</p>
          <div className="h-6 w-20 border-b border-neutral-400 mt-1"></div>
        </div>
        <div className="text-left">
          <p className="font-extrabold">توقيع البائع:</p>
          <div className="h-6 w-20 border-b border-neutral-400 mt-1"></div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-neutral-300 text-[8.5px] text-neutral-800 mt-1.5">
        <p>طبع بتاريخ {formattedDate}</p>
        <p className="font-bold mt-0.5">شكراً لزيارتكم المكتبة العصرية — Lib Moderne</p>
      </div>
    </div>
  );

  const printableContent = (
    <div id="printable-thermal-receipt" className="print-only">
      {renderSingleReceiptCopy()}
    </div>
  );

  return (
    <>
      {/* SCREEN MODAL VIEW (NO-PRINT) */}
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-backdrop no-print">
        <div className="bg-white/95 backdrop-blur-md text-neutral-900 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 border border-neutral-200/80">

          {/* Modal Header Controls */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-100 gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 text-neutral-900 font-extrabold text-xs sm:text-base min-w-0">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-orange-700 shrink-0" />
              <span className="truncate">طباعة وصل خصاص (80mm Thermal)</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-neutral-900 hover:bg-black text-white font-bold text-xs px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-full flex items-center gap-1.5 sm:gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700" />
                <span>طباعة الوصل</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Preview */}
          <div className="overflow-y-auto p-4 flex-1 my-2 bg-neutral-50/80 border border-neutral-200/80 rounded-2xl flex flex-col items-center">
            <div className="receipt-preview-container bg-white p-3 rounded-xl shadow-md max-w-[72mm] w-full text-black border border-neutral-200">
              {renderSingleReceiptCopy()}
            </div>
          </div>

          <div className="pt-2 text-xs text-neutral-400 font-medium text-center">
            المقاس المجهز: 80mm Roll • وصل المكتبة العصرية (Lib Moderne)
          </div>
        </div>
      </div>

      {/* DEDICATED PRINTABLE PORTAL DIRECTLY AT DOCUMENT BODY */}
      {mounted && createPortal(printableContent, document.body)}
    </>
  );
}

export default React.memo(ThermalReceipt);
