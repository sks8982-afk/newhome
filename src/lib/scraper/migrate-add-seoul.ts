// One-shot: add '서울' to the saved filter regions so dashboard + dispatcher
// pick up Seoul announcements as well. Idempotent — running twice is a no-op.
import { prisma } from '@/lib/db/client';

async function main(): Promise<void> {
  const current = await prisma.filter.findUnique({ where: { id: 1 } });
  if (!current) {
    console.log('[migrate-add-seoul] no filter row, skipping');
    return;
  }
  const next = [...new Set([...current.regions, '서울'])].sort();
  if (next.length === current.regions.length) {
    console.log('[migrate-add-seoul] already has 서울, no change');
    return;
  }
  await prisma.filter.update({
    where: { id: 1 },
    data: { regions: next },
  });
  console.log('[migrate-add-seoul] regions:', current.regions, '->', next);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
