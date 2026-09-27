'use client';

export const dynamic = 'force-dynamic';

import React, { use, Suspense } from 'react';
import AppShell from '@/components/AppShell';
import CustomerDetails from '@/components/CustomerDetails';

export default function SingleCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AppShell>
      {({
        demands,
        masterProducts,
        handleUpdateDemand,
        handleUpdateItemState,
        handleDeleteDemand,
      }) => (
        <Suspense fallback={null}>
          <CustomerDetails
            id={id}
            demands={demands}
            masterProducts={masterProducts}
            onUpdateDemand={handleUpdateDemand}
            onUpdateItemState={handleUpdateItemState}
            onDeleteDemand={handleDeleteDemand}
          />
        </Suspense>
      )}
    </AppShell>
  );
}
