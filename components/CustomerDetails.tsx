'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Phone, 
  Calendar, 
  ArrowRight, 
  Edit, 
  Printer, 
  MessageSquare, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen,
  CheckSquare, 
  Square
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import ThermalReceiptModal from './ThermalReceiptModal';
import EditDemandModal from './EditDemandModal';

interface CustomerDetailsProps {
  id: string;
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onUpdateDemand: (
    demandId: string,
    clientName: string,
    clientPhone: string,
    items: {
      id?: string;
      product_name: string;
      quantity: number;
      is_in_stock?: boolean;
      is_delivered?: boolean;
    }[]
  ) => Promise<void>;
  onUpdateItemState: (
    itemId: string, 
    updates: { is_in_stock?: boolean; is_delivered?: boolean }
  ) => Promise<void>;
  onDeleteDemand: (demandId: string) => Promise<void>;
}

export default function CustomerDetails({
  id,
  demands,
  masterProducts,
  onUpdateDemand,
  onUpdateItemState,
  onDeleteDemand,
}: CustomerDetailsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Match target demand strictly by demand id or client id (NEVER by phone number)
  const targetDemand = useMemo(() => {
    const cleanId = decodeURIComponent(id).trim();
    return demands.find(d => 
      d.id === cleanId || 
      d.client?.id === cleanId
    ) || null;
  }, [demands, id]);

  const stats = useMemo(() => {
    if (!targetDemand || !targetDemand.items) {
      return { total: 0, inStock: 0, delivered: 0, missing: 0, isComplete: false, isReady: false, isPartial: false };
    }
    const total = targetDemand.items.length;
    const inStock = targetDemand.items.filter(i => i.is_in_stock && !i.is_delivered).length;
    const delivered = targetDemand.items.filter(i => i.is_delivered).length;
    const missing = targetDemand.items.filter(i => !i.is_in_stock && !i.is_delivered).length;
    const isComplete = total > 0 && delivered === total;
    const isReady = !isComplete && total > 0 && (inStock + delivered) === total;
    const isPartial = !isComplete && !isReady && (inStock + delivered) > 0;

    return { total, inStock, delivered, missing, isComplete, isReady, isPartial };
  }, [targetDemand]);

  const whatsAppUrl = useMemo(() => {
    if (!targetDemand?.client?.phone) return '#';
    let rawPhone = targetDemand.client.phone.replace(/\D/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '212' + rawPhone.slice(1);

    const readyItems = targetDemand.items?.filter(i => i.is_in_stock && !i.is_delivered) || [];
    const readyText = readyItems.map(i => `- ${i.product_name} (${i.quantity})`).join('\n');

    const message = `السلام عليكم ورحمة الله وبركاته السيد(ة) ${targetDemand.client.name}،\n\nنخبركم من شركة إيزوران أن الكتب والخصاصات التالية قد وصلت وتنتظر استلامكم:\n\n${readyText || 'جميع خصاصاتكم المسجلة جاهزة'}\n\nالعنوان: شركة إيزوران\nالهاتف: +212 661-556418`;

    return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
  }, [targetDemand]);

  const handleDelete = async () => {
    if (!targetDemand) return;
    if (confirm('هل أنت متأكد من رغبتك في حذف ملف طلبية هذا الزبون نهائياً؟')) {
      await onDeleteDemand(targetDemand.id);
      router.push('/customers');
    }
  };

  if (!targetDemand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 shadow-2xs">
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">لم يتم العثور على طلبية هذا الزبون</h3>
          <p className="text-xs text-slate-500 mt-0.5">قد تكون الطلبية حذفت أو غير متوفرة في الدفعة الحالية.</p>
        </div>
        <div className="pt-1">
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 h-8 rounded-lg shadow-2xs transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة إلى دليل الزبائن</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 h-7 rounded-lg transition-colors shadow-2xs"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة إلى دليل الزبناء</span>
        </Link>

        <span className="text-[11px] font-mono font-bold text-slate-400">
          #ID: {targetDemand.id.substring(0, 8)}
        </span>
      </div>

      {/* 1. Compact Header Banner & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-3">
        
        {/* Customer Main Metadata & Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {targetDemand.client?.name.substring(0, 2)}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  {targetDemand.client?.name}
                </h1>

                {/* Overall Demand Status Badge */}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 ${
                  stats.isComplete
                    ? 'bg-emerald-50 text-emerald-700'
                    : stats.isReady
                    ? 'bg-blue-50 text-blue-700'
                    : stats.isPartial
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  {stats.isComplete 
                    ? 'مكتمل (تم التسليم)' 
                    : stats.isReady 
                    ? 'جاهز للتسليم' 
                    : stats.isPartial 
                    ? 'تسليم جزئي' 
                    : 'خصاص معلق'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
                <a 
                  href={`tel:${targetDemand.client?.phone}`}
                  className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded dir-ltr"
                >
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{targetDemand.client?.phone}</span>
                </a>

                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>تاريخ التسجيل: {new Date(targetDemand.created_at || Date.now()).toLocaleDateString('ar-MA')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Compact Standard Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Edit Demand */}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>تعديل الطلب</span>
          </button>

          {/* Thermal Print Receipt */}
          <button
            type="button"
            onClick={() => setIsPrinting(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الوصل</span>
          </button>

          {/* WhatsApp Notification */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>إشعار الواتساب</span>
          </a>

          {/* Delete Demand */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center gap-1.5 transition-colors border border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>حذف الطلب</span>
          </button>
        </div>

      </div>

      {/* 3. Missing vs. Ready Products Dense List */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <span>الكتب والمستلزمات المطلوبة ({stats.total} عناوين):</span>
          </h3>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">
              {stats.inStock + stats.delivered} متوفر / مسلَم
            </span>
            <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded">
              {stats.missing} خصاص معلق
            </span>
          </div>
        </div>

        {/* Product Items List - Minimalist Compact Rows */}
        <div className="space-y-1.5">
          {targetDemand.items?.map((item, idx) => {
            const isInStock = item.is_in_stock;
            const isDelivered = item.is_delivered;

            return (
              <div
                key={item.id || idx}
                className="bg-slate-50/70 border border-slate-200 rounded-lg py-2 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition-colors hover:bg-slate-100/70"
              >
                
                {/* Item Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                    {item.quantity}
                  </span>

                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                      {item.product_name}
                    </h4>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      الكمية: <span className="font-semibold text-slate-800">{item.quantity} قطعة</span>
                    </p>
                  </div>
                </div>

                {/* Stock Status Badge & Interactive Compact Toggles */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  
                  {/* Subtle Badge */}
                  {isInStock ? (
                    <span className="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>متوفر / جاهز</span>
                    </span>
                  ) : (
                    <span className="bg-rose-50 text-rose-700 text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>خصاص معلق</span>
                    </span>
                  )}

                  {/* Quick Action Toggle Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateItemState(item.id, { is_in_stock: !item.is_in_stock })}
                      className={`h-8 px-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 border ${
                        item.is_in_stock 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {item.is_in_stock ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{item.is_in_stock ? 'بالمحل' : 'توفير'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateItemState(item.id, { is_delivered: !item.is_delivered })}
                      className={`h-8 px-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 border ${
                        item.is_delivered 
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {item.is_delivered ? <CheckSquare className="w-3.5 h-3.5 text-emerald-700" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{item.is_delivered ? 'تم التسليم' : 'تسليم'}</span>
                    </button>
                  </div>

                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Thermal Receipt Modal */}
      {isPrinting && (
        <ThermalReceiptModal
          demand={targetDemand}
          onClose={() => setIsPrinting(false)}
        />
      )}

      {/* Edit Demand Modal */}
      {isEditing && (
        <EditDemandModal
          demand={targetDemand}
          masterProducts={masterProducts}
          onClose={() => setIsEditing(false)}
          onSave={onUpdateDemand}
        />
      )}

    </div>
  );
}
