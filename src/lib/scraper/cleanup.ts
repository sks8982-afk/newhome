import { prisma } from '@/lib/db/client';

async function main(): Promise<void> {
  // Mock data inserted during early development used noticeNo like "2026-경기-001".
  // Real LH data uses 16-digit numeric IDs (e.g. "2015122300019858").
  // Delete only the mock rows to avoid wiping real fetched data.
  const before = await prisma.announcement.count();
  const mock = await prisma.announcement.findMany({
    where: { noticeNo: { startsWith: '2026-' } },
    select: { id: true, noticeNo: true, title: true },
  });
  console.log(`[cleanup] before=${before} mock_to_delete=${mock.length}`);
  for (const m of mock) console.log('  -', m.noticeNo, m.title.slice(0, 50));

  if (mock.length > 0) {
    await prisma.seenAnnouncement.deleteMany({
      where: { announcementId: { in: mock.map((m) => m.id) } },
    });
    const result = await prisma.announcement.deleteMany({
      where: { noticeNo: { startsWith: '2026-' } },
    });
    console.log(`[cleanup] deleted ${result.count} mock rows`);
  }
  const after = await prisma.announcement.count();
  console.log(`[cleanup] after=${after}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
