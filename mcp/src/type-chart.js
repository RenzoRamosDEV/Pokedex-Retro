// @ts-check
import { loadSection } from '../../site/js/core/load-section.js';
import { SECTIONS } from '../../site/js/core/sections.js';
import { effectiveness } from '../../site/js/mappers/type.js';

const MULTIPLICADOR = { '2x': 2, half: 0.5, 0: 0, 1: 1 };

/** `stellar` has no damage relations, so the MCP leaves it out of the 18-type table. */
const CONFIG = { ...SECTIONS.tipos, exclude: [...SECTIONS.tipos.exclude, 'stellar'] };

/**
 * Loads the damage table; an incomplete table would yield wrong multipliers, so any failure throws.
 * @param {import('./client.js').PokeApiPort} port
 * @returns {Promise<{ names: string[], multiplier(atacante: string, defensor: string): number }>}
 */
export async function loadTypeChart(port) {
  const result = await loadSection(port, CONFIG, { page: 1, query: null, rawQuery: null });
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
