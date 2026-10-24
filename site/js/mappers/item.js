// @ts-check
import { shortEffect } from './effect.js';

function itemPrice(json) {
  if (typeof json.cost === 'number') return json.cost;
  const purchasable = (json.prices ?? []).filter(
    (price) => price.currency.name === 'poke-dollar' && price.purchase_price > 0,
  );
  return purchasable.at(-1)?.purchase_price ?? null;
}

export function mapItem(json) {
  return {
    id: json.id,
    name: json.name,
    cost: itemPrice(json),
    category: json.category.name,
    sprite: json.sprites?.default ?? null,
    shortEffect: shortEffect(json),
  };
}
