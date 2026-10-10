'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import AppShell from '@/components/AppShell';
import SupplierBuyingSheet from '@/components/SupplierBuyingSheet';

export default function ReportsPage() {
  return (
    <AppShell>
      {({ activeBatch, demands, masterProducts, handleArchiveBatch }) => (
        <SupplierBuyingSheet
          activeBatch={activeBatch}
          demands={demands}
          masterProducts={masterProducts}
          onArchiveBatch={handleArchiveBatch}
        />
      )}
    </AppShell>
  );
}
