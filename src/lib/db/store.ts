import type { Announcement, UserFilter } from '@/types/announcement';
import { DEFAULT_FILTER } from '@/types/announcement';
import { prisma } from './client';

export async function loadAnnouncements(): Promise<Announcement[]> {
  const rows = await prisma.announcement.findMany({
    orderBy: [{ isPriority: 'desc' }, { postedAt: 'desc' }],
  });
  const seen = new Set(
    (await prisma.seenAnnouncement.findMany({ select: { announcementId: true } })).map(
      (s) => s.announcementId,
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    source: r.source as Announcement['source'],
    noticeNo: r.noticeNo,
    title: r.title,
    housingType: r.housingType as Announcement['housingType'],
    region: r.region,
    city: r.city ?? undefined,
    postedAt: r.postedAt,
    applyStart: r.applyStart ?? undefined,
    applyEnd: r.applyEnd ?? undefined,
    status: r.status ?? undefined,
    detailUrl: r.detailUrl,
    isPriority: r.isPriority,
    isNew: !seen.has(r.id),
    fetchedAt: r.fetchedAt.toISOString(),
    notifiedChannels: r.notifiedChannels ?? [],
  }));
}

export async function upsertAnnouncements(items: Announcement[]): Promise<void> {
  for (const a of items) {
    await prisma.announcement.upsert({
      where: { id: a.id },
      update: {
        title: a.title,
        housingType: a.housingType,
        region: a.region,
        city: a.city ?? null,
        postedAt: a.postedAt,
        applyStart: a.applyStart ?? null,
        applyEnd: a.applyEnd ?? null,
        status: a.status ?? null,
        detailUrl: a.detailUrl,
        isPriority: a.isPriority,
      },
      create: {
        id: a.id,
        source: a.source,
        noticeNo: a.noticeNo,
        title: a.title,
        housingType: a.housingType,
        region: a.region,
        city: a.city ?? null,
        postedAt: a.postedAt,
        applyStart: a.applyStart ?? null,
        applyEnd: a.applyEnd ?? null,
        status: a.status ?? null,
        detailUrl: a.detailUrl,
        isPriority: a.isPriority,
      },
    });
  }
}

export async function loadFilter(): Promise<UserFilter> {
  const row = await prisma.filter.findUnique({ where: { id: 1 } });
  if (!row) {
    await prisma.filter.create({
      data: {
        id: 1,
        housingTypes: DEFAULT_FILTER.housingTypes,
        regions: DEFAULT_FILTER.regions,
        priorityCities: DEFAULT_FILTER.priorityCities,
      },
    });
    return DEFAULT_FILTER;
  }
  return {
    housingTypes: row.housingTypes as UserFilter['housingTypes'],
    regions: row.regions,
    priorityCities: row.priorityCities,
  };
}

export async function saveFilter(filter: UserFilter): Promise<void> {
  await prisma.filter.upsert({
    where: { id: 1 },
    update: {
      housingTypes: filter.housingTypes,
      regions: filter.regions,
      priorityCities: filter.priorityCities,
    },
    create: {
      id: 1,
      housingTypes: filter.housingTypes,
      regions: filter.regions,
      priorityCities: filter.priorityCities,
    },
  });
}

export async function loadSeenIds(): Promise<string[]> {
  const rows = await prisma.seenAnnouncement.findMany({
    select: { announcementId: true },
  });
  return rows.map((r) => r.announcementId);
}

export async function markSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.seenAnnouncement.createMany({
    data: ids.map((id) => ({ announcementId: id })),
    skipDuplicates: true,
  });
}

export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.announcement.updateMany({
    where: { id: { in: ids } },
    data: { notifiedAt: new Date() },
  });
}

export async function getUnnotifiedNewItems(): Promise<Announcement[]> {
  const rows = await prisma.announcement.findMany({
    where: { notifiedAt: null },
    orderBy: [{ isPriority: 'desc' }, { postedAt: 'desc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    source: r.source as Announcement['source'],
    noticeNo: r.noticeNo,
    title: r.title,
    housingType: r.housingType as Announcement['housingType'],
    region: r.region,
    city: r.city ?? undefined,
    postedAt: r.postedAt,
    detailUrl: r.detailUrl,
    isPriority: r.isPriority,
    isNew: true,
    fetchedAt: r.fetchedAt.toISOString(),
  }));
}
