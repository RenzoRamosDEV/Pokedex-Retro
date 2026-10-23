export function mapBerry(json) {
  return {
    id: json.id,
    name: json.name,
    growthTime: json.growth_time,
    maxHarvest: json.max_harvest,
    naturalGiftPower: json.natural_gift_power,
    naturalGiftType: json.natural_gift_type.name,
    smoothness: json.smoothness,
    firmness: json.firmness.name,
    flavors: json.flavors.map((entry) => ({ potency: entry.potency, flavor: entry.flavor.name })),
  };
}
