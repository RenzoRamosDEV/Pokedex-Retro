// @ts-check
export function normalizeQuery(raw) {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? null : trimmed.toLowerCase().replaceAll(' ', '-');
}

export function filterByName(results, query) {
  if (query === null) return results;
  return results.filter((entry) => entry.name.includes(query));
}
