import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '내집 알리미 - LH 청약플러스 행복주택 모니터',
  description:
    'LH 청약플러스 행복주택 공고를 자동으로 모니터링하고 수원·화성·오산 우선 알림을 제공합니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="mx-auto max-w-6xl p-6">
          <header className="mb-6 flex items-center justify-between">
            <Link href="/" className="group block">
              <h1 className="text-2xl font-bold text-slate-900 transition group-hover:text-priority-700">
                🏠 내집 알리미
              </h1>
              <p className="text-sm text-slate-500">
                LH 청약플러스 · 행복주택 · 경기도 (수원·화성·오산 우선)
              </p>
            </Link>
            <nav className="flex gap-2 text-sm">
              <a className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50" href="/">대시보드</a>
              <a className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50" href="/calendar">캘린더</a>
              <a className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50" href="/settings">설정</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
