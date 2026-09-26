'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Language = 'ar' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Navigation
    'nav.dashboard': 'الرئيسية',
    'nav.customers': 'دليل الزبائن',
    'nav.stock': 'استقبال وتوزيع السلع',
    'nav.search': 'بحث عن منتج',
    'nav.reports': 'التقارير والمشتريات',
    'nav.main_menu': 'القائمة الرئيسية',
    'nav.hide_sidebar': 'إخفاء القائمة',
    'nav.show_sidebar': 'عرض القائمة',

    // Branding & Header
    'brand.name': 'المكتبة العصرية',
    'brand.sub': 'Lib Moderne',
    'brand.full': 'المكتبة العصرية — Lib Moderne',
    'brand.tagline': 'موسم الدخول المدرسي — متابعة وتوزيع خصاصات الكتب والمستلزمات',
    'header.contacts': 'أرقام التواصل والخدمة:',
    'header.call': 'اتصال',

    // Dashboard
    'dash.title': 'لوحة تحكّم المكتبة العصرية',
    'dash.season': 'Lib Moderne POS',
    'dash.new_demand': 'إضافة طلب جديد',
    'dash.total_demands': 'إجمالي الطلبات',
    'dash.pending_demands': 'قيد الانتظار',
    'dash.partial_demands': 'تسليم جزئي',
    'dash.completed_demands': 'مكتمل التسليم',
    'dash.total_items_needed': 'مجموع الكتب المطلوبة:',
    'dash.awaiting_purchase': 'تنتظر الشراء للمحل',
    'dash.some_ready': 'بعض العناصر متوفرة',
    'dash.all_delivered': 'تم تسليم جميع المستلزمات',
    'dash.add_client_card_title': 'إضافة زبون جديد',
    'dash.add_client_card_desc': 'تسجيل خصاص مدرسي جديد لزبون بالمتجر',
    'dash.a4_report_card_title': 'تقرير المشتريات A4',
    'dash.a4_report_card_desc': 'طباعة ورقة الخصاص للموردين باللائحة',
    'dash.stock_card_title': 'استقبال وتوزيع السلع',
    'dash.stock_card_desc': 'تأكيد وصول الكتب وتوزيعها فوراً للزبناء',

    // Customers Directory
    'cust.title': 'دليل الزبناء',
    'cust.subtitle': 'عرض جميع لوائح وخصاصات الزبناء بشكل منفصل ومستقل',
    'cust.search_placeholder': 'ابحث بالاسم أو الهاتف...',
    'cust.bulk_delete': 'حذف جماعي',
    'cust.filter_all': 'الكل',
    'cust.filter_ready': 'جاهز بالكامل',
    'cust.filter_partial': 'جاهز جزئياً',
    'cust.filter_waiting': 'في الانتظار',
    'cust.no_results': 'لا يوجد زبناء مطابقون للبحث',
    'cust.col_client': 'الزبون واللائحة',
    'cust.col_phone': 'رقم الهاتف (الواتساب)',
    'cust.col_status': 'حالة الخصاص والاستلام',
    'cust.col_details': 'التفاصيل',

    // Stock Allocation
    'stock.title': 'استقبال وتوزيع السلع',
    'stock.subtitle': 'توزيع الكتب والسلع الواصلة للمحل وتخصيصها لطلبات الزبناء تلقائياً حسب الأسبقية',
    'stock.tab_normal': 'قائمة الخصاصات العادية',
    'stock.tab_rupture': 'السلع المقطوعة',
    'stock.sort_alpha': 'أبجدياً',
    'stock.sort_oldest': 'الأقدم طلباً',
    'stock.sort_newest': 'الأحدث طلباً',
    'stock.allocate_btn': 'توزيع المستلم',
    'stock.mark_rupture': 'غير متوفر',
    'stock.restore_normal': 'استعادة للمشتريات',

    // Reports A4
    'report.title': 'تقرير مشتريات الموردين A4',
    'report.rupture_title': 'تقرير السلع غير المتوفرة (En Rupture)',
    'report.print_btn': 'طباعة ورقة A4',

    // Search Page
    'search.title': 'البحث الشامل عن المنتجات',
    'search.subtitle': 'البحث عن خصاص محدد ومعرفة الزبائن المرتبطين به وحالة توفره',
    'search.input_placeholder': 'اكتب اسم الكتاب أو المنتج للبحث...',

    // Auth & General
    'auth.login_title': 'المكتبة العصرية',
    'auth.passcode_label': 'رمز الدخول السري (Passcode):',
    'auth.passcode_btn': 'تسجيل الدخول للنظام',
    'auth.logout': 'تسجيل الخروج',
    'auth.team': 'طاقم العمل',
    'common.items': 'سلعة',
    'common.pieces': 'قطعة',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.print': 'طباعة',
    'common.whatsapp': 'إشعار الواتساب',
  },
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.customers': 'Répertoire Clients',
    'nav.stock': 'Réception & Stock',
    'nav.search': 'Recherche Produit',
    'nav.reports': 'Rapports A4',
    'nav.main_menu': 'Menu Principal',
    'nav.hide_sidebar': 'Masquer la barre',
    'nav.show_sidebar': 'Afficher la barre',

    // Branding & Header
    'brand.name': 'Lib Moderne',
    'brand.sub': 'المكتبة العصرية',
    'brand.full': 'Lib Moderne — المكتبة العصرية',
    'brand.tagline': 'Rentrée Scolaire — Suivi et distribution des commandes de livres',
    'header.contacts': 'Contacts & Service:',
    'header.call': 'Appel',

    // Dashboard
    'dash.title': 'Tableau de bord — Lib Moderne',
    'dash.season': 'Lib Moderne POS',
    'dash.new_demand': 'Nouvelle Commande',
    'dash.total_demands': 'Total Commandes',
    'dash.pending_demands': 'En Attente',
    'dash.partial_demands': 'Partiellement Prêt',
    'dash.completed_demands': 'Livrées / Complètes',
    'dash.total_items_needed': 'Total articles requis:',
    'dash.awaiting_purchase': 'En attente d\'achat magasin',
    'dash.some_ready': 'Certains articles disponibles',
    'dash.all_delivered': 'Tous les articles sont livrés',
    'dash.add_client_card_title': 'Nouveau Client & Commande',
    'dash.add_client_card_desc': 'Enregistrer les articles manquants d\'un client',
    'dash.a4_report_card_title': 'Rapport d\'Achat A4',
    'dash.a4_report_card_desc': 'Imprimer la feuille de commande fournisseurs',
    'dash.stock_card_title': 'Réception et Dispatch',
    'dash.stock_card_desc': 'Attribuer les arrivages directement aux clients',

    // Customers Directory
    'cust.title': 'Répertoire Clients',
    'cust.subtitle': 'Liste de toutes les commandes et demandes clients indépendantes',
    'cust.search_placeholder': 'Rechercher par nom ou téléphone...',
    'cust.bulk_delete': 'Suppression groupée',
    'cust.filter_all': 'Tous',
    'cust.filter_ready': 'Prêt complet',
    'cust.filter_partial': 'Partiel',
    'cust.filter_waiting': 'En attente',
    'cust.no_results': 'Aucun client trouvé',
    'cust.col_client': 'Client & Liste',
    'cust.col_phone': 'Téléphone (WhatsApp)',
    'cust.col_status': 'État & Réception',
    'cust.col_details': 'Détails',

    // Stock Allocation
    'stock.title': 'Réception et Distribution',
    'stock.subtitle': 'Affectation automatique des livres reçus par ordre de priorité',
    'stock.tab_normal': 'Articles à commander',
    'stock.tab_rupture': 'Articles en rupture',
    'stock.sort_alpha': 'Alphabétique',
    'stock.sort_oldest': 'Plus anciens',
    'stock.sort_newest': 'Plus récents',
    'stock.allocate_btn': 'Distribuer',
    'stock.mark_rupture': 'En Rupture',
    'stock.restore_normal': 'Restaurer',

    // Reports A4
    'report.title': 'Rapport Achats Fournisseurs A4',
    'report.rupture_title': 'Rapport Articles en Rupture',
    'report.print_btn': 'Imprimer feuille A4',

    // Search Page
    'search.title': 'Recherche Globale d\'Articles',
    'search.subtitle': 'Trouver un produit spécifique et voir les clients demandeurs',
    'search.input_placeholder': 'Tapez le nom du livre ou produit...',

    // Auth & General
    'auth.login_title': 'Lib Moderne',
    'auth.passcode_label': 'Code d\'accès (Passcode):',
    'auth.passcode_btn': 'Se connecter au système',
    'auth.logout': 'Déconnexion',
    'auth.team': 'Équipe de travail',
    'common.items': 'article(s)',
    'common.pieces': 'pièce(s)',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.print': 'Imprimer',
    'common.whatsapp': 'Notifier WhatsApp',
  }
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
  dir: 'rtl',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('lib_moderne_lang') as Language;
    if (saved === 'ar' || saved === 'fr') {
      setLanguageState(saved);
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = saved;
    }
  }, []);

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('lib_moderne_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, []);

  const toggleLanguage = React.useCallback(() => {
    setLanguageState(prev => {
      const next = prev === 'ar' ? 'fr' : 'ar';
      localStorage.setItem('lib_moderne_lang', next);
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  const t = React.useCallback((key: string): string => {
    return translations[language][key] || translations['ar'][key] || key;
  }, [language]);

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

  const contextValue = React.useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t,
    dir: dir as 'rtl' | 'ltr'
  }), [language, setLanguage, toggleLanguage, t, dir]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
