export type ProductCategoryKey = 'books' | 'fournitures' | 'others';

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
    activeBg: 'bg-amber-600 text-white shadow-sm',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
  },
  {
    key: 'fournitures',
    label: 'أدوات',
    labelFr: 'Fournitures',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
    activeBg: 'bg-amber-600 text-white shadow-sm',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
  },
  {
    key: 'others',
    label: 'أخرى',
    labelFr: 'Autres',
    badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200',
    activeBg: 'bg-amber-600 text-white shadow-sm',
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

  // 2. Fournitures (أدوات / دفاتر ومستلزمات)
  if (
    c === 'fournitures' ||
    c === 'fourniture' ||
    c === 'cahiers' ||
    c === 'cahier' ||
    c.includes('أدوات') ||
    c.includes('ادوات') ||
    c.includes('دفاتر') ||
    c.includes('دفتر') ||
    c.includes('كراسات') ||
    c.includes('كراسة') ||
    c.includes('سجل') ||
    c.includes('مستلزمات') ||
    c.includes('لوازم') ||
    c.includes('أقلام') ||
    c.includes('اقلام') ||
    c.includes('محفظة') ||
    c.includes('مقلمة')
  ) {
    return 'fournitures';
  }

  // 3. Others (أخرى)
  return 'others';
}

/**
 * Get Arabic display label for category
 */
export function getCategoryLabel(category?: string | null): string {
  const norm = normalizeCategory(category);
  switch (norm) {
    case 'books': return 'كتب';
    case 'fournitures': return 'أدوات';
    case 'others': return 'أخرى';
  }
}

/**
 * Get category configuration object
 */
export function getCategoryConfig(category?: string | null): ProductCategoryConfig {
  const norm = normalizeCategory(category);
  return PRODUCT_CATEGORIES.find(c => c.key === norm) || PRODUCT_CATEGORIES[2];
}
