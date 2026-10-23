// @ts-check
const names = (relations, key) => (relations[key] ?? []).map((resource) => resource.name);

export function mapType(json) {
  const relations = json.damage_relations;
  return {
    id: json.id,
    name: json.name,
    doubleDamageTo: names(relations, 'double_damage_to'),
    halfDamageTo: names(relations, 'half_damage_to'),
    noDamageTo: names(relations, 'no_damage_to'),
    doubleDamageFrom: names(relations, 'double_damage_from'),
    halfDamageFrom: names(relations, 'half_damage_from'),
    noDamageFrom: names(relations, 'no_damage_from'),
    pokemonCount: json.pokemon?.length ?? 0,
  };
}

export function effectiveness(attacker, defenderName) {
  if (attacker.doubleDamageTo.includes(defenderName)) return '2x';
  if (attacker.halfDamageTo.includes(defenderName)) return 'half';
  if (attacker.noDamageTo.includes(defenderName)) return '0';
  return '1';
}
