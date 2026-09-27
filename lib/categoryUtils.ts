export type ProductCategoryKey = 'books' | 'cahiers' | 'fournitures' | 'others';

export interface ProductCategoryConfig {
  key: ProductCategoryKey;
  label: string;
  labelFr: string;
  badgeBg: string;
  activeBg: string;
  textColor: string;
  borderColor: string;
}

export const PRODUCT_CATEGORIES: ProductCategoryConfig[] = [
  {
    key: 'books',
    label: 'كتب',
    labelFr: 'Livres',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
    activeBg: 'bg-blue-700 text-white shadow-blue-700/20',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
  },
  {
    key: 'cahiers',
    label: 'دفاتر',
    labelFr: 'Cahiers',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    activeBg: 'bg-emerald-700 text-white shadow-emerald-700/20',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
  },
  {
    key: 'fournitures',
    label: 'أدوات',
    labelFr: 'Fournitures',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
    activeBg: 'bg-purple-700 text-white shadow-purple-700/20',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
  },
  {
    key: 'others',
    label: 'أخرى',
    labelFr: 'Autres',
    badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200',
    activeBg: 'bg-neutral-800 text-white shadow-neutral-800/20',
    textColor: 'text-neutral-700',
    borderColor: 'border-neutral-300',
  },
];

/**
 * Normalize any legacy string (Arabic or French) to standard category key.
 */
export function normalizeCategory(category?: string | null): ProductCategoryKey {
  if (!category) return 'others';
  const c = category.trim().toLowerCase();

  // 1. Books (كتب)
  if (
    c === 'books' ||
    c === 'book' ||
    c === 'livres' ||
    c === 'livre' ||
    c.includes('كتب') ||
    c.includes('كتاب') ||
    c.includes('معاجم') ||
    c.includes('قصص') ||
    c.includes('رواية')
  ) {
    return 'books';
  }

  // 2. Cahiers (دفاتر)
  if (
    c === 'cahiers' ||
    c === 'cahier' ||
    c.includes('دفاتر') ||
    c.includes('دفتر') ||
    c.includes('كراسات') ||
    c.includes('كراسة') ||
    c.includes('سجل')
  ) {
    return 'cahiers';
  }

  // 3. Fournitures (أدوات / مستلزمات)
  if (
    c === 'fournitures' ||
    c === 'fourniture' ||
    c.includes('أدوات') ||
    c.includes('ادوات') ||
    c.includes('مستلزمات') ||
    c.includes('لوازم') ||
    c.includes('أقلام') ||
    c.includes('اقلام') ||
    c.includes('محفظة') ||
    c.includes('مقلمة')
  ) {
    return 'fournitures';
  }

  // 4. Others (أخرى)
  return 'others';
}

/**
 * Get Arabic display label for category
 */
export function getCategoryLabel(category?: string | null): string {
  const norm = normalizeCategory(category);
  switch (norm) {
    case 'books': return 'كتب';
    case 'cahiers': return 'دفاتر';
    case 'fournitures': return 'أدوات';
    case 'others': return 'أخرى';
  }
}

/**
 * Get category configuration object
 */
export function getCategoryConfig(category?: string | null): ProductCategoryConfig {
  const norm = normalizeCategory(category);
  return PRODUCT_CATEGORIES.find(c => c.key === norm) || PRODUCT_CATEGORIES[3];
}
