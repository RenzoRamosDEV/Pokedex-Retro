// @ts-check
import { shortEffect } from './effect.js';

export function mapAbility(json) {
  return {
    id: json.id,
    name: json.name,
    shortEffect: shortEffect(json),
    pokemonCount: json.pokemon?.length ?? 0,
  };
}
