/**
 * Helper to detect Arabic characters in a string
 */
export const isArabic = (str: string): boolean => /[\u0600-\u06FF]/.test(str);

/**
 * Standard product name comparison function:
 * 1. Arabic products first (sorted أ to ي)
 * 2. Latin / French products second (sorted A to Z)
 */
export const compareProductNames = (nameA: string = '', nameB: string = ''): number => {
  const cleanA = (nameA || '').trim();
  const cleanB = (nameB || '').trim();

  const aArabic = isArabic(cleanA);
  const bArabic = isArabic(cleanB);

  // Arabic product names first, followed by Latin names
  if (aArabic && !bArabic) return -1;
  if (!aArabic && bArabic) return 1;

  if (aArabic && bArabic) {
    return cleanA.localeCompare(cleanB, 'ar', { sensitivity: 'base' });
  }

  return cleanA.localeCompare(cleanB, 'fr', { sensitivity: 'base' });
};

/**
 * Standard product name comparison function (Descending):
 * 1. Arabic products first (sorted ي to أ)
 * 2. Latin / French products second (sorted Z to A)
 */
export const compareProductNamesDesc = (nameA: string = '', nameB: string = ''): number => {
  const cleanA = (nameA || '').trim();
  const cleanB = (nameB || '').trim();

  const aArabic = isArabic(cleanA);
  const bArabic = isArabic(cleanB);

  // Arabic product names first, followed by Latin names
  if (aArabic && !bArabic) return -1;
  if (!aArabic && bArabic) return 1;

  if (aArabic && bArabic) {
    return cleanB.localeCompare(cleanA, 'ar', { sensitivity: 'base' });
  }

  return cleanB.localeCompare(cleanA, 'fr', { sensitivity: 'base' });
};
