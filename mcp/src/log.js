// @ts-check

const LEVELS = ['error', 'info', 'debug'];

/**
 * @typedef {{ error(message: string): void, info(message: string): void, debug(message: string): void }} Logger
 */

/**
 * Unknown or missing levels fall back to `error`.
 * @param {{ level?: string, write: (line: string) => void }} options
 * @returns {Logger}
 */
export function createLogger({ level, write }) {
  const maxRank = Math.max(LEVELS.indexOf(level), 0);
  const entries = LEVELS.map((name, rank) => [
    name,
    (/** @type {string} */ message) => {
      if (rank <= maxRank) write(`[pokedex-mcp] ${name}: ${message}\n`);
    },
  ]);
  return /** @type {Logger} */ (Object.fromEntries(entries));
}
