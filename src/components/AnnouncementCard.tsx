import type { Announcement } from '@/types/announcement';

interface Props {
  item: Announcement;
}

export function AnnouncementCard({ item }: Props): React.ReactElement {
  const base =
    'rounded-lg border p-4 transition hover:shadow-sm bg-white';
  const priorityCls = item.isPriority
    ? 'border-priority-500 bg-priority-50 ring-1 ring-priority-500'
    : 'border-slate-200';
  return (
    <article className={`${base} ${priorityCls}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
              {item.source}
            </span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
              {item.housingType}
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
            className="block truncate text-base font-semibold text-slate-900 hover:underline"
          >
            {item.title}
          </a>
          <p className="mt-1 text-xs text-slate-500">
            공고번호 {item.noticeNo} · 게시 {item.postedAt || '-'}
            {item.applyEnd && ` · 마감 ${item.applyEnd}`}
          </p>
        </div>
      </div>
    </article>
  );
}
