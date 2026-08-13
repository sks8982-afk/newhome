import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '내집 알리미 - 청약·분양·줍줍 모니터',
    short_name: '내집 알리미',
    description:
      'LH·청약홈의 임대·분양·무순위(줍줍) 공고를 한곳에 모아 수원·화성·오산·서울 우선으로 알려드립니다.',
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
