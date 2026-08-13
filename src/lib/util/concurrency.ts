// 동시성 제한 map — 공고당 추가 HTTP 호출을 제한된 병렬로 처리한다.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < items.length) {
      const cur = i;
      i += 1;
      results[cur] = await fn(items[cur]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
