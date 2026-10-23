const MAX_STAT_BAR_WIDTH = 100;

export function mapPokemon(json) {
  return {
    id: json.id,
    name: json.name,
    baseExperience: json.base_experience ?? null,
    height: json.height,
    weight: json.weight,
    abilities: json.abilities.map((entry) => ({
      name: entry.ability.name,
      isHidden: entry.is_hidden,
      slot: entry.slot,
    })),
    stats: json.stats.map((entry) => ({
      name: entry.stat.name,
      baseStat: entry.base_stat,
      effort: entry.effort,
    })),
    types: json.types.map((entry) => ({ slot: entry.slot, typeName: entry.type.name })),
    sprite: json.sprites.front_default ?? null,
  };
}

const bySlot = (list) => [...list].sort((a, b) => a.slot - b.slot);

export const typesBySlot = (pokemon) => bySlot(pokemon.types);

export const abilitiesBySlot = (pokemon) => bySlot(pokemon.abilities);

const tenths = (value) => (value / 10).toFixed(1);

export const heightMeters = (pokemon) => tenths(pokemon.height);

export const weightKilograms = (pokemon) => tenths(pokemon.weight);

export const primaryType = (pokemon) => pokemon.types[0]?.typeName ?? 'normal';

export const statBarWidth = (baseStat) => Math.min(baseStat, MAX_STAT_BAR_WIDTH);
