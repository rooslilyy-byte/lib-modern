'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import CustomersDirectory from '@/components/CustomersDirectory';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const router = useRouter();

  return (
    <AppShell>
      {({ demands, masterProducts, handleCreateDemand, handleDeleteBulkCustomers }) => (
        <Suspense fallback={null}>
          <CustomersDirectory
            demands={demands}
            masterProducts={masterProducts}
            onCreateDemand={handleCreateDemand}
            onDeleteBulkCustomers={handleDeleteBulkCustomers}
            onSelectCustomer={(customerId) => {
              router.push(`/customers/${encodeURIComponent(customerId)}`);
            }}
          />
        </Suspense>
      )}
    </AppShell>
  );
}
