'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import AppShell from '@/components/AppShell';
import DashboardOverview from '@/components/DashboardOverview';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <AppShell>
      {({ demands, masterProducts }) => (
        <DashboardOverview
          demands={demands}
          masterProducts={masterProducts}
          onNavigateTab={(tab) => {
            router.push(`/${tab}`);
          }}
        />
      )}
    </AppShell>
  );
}
