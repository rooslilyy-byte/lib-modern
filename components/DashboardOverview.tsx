'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  ArrowLeft,
  UserPlus,
  FileSpreadsheet,
  PackageCheck
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';

interface DashboardOverviewProps {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onNavigateTab?: (tab: string) => void;
}

export default function DashboardOverview({
  demands,
}: DashboardOverviewProps) {
  const stats = useMemo(() => {
    const totalDemands = demands.length;
    const pendingDemands = demands.filter(d => d.status === 'pending').length;
    const partialDemands = demands.filter(d => d.status === 'partial').length;
    const completedDemands = demands.filter(d => d.status === 'completed').length;

    let totalItemsCount = 0;
    let deliveredItemsCount = 0;

    for (const d of demands) {
      if (d.items) {
        for (const item of d.items) {
          totalItemsCount += item.quantity;
          if (item.is_delivered) deliveredItemsCount += item.quantity;
        }
      }
    }

    return {
      totalDemands,
      pendingDemands,
      partialDemands,
      completedDemands,
      totalItemsCount,
      deliveredItemsCount,
    };
  }, [demands]);

  return (
    <div className="space-y-4">
      
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">لوحة تحكّم المكتبة</h2>
          <span className="bg-slate-100 text-slate-500 text-[11px] font-medium px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
            موسم الدخول المدرسي
          </span>
        </div>

        <Link
          href="/customers"
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold h-9 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 text-white shrink-0" />
          <span>إضافة طلب جديد</span>
        </Link>
      </div>

      {/* 2. Professional ERP KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Total Demands Card */}
        <Link 
          href="/customers"
          className="bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-3.5 shadow-sm block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">إجمالي الطلبات</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalDemands}</span>
            <span className="text-xs text-slate-500 font-medium">طلب</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>مجموع القطع المطلوبة:</span>
            <span className="font-bold text-slate-800">{stats.totalItemsCount} قطعة</span>
          </div>
        </Link>

        {/* Pending Card */}
        <Link 
          href="/customers"
          className="bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-3.5 shadow-sm block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">قيد الانتظار</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.pendingDemands}</span>
            <span className="text-xs text-slate-500 font-medium">طلب معلق</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تنتظر الشراء للمحل</span>
          </div>
        </Link>

        {/* Partial Card */}
        <Link 
          href="/customers"
          className="bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-3.5 shadow-sm block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">تسليم جزئي</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.partialDemands}</span>
            <span className="text-xs text-slate-500 font-medium">مستلم جزئياً</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>بعض العناصر متوفرة</span>
          </div>
        </Link>

        {/* Completed Card */}
        <Link 
          href="/customers"
          className="bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-3.5 shadow-sm block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مكتمل المسلمات</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.completedDemands}</span>
            <span className="text-xs text-slate-500 font-medium">تم التسليم بالكامل</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تم تسليم جميع الكتب</span>
          </div>
        </Link>

      </div>

      {/* 3. Prominent Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        
        {/* Card 1: Add Client & Demand */}
        <Link
          href="/customers"
          className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 rounded-xl p-5 sm:p-6 shadow-sm transition-all active:scale-[0.98] flex flex-col justify-between space-y-4 group min-h-[140px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <UserPlus className="w-6 h-6 text-sky-400" />
            </div>
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:-translate-x-1 transition-transform shrink-0" />
          </div>
          <div>
            <h3 className="font-black text-white text-base sm:text-lg">إضافة زبون جديد</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">تسجيل خصاص مدرسي جديد لزبون</p>
          </div>
        </Link>

        {/* Card 2: A4 Purchase Report */}
        <Link
          href="/reports"
          className="bg-white border border-slate-200 hover:border-slate-900 text-slate-900 rounded-xl p-5 sm:p-6 shadow-sm transition-all active:scale-[0.98] flex flex-col justify-between space-y-4 group min-h-[140px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-slate-900" />
            </div>
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:-translate-x-1 transition-transform shrink-0" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg">تقرير المشتريات A4</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">طباعة ورقة الخصاص للموردين</p>
          </div>
        </Link>

        {/* Card 3: Add & Allocate Stock */}
        <Link
          href="/stock"
          className="bg-white border border-slate-200 hover:border-slate-900 text-slate-900 rounded-xl p-5 sm:p-6 shadow-sm transition-all active:scale-[0.98] flex flex-col justify-between space-y-4 group min-h-[140px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <PackageCheck className="w-6 h-6 text-slate-900" />
            </div>
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:-translate-x-1 transition-transform shrink-0" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg">استقبال السلع والمخزون</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">تأكيد وصول الكتب وتوزيعها فوراً</p>
          </div>
        </Link>

      </div>

    </div>
  );
}
