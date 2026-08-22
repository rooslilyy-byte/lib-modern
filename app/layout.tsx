import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'شركة إيزوران - نظام إدارة الخصاصات',
  description: 'نظام إدارة وتوزيع كتب ومستلزمات الدخول المدرسي لشركة إيزوران',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} overflow-x-hidden`} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 font-cairo antialiased selection:bg-slate-900 selection:text-white overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
