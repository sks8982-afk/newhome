import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '내집 알리미 - 청약·분양·줍줍 모니터',
  description:
    'LH·청약홈의 임대·분양·무순위(줍줍) 공고를 한곳에 모아 수원·화성·오산·서울 우선으로 알려드립니다.',
  applicationName: '내집 알리미',
  appleWebApp: {
    capable: true,
    title: '내집 알리미',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="group block">
              <h1 className="text-xl font-bold text-slate-900 transition group-hover:text-priority-700 sm:text-2xl">
                🏠 내집 알리미
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                LH · 청약홈 · 분양/줍줍 · 경기도 (수원·화성·오산 우선)
              </p>
            </Link>
            <nav className="flex gap-2 text-sm">
              <a className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-center hover:bg-slate-50 sm:flex-none" href="/">대시보드</a>
              <a className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-center hover:bg-slate-50 sm:flex-none" href="/calendar">캘린더</a>
              <a className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-center hover:bg-slate-50 sm:flex-none" href="/settings">설정</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
