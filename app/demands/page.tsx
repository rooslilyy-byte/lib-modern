'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemandsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customers');
  }, [router]);

  return (
    <div className="p-8 text-center font-bold text-slate-500">
      جاري التوجيه إلى دليل الزبناء...
    </div>
  );
}
