// @ts-check
const STAT_GROUPS = [
  { stat: 'attack', label: 'ATK' },
  { stat: 'defense', label: 'DEF' },
  { stat: 'special-attack', label: 'SP.ATK' },
  { stat: 'special-defense', label: 'SP.DEF' },
  { stat: 'speed', label: 'SPD' },
];

const optionalName = (resource) => resource?.name ?? null;

export function mapNature(json) {
  return {
    id: json.id,
    name: json.name,
    increasedStat: optionalName(json.increased_stat),
    decreasedStat: optionalName(json.decreased_stat),
    likesFlavor: optionalName(json.likes_flavor),
    hatesFlavor: optionalName(json.hates_flavor),
  };
}

export function groupNatures(natures) {
  const statGroups = STAT_GROUPS.map((group) => ({
    ...group,
    up: natures.filter((n) => n.increasedStat === group.stat),
    down: natures.filter((n) => n.decreasedStat === group.stat),
  }));
  const all = natures.filter((n) => n.increasedStat === null && n.decreasedStat === null);
  const leftCount = Math.ceil(all.length / 2);
  return {
    statGroups,
    neutrals: { all, left: all.slice(0, leftCount), right: all.slice(leftCount) },
  };
}
