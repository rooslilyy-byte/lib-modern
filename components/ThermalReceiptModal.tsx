'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { ClientDemand } from '@/lib/types';
import { compareProductNames } from '@/lib/sortUtils';

interface ThermalReceiptModalProps {
  demand: ClientDemand;
  onClose: () => void;
}

export default function ThermalReceiptModal({ demand, onClose }: ThermalReceiptModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date().toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل التسليم';
      case 'partial': return 'تسليم جزئي';
      default: return 'قيد الانتظار';
    }
  };

  const sortedItems = [...(demand.items || [])].sort((a, b) =>
    compareProductNames(a.product_name, b.product_name)
  );

  const renderSingleReceiptCopy = () => (
    <div className="receipt-single-copy bg-white text-black font-cairo dir-rtl p-1">
      {/* Top Center Logo (wide rectangular, 80mm-friendly) */}
      <div className="text-center mb-2">
        <img
          src="/logo-izourane.jpg"
          alt="شعار شركة إيزوران"
          className="h-12 w-auto object-contain grayscale mx-auto block"
        />
        <p className="text-lg font-bold text-center mt-2 text-black leading-tight">
          شركة إيزوران مكتب
        </p>
        <p dir="ltr" className="text-[10px] font-extrabold font-mono mt-0.5 text-black">+212 661-556418</p>

        <div className="receipt-divider border-t border-dashed border-black my-1.5"></div>

        <div className="inline-block border border-black px-2.5 py-0.5 text-[10px] font-black bg-slate-100 text-black">
          وصل خصاص
        </div>
      </div>

      {/* Metadata Box */}
      <div className="border border-dashed border-black p-2 rounded text-[10px] space-y-1 mb-2.5 text-black bg-white">
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
      <table className="w-full text-right text-[9.5px] border-collapse mb-2 text-black">
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
            <tr key={item.id || idx} className="border-b border-slate-300">
              <td className="py-1 px-0.5 text-center font-bold">{idx + 1}</td>
              <td className="py-1 px-1 font-semibold leading-tight">{item.product_name}</td>
              <td className="py-1 px-0.5 text-center font-black">{item.quantity}</td>
              <td className="py-1 px-0.5 text-center">
                {item.is_delivered ? (
                  <span className="font-extrabold text-black">مسلَم</span>
                ) : item.is_in_stock ? (
                  <span className="font-bold text-black">بالمتجر</span>
                ) : (
                  <span className="font-normal text-slate-700">معلق</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Signatures Side-by-Side */}
      <div className="pt-2 border-t border-dashed border-black text-[9.5px] flex justify-between items-end mt-2 text-black">
        <div className="text-right">
          <p className="font-extrabold">توقيع الزبون:</p>
          <div className="h-6 w-20 border-b border-slate-400 mt-1"></div>
        </div>
        <div className="text-left">
          <p className="font-extrabold">توقيع البائع:</p>
          <div className="h-6 w-20 border-b border-slate-400 mt-1"></div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-slate-300 text-[8.5px] text-slate-800 mt-2">
        <p>طبع بتاريخ {formattedDate}</p>
        <p className="font-semibold mt-0.5">شكراً لزيارتكم شركة إيزوران</p>
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
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-backdrop no-print">
        <div className="bg-white text-slate-900 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">

          {/* Modal Header Controls */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base min-w-0">
              <Printer className="w-5 h-5 text-slate-500 shrink-0" />
              <span className="truncate">طباعة وصل خصاص (80mm Thermal)</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrint}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>طباعة الوصل</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 text-xs font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Preview */}
          <div className="overflow-y-auto p-4 flex-1 my-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
            <div className="receipt-preview-container bg-white p-3 rounded-lg shadow max-w-[72mm] w-full text-black">
              {renderSingleReceiptCopy()}
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 text-center">
            المقاس المجهز: 80mm Roll • وصل واحد جاهز للطباعة
          </div>
        </div>
      </div>

      {/* DEDICATED PRINTABLE PORTAL DIRECTLY AT DOCUMENT BODY */}
      {mounted && createPortal(printableContent, document.body)}
    </>
  );
}
