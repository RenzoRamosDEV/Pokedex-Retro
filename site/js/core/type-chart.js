// @ts-check
import { loadSection } from './load-section.js';
import { SECTIONS } from './sections.js';
import { effectiveness } from '../mappers/type.js';

/** @typedef {(url: string) => Promise<{ ok: boolean, status: number, json: any }>} PokeApiPort */

const MULTIPLICADOR = { '2x': 2, half: 0.5, 0: 0, 1: 1 };

/**
 * Loads the damage table; an incomplete table would yield wrong multipliers, so any failure throws.
 * @param {PokeApiPort} port
 * @returns {Promise<{ names: string[], multiplier(atacante: string, defensor: string): number }>}
 */
export async function loadTypeChart(port) {
  const result = await loadSection(port, SECTIONS.tipos, { page: 1, query: null, rawQuery: null });
  if (result.status === 'error' || result.failedCount > 0) {
    throw new Error('tabla de tipos incompleta');
  }
  const byName = new Map(result.items.map((type) => [type.name, type]));
  return {
    names: [...byName.keys()],
    multiplier: (atacante, defensor) =>
      MULTIPLICADOR[effectiveness(byName.get(atacante), defensor)],
  };
}
