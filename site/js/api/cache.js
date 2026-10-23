// @ts-check

const LIST_PREFIX = 'pokedex:lista:';
const DAY_MS = 86_400_000;

/**
 * @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} StorageLike
 */

/** @param {unknown} value */
const isObject = (value) => typeof value === 'object' && value !== null;

/**
 * A missing key parses `null`, which no caller accepts as an entry.
 * @param {StorageLike | null} storage
 * @param {string} key
 * @returns {unknown}
 */
function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    // Best effort: storage may be null, throw (QuotaExceededError, SecurityError) or hold bad JSON.
  }
}

/**
 * @param {StorageLike | null} storage
 * @param {string} key
 * @param {unknown} value
 */
function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort: a full or blocked storage leaves the cache without this entry.
  }
}

/** @param {any} entry */
const isListEntry = (entry) => isObject(entry) && Number.isFinite(entry.t) && isObject(entry.data);

/**
 * @param {{ storage: StorageLike | null, now?: () => number, ttlMs?: number }} options
 */
export function createListCache({ storage, now = Date.now, ttlMs = DAY_MS }) {
  return {
    /** @param {string} url */
    get(url) {
      const entry = /** @type {any} */ (readJson(storage, LIST_PREFIX + url));
      if (!isListEntry(entry) || now() - entry.t >= ttlMs) return undefined;
      return entry.data;
    },
    /**
     * @param {string} url
     * @param {unknown} data
     */
    set(url, data) {
      writeJson(storage, LIST_PREFIX + url, { t: now(), data });
    },
  };
}
