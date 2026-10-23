// @ts-check
import { shortEffect } from './effect.js';

export function mapMove(json) {
  return {
    id: json.id,
    name: json.name,
    accuracy: json.accuracy ?? null,
    pp: json.pp,
    priority: json.priority,
    power: json.power ?? null,
    damageClass: json.damage_class.name,
    moveType: json.type.name,
    shortEffect: shortEffect(json),
  };
}
