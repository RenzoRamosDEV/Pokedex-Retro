// @ts-check
export function shortEffect(json) {
  const entries = json.effect_entries ?? [];
  const preferred = entries.find((entry) => entry.language?.name === 'en') ?? entries[0];
  return preferred?.short_effect ?? '';
}
