import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '내집 알리미 - LH 청약플러스 행복주택 모니터',
    short_name: '내집 알리미',
    description:
      'LH 청약플러스 행복주택 공고를 자동으로 모니터링하고 수원·화성·오산 우선 알림을 제공합니다.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    lang: 'ko',
    categories: ['lifestyle', 'utilities', 'news'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
