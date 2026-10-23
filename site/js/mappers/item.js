import { shortEffect } from './effect.js';

export function mapItem(json) {
  return {
    id: json.id,
    name: json.name,
    cost: json.cost ?? null,
    category: json.category.name,
    sprite: json.sprites?.default ?? null,
    shortEffect: shortEffect(json),
  };
}
