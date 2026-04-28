// One-shot migration: switch saved filter to "all housing types".
// Existing rows with housingTypes=['행복주택'] → housingTypes=[] (전체).
// regions / priorityCities are preserved.
import { prisma } from '@/lib/db/client';
import { DEFAULT_FILTER } from '@/types/announcement';

async function main(): Promise<void> {
  const current = await prisma.filter.findUnique({ where: { id: 1 } });
  if (!current) {
    await prisma.filter.create({
      data: {
        id: 1,
        housingTypes: DEFAULT_FILTER.housingTypes,
        regions: DEFAULT_FILTER.regions,
        priorityCities: DEFAULT_FILTER.priorityCities,
      },
    });
    console.log('[migrate-filter] created default filter row');
    return;
  }
  console.log('[migrate-filter] before:', {
    housingTypes: current.housingTypes,
    regions: current.regions,
    priorityCities: current.priorityCities,
  });
  await prisma.filter.update({
    where: { id: 1 },
    data: {
      housingTypes: [],
      // 사용자가 직접 priorityCities를 비워두지 않은 경우 보존
      priorityCities:
        current.priorityCities.length > 0
          ? current.priorityCities
          : DEFAULT_FILTER.priorityCities,
    },
  });
  const after = await prisma.filter.findUnique({ where: { id: 1 } });
  console.log('[migrate-filter] after:', {
    housingTypes: after?.housingTypes,
    regions: after?.regions,
    priorityCities: after?.priorityCities,
  });
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
