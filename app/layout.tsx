import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'Lib Moderne - المكتبة العصرية | نظام إدارة الخصاصات',
  description: 'نظام إدارة وتوزيع كتب ومستلزمات الدخول المدرسي - المكتبة العصرية (Lib Moderne)',
  icons: {
    icon: [
      { url: '/logo no background.png', type: 'image/png' },
      { url: '/logo-lib-modern.jpg', type: 'image/jpeg' },
    ],
    shortcut: '/logo no background.png',
    apple: '/logo no background.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} overflow-x-hidden`} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/logo no background.png" />
        <link rel="shortcut icon" href="/logo no background.png" />
        <link rel="apple-touch-icon" href="/logo no background.png" />
        <link rel="preload" as="image" href="/logo-lib-modern.jpg" />
        <link rel="preload" as="image" href="/logo no background.png" />
      </head>
      <body className="min-h-screen bg-[#F8F9FA] font-cairo antialiased selection:bg-neutral-900 selection:text-white overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

