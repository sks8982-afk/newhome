import type { Announcement } from '@/types/announcement';

interface Props {
  item: Announcement;
}

// 만원 단위 → "3.5억" (소수 첫째자리, 정수면 "3억")
function toEok(manwon: number): string {
  return `${(manwon / 10000).toFixed(1).replace(/\.0$/, '')}억`;
}

export function AnnouncementCard({ item }: Props): React.ReactElement {
  const base = 'rounded-lg border p-3 sm:p-4 transition hover:shadow-sm bg-white';
  const priorityCls = item.isPriority
    ? 'border-priority-500 bg-priority-50 ring-1 ring-priority-500'
    : 'border-slate-200';

  const priceMin = typeof item.raw?.priceMin === 'number' ? item.raw.priceMin : undefined;
  const priceMax = typeof item.raw?.priceMax === 'number' ? item.raw.priceMax : undefined;
  const units = typeof item.raw?.units === 'number' ? item.raw.units : undefined;
  const address = typeof item.raw?.address === 'string' ? item.raw.address : undefined;

  const isJupjup = item.housingType === '무순위';
  const unitLabel = units !== undefined ? `${isJupjup ? '잔여 ' : ''}${units}세대` : undefined;

  // 지도 검색: 아파트명은 안 잡히는 경우가 많아 주소 우선. 주소가 없으면
  // 제목보다는 도시명(수원/화성 등)이 그나마 검색되므로 city → title 순 폴백.
  const mapQuery =
    address && address.length > 3 ? address : item.city ?? item.title;
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(mapQuery)}`;
  const kakaoUrl = `https://map.kakao.com/?q=${encodeURIComponent(mapQuery)}`;

  return (
    <article className={`${base} ${priorityCls}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
          {item.source === 'CHUNGYAK' ? '청약홈' : item.source}
        </span>
        <span
          className={`rounded px-2 py-0.5 ${
            isJupjup
              ? 'bg-violet-100 font-semibold text-violet-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isJupjup ? '줍줍' : item.housingType}
        </span>
        <span className="text-slate-500">{item.region}</span>
        {item.status && (
          <span
            className={`rounded px-2 py-0.5 font-semibold ${
              item.status === '접수중'
                ? 'bg-rose-100 text-rose-700'
                : item.status === '공고중'
                  ? 'bg-blue-100 text-blue-700'
                  : item.status === '정정공고중'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.status}
          </span>
        )}
        {item.isPriority && (
          <span className="rounded-full bg-priority-600 px-2 py-0.5 font-bold text-white">
            ⭐ 우선
          </span>
        )}
        {item.isNew && (
          <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
            NEW
          </span>
        )}
      </div>

      <a
        href={item.detailUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-sm font-semibold leading-snug text-slate-900 hover:underline sm:text-base line-clamp-2"
      >
        {item.title}
      </a>

      {(priceMin !== undefined || unitLabel) && (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          {priceMin !== undefined ? (
            <>
              💰 분양가 {toEok(priceMin)}
              {priceMax !== undefined && priceMax !== priceMin ? `~${toEok(priceMax)}` : ''}
              {unitLabel ? <span className="ml-1 font-normal text-slate-500">· {unitLabel}</span> : null}
            </>
          ) : (
            <span className="text-violet-700">🏠 {unitLabel}</span>
          )}
        </p>
      )}

      <p className="mt-1 text-xs text-slate-500">
        게시 {item.postedAt || '-'}
        {item.applyEnd && ` · 마감 ${item.applyEnd}`}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400">📍</span>
        <a
          href={naverUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-green-300 bg-green-50 px-1.5 py-0.5 font-medium text-green-700 hover:bg-green-100"
        >
          네이버지도
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
        >
          카카오맵
        </a>
        {address && (
          <span className="min-w-0 flex-1 truncate text-slate-400" title={address}>
            {address}
          </span>
        )}
      </div>
    </article>
  );
}
