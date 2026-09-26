'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  ArrowLeft,
  UserPlus,
  FileSpreadsheet,
  PackageCheck,
  Layers
} from 'lucide-react';
import { ClientDemand, MasterProduct } from '@/lib/types';
import { useLanguage } from '@/lib/languageContext';

interface DashboardOverviewProps {
  demands: ClientDemand[];
  masterProducts: MasterProduct[];
  onNavigateTab?: (tab: string) => void;
}

function DashboardOverview({
  demands,
}: DashboardOverviewProps) {
  const { t } = useLanguage();

  const stats = useMemo(() => {
    let pendingDemands = 0;
    let partialDemands = 0;
    let completedDemands = 0;
    let totalItemsCount = 0;
    let deliveredItemsCount = 0;

    for (let i = 0; i < demands.length; i++) {
      const d = demands[i];
      if (d.status === 'pending') pendingDemands++;
      else if (d.status === 'partial') partialDemands++;
      else if (d.status === 'completed') completedDemands++;

      if (d.items) {
        for (let j = 0; j < d.items.length; j++) {
          const item = d.items[j];
          const qty = item.quantity || 0;
          totalItemsCount += qty;
          if (item.is_delivered) deliveredItemsCount += qty;
        }
      }
    }

    return {
      totalDemands: demands.length,
      pendingDemands,
      partialDemands,
      completedDemands,
      totalItemsCount,
      deliveredItemsCount,
    };
  }, [demands]);

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* 1. Header Banner Floating Glass Card with Custom White Logo */}
      <div className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/logo-lib-modern.jpg"
            alt="Lib Moderne - المكتبة العصرية"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-xl font-black text-neutral-900 tracking-tight">
                {t('dash.title')}
              </h2>
              <span className="bg-orange-50 text-orange-700 border border-orange-200/80 text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 rounded-full">
                {t('dash.season')}
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {t('brand.tagline')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <Link
            href="/customers"
            className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold h-9 sm:h-11 px-4 sm:px-6 rounded-full flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-700 shrink-0" />
            <span>{t('dash.new_demand')}</span>
          </Link>
        </div>
      </div>

      {/* 2. Floating KPI Summary Cards with Status Deep-Linking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Total Demands Card -> links to ?status=all */}
        <Link 
          href="/customers?status=all"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-neutral-300/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 group-hover:text-neutral-900 transition-colors">
              {t('dash.total_demands')}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-800 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{stats.totalDemands}</span>
            <span className="text-xs text-neutral-500 font-bold">طلب مسجل</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{t('dash.total_items_needed')}</span>
            <span className="font-bold text-neutral-800">{stats.totalItemsCount} {t('common.pieces')}</span>
          </div>
        </Link>

        {/* Pending Card -> links to ?status=waiting */}
        <Link 
          href="/customers?status=waiting"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-rose-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 group-hover:text-rose-600 transition-colors">
              {t('dash.pending_demands')}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 transition-colors group-hover:bg-rose-500 group-hover:text-white">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{stats.pendingDemands}</span>
            <span className="text-xs text-neutral-500 font-bold">طلب معلق</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{t('dash.awaiting_purchase')}</span>
          </div>
        </Link>

        {/* Partial Card -> links to ?status=partial */}
        <Link 
          href="/customers?status=partial"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-amber-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 group-hover:text-amber-600 transition-colors">
              {t('dash.partial_demands')}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{stats.partialDemands}</span>
            <span className="text-xs text-neutral-500 font-bold">مستلم جزئياً</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{t('dash.some_ready')}</span>
          </div>
        </Link>

        {/* Completed Card -> links to ?status=ready */}
        <Link 
          href="/customers?status=ready"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 rounded-3xl p-4 sm:p-5 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-emerald-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 group-hover:text-emerald-600 transition-colors">
              {t('dash.completed_demands')}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{stats.completedDemands}</span>
            <span className="text-xs text-neutral-500 font-bold">تم تسليمه</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{t('dash.all_delivered')}</span>
          </div>
        </Link>

      </div>

      {/* 3. Quick Action Floating Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full">
        
        {/* Card 1: Add Client & Demand */}
        <Link
          href="/customers"
          className="bg-neutral-900 text-white rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl flex flex-col justify-between space-y-4 group min-h-[150px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 text-orange-700 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <UserPlus className="w-6 h-6 text-orange-700" />
            </div>
            <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:bg-neutral-700 transition-all">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base sm:text-lg">{t('dash.add_client_card_title')}</h3>
            <p className="text-xs text-neutral-400 font-medium mt-1">{t('dash.add_client_card_desc')}</p>
          </div>
        </Link>

        {/* Card 2: A4 Purchase Report */}
        <Link
          href="/reports"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 hover:border-neutral-300 text-neutral-900 rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl flex flex-col justify-between space-y-4 group min-h-[150px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-700 border border-orange-200/80 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-orange-700" />
            </div>
            <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 group-hover:bg-neutral-200 transition-all">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-neutral-900 text-base sm:text-lg">{t('dash.a4_report_card_title')}</h3>
            <p className="text-xs text-neutral-500 font-medium mt-1">{t('dash.a4_report_card_desc')}</p>
          </div>
        </Link>

        {/* Card 3: Add & Allocate Stock */}
        <Link
          href="/stock"
          className="bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 hover:border-neutral-300 text-neutral-900 rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl flex flex-col justify-between space-y-4 group min-h-[150px] w-full"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-900 border border-neutral-200/60 flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0">
              <PackageCheck className="w-6 h-6 text-neutral-900" />
            </div>
            <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 group-hover:bg-neutral-200 transition-all">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-neutral-900 text-base sm:text-lg">{t('dash.stock_card_title')}</h3>
            <p className="text-xs text-neutral-500 font-medium mt-1">{t('dash.stock_card_desc')}</p>
          </div>
        </Link>

      </div>

    </div>
  );
}

export default React.memo(DashboardOverview);
