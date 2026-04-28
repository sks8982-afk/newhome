import { refreshAnnouncements } from './index';

async function main(): Promise<void> {
  const result = await refreshAnnouncements();
  console.log(JSON.stringify(
    {
      total: result.total,
      matched: result.matched,
      newCount: result.newItems.length,
      newTitles: result.newItems.map((i) => i.title),
    },
    null,
    2,
  ));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
