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
  Square,
  Wallet,
  Receipt,
  Coins
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';
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
    }[],
    avanceAmount?: number,
    totalAmount?: number
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
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Match target demand strictly by demand id or client id
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

    const message = `السلام عليكم ورحمة الله وبركاته السيد(ة) ${targetDemand.client.name}،\n\nنخبركم من المكتبة العصرية (Lib Moderne) أن الكتب والخصاصات التالية قد وصلت وتنتظر استلامكم:\n\n${readyText || 'جميع خصاصاتكم المسجلة جاهزة'}\n\nالمكان: المكتبة العصرية - Lib Moderne\nالهاتف: 06.60.56.33.71 / 06.60.31.98.68`;

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
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-neutral-900 text-base">لم يتم العثور على طلبية هذا الزبون</h3>
          <p className="text-xs text-neutral-500 mt-1">قد تكون الطلبية حذفت أو غير متوفرة في الدفعة الحالية.</p>
        </div>
        <div className="pt-2">
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white font-bold text-xs px-5 h-10 rounded-full shadow-md transition-all duration-300 hover:-translate-y-0.5"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى دليل الزبائن</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-neutral-900 bg-white/80 backdrop-blur-sm hover:bg-white border border-neutral-200/80 px-4 h-9 rounded-full transition-all duration-300 shadow-xs hover:-translate-y-0.5"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى دليل الزبناء</span>
        </Link>

        <span className="text-xs font-mono font-bold text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
          #ID: {targetDemand.id.substring(0, 8)}
        </span>
      </div>

      {/* 1. Header Banner & Action Toolbar with Custom White Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
        
        {/* Customer Main Metadata */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              <img
                src="/logo-lib-modern-alt.jpg"
                alt="Lib Moderne"
                className="h-full w-auto object-contain"
              />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-neutral-900 leading-tight truncate">
                  {targetDemand.client?.name}
                </h1>

                {/* Overall Demand Status Pill Badge */}
                <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  stats.isComplete
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stats.isReady
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : stats.isPartial
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
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

              <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                <a 
                  href={`tel:${targetDemand.client?.phone}`}
                  className="inline-flex items-center gap-1.5 text-neutral-800 hover:text-orange-600 font-mono font-bold bg-neutral-100 px-2.5 py-0.5 rounded-full dir-ltr transition-colors"
                >
                  <Phone className="w-3 h-3 text-orange-500" />
                  <span>{targetDemand.client?.phone}</span>
                </a>

                <span className="flex items-center gap-1.5 text-neutral-400 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span>تاريخ التسجيل: {new Date(targetDemand.created_at || Date.now()).toLocaleDateString('ar-MA')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Pill-shaped Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Edit Demand */}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="h-10 px-5 text-xs sm:text-sm font-bold rounded-full bg-neutral-900 hover:bg-black text-white flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <Edit className="w-4 h-4 text-orange-500" />
            <span>{t('common.edit')}</span>
          </button>

          {/* Thermal Print Receipt */}
          <button
            type="button"
            onClick={() => setIsPrinting(true)}
            className="h-10 px-5 text-xs sm:text-sm font-bold rounded-full bg-neutral-900 hover:bg-black text-white flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>{t('common.print')}</span>
          </button>

          {/* WhatsApp Notification */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-5 text-xs sm:text-sm font-bold rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <MessageSquare className="w-4 h-4 text-white" />
            <span>{t('common.whatsapp')}</span>
          </a>

          {/* Delete Demand */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-10 px-5 text-xs sm:text-sm font-bold rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center gap-2 transition-all duration-300 border border-rose-200 hover:-translate-y-0.5"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>{t('common.delete')}</span>
          </button>
        </div>

      </div>

      {/* 2. Financial Overview (Avance, Total, Le Reste) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Total Price */}
        <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shrink-0">
            <Receipt className="w-5 h-5 text-neutral-800" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 font-bold">المبلغ الإجمالي (Total):</p>
            <p className="text-base sm:text-lg font-black text-neutral-900 font-mono mt-0.5">
              {(targetDemand.total_amount || 0) > 0 ? `${targetDemand.total_amount} د.م.` : 'غير محدد'}
            </p>
          </div>
        </div>

        {/* Avance Paid */}
        <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
            <Coins className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 font-bold">التسبيق المؤدى (Avance):</p>
            <p className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5">
              {(targetDemand.avance_amount || 0) > 0 ? `${targetDemand.avance_amount} د.م.` : '0 د.م.'}
            </p>
          </div>
        </div>

        {/* Remaining Balance */}
        <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
            Math.max(0, (targetDemand.total_amount || 0) - (targetDemand.avance_amount || 0)) > 0
              ? 'bg-orange-50 border-orange-200/80 text-orange-600'
              : 'bg-neutral-100 border-neutral-200 text-neutral-500'
          }`}>
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500 font-bold">المبلغ المتبقي (Le Reste):</p>
            <p className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
              Math.max(0, (targetDemand.total_amount || 0) - (targetDemand.avance_amount || 0)) > 0
                ? 'text-orange-600'
                : 'text-neutral-900'
            }`}>
              {(targetDemand.total_amount || 0) > 0
                ? `${Math.max(0, (targetDemand.total_amount || 0) - (targetDemand.avance_amount || 0))} د.م.`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Items Details Floating Glass Card */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 space-y-4">
        
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-wrap gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-800" />
            <span>قائمة الكتب والمستلزمات المطلوبة ({targetDemand.items?.length || 0})</span>
          </h3>
          <span className="text-xs text-neutral-500 font-semibold">
            انقر على الخيارات لتحديث حالة التوفر والتسليم
          </span>
        </div>

        {/* Dense Items Table */}
        <div className="divide-y divide-neutral-100 overflow-hidden">
          {targetDemand.items?.map((item, idx) => {
            const isStockOnly = item.is_in_stock && !item.is_delivered;
            const isDelivered = item.is_delivered;

            return (
              <div 
                key={item.id} 
                className={`py-3.5 px-3 sm:px-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                  isDelivered
                    ? 'bg-neutral-50/50 text-neutral-400'
                    : isStockOnly
                    ? 'bg-blue-50/40 text-neutral-900'
                    : 'hover:bg-white text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className={`text-xs sm:text-sm font-extrabold leading-snug ${isDelivered ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                      {item.product_name}
                    </h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      الكمية: <strong className="text-neutral-800">{item.quantity}</strong> قطعة
                    </p>
                  </div>
                </div>

                {/* State Toggles (In Stock & Delivered) */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onUpdateItemState(item.id, { is_in_stock: !item.is_in_stock })}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
                      item.is_in_stock
                        ? 'bg-blue-500 text-white border-blue-500 shadow-xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {item.is_in_stock ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    <span>متوفر بالمتجر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateItemState(item.id, { is_delivered: !item.is_delivered, is_in_stock: true })}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
                      item.is_delivered
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {item.is_delivered ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    <span>تم التسليم للزبون</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Edit Modal */}
      {isEditing && (
        <EditDemandModal
          demand={targetDemand}
          masterProducts={masterProducts}
          onClose={() => setIsEditing(false)}
          onSave={onUpdateDemand}
        />
      )}

      {/* Print Thermal Modal */}
      {isPrinting && (
        <ThermalReceiptModal
          demand={targetDemand}
          onClose={() => setIsPrinting(false)}
        />
      )}

    </div>
  );
}
