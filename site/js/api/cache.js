// @ts-check
import { FULL_LIST_LIMIT } from '../core/load-section.js';

const LIST_PREFIX = 'pokedex:lista:';
const DETAIL_PREFIX = 'pokedex:detalle:';
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

/**
 * @param {{ storage: StorageLike | null }} options
 */
export function createDetailCache({ storage }) {
  /** @type {Map<string, unknown>} */
  const memory = new Map();
  return {
    /** @param {string} url */
    get(url) {
      if (memory.has(url)) return memory.get(url);
      const data = readJson(storage, DETAIL_PREFIX + url);
      if (!isObject(data)) return undefined;
      memory.set(url, data);
      return data;
    },
    /**
     * @param {string} url
     * @param {unknown} data
     */
    set(url, data) {
      memory.set(url, data);
      writeJson(storage, DETAIL_PREFIX + url, data);
    },
  };
}

/** @param {string} url */
const isFullList = (url) => new URL(url).searchParams.get('limit') === String(FULL_LIST_LIMIT);

/**
 * @param {{ local: StorageLike | null, session: StorageLike | null, now?: () => number }} options
 */
export function createApiCache({ local, session, now = Date.now }) {
  const lists = createListCache({ storage: local, now });
  const details = createDetailCache({ storage: session });
  /** @param {string} url */
  const cacheFor = (url) => (isFullList(url) ? lists : details);
  return {
    /** @param {string} url */
    get: (url) => cacheFor(url).get(url),
    /**
     * @param {string} url
     * @param {unknown} data
     */
    set: (url, data) => cacheFor(url).set(url, data),
  };
}
