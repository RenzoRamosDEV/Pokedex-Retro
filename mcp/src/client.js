// @ts-check
import { isAbsolute, join } from 'node:path';
import { createFetchJson } from '../../site/js/api/client.js';
import { createListCache } from '../../site/js/api/cache.js';
import { createLimit } from '../../site/js/core/limit.js';
import { createDiskStorage } from './disk-storage.js';

const MAX_CONCURRENT_REQUESTS = 4;
const REPOSITORY_URL = 'https://github.com/RenzoRamosDEV/Pokedex-Retro';

/**
 * @typedef {(url: string) => Promise<{ ok: boolean, status: number, json: any }>} PokeApiPort
 * @typedef {import('../../site/js/api/client.js').ResponseLike} ResponseLike
 * @typedef {(url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<ResponseLike>} HttpFetch
 */

/** @returns {import('../../site/js/api/cache.js').StorageLike} */
function createMapStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
}

/**
 * XDG ignores relative paths, so only an absolute `XDG_CACHE_HOME` is honoured.
 * @param {Record<string, string | undefined>} env
 * @param {string} homedir
 */
function cacheDir(env, homedir) {
  const base =
    env.XDG_CACHE_HOME && isAbsolute(env.XDG_CACHE_HOME)
      ? env.XDG_CACHE_HOME
      : join(homedir, '.cache');
  return join(base, 'pokedex-mcp');
}

/**
 * Memory first, then disk; a disk hit is not promoted so its TTL keeps counting from the fetch.
 * @param {Array<ReturnType<typeof createListCache>>} caches
 * @param {import('./log.js').Logger} log
 */
function createTieredCache(caches, log) {
  return {
    /** @param {string} url */
    get(url) {
      for (const cache of caches) {
        const data = cache.get(url);
        if (data !== undefined) {
          log.debug(`caché ${url}`);
          return data;
        }
      }
      return undefined;
    },
    /**
     * @param {string} url
     * @param {unknown} data
     */
    set(url, data) {
      for (const cache of caches) cache.set(url, data);
    },
  };
}

/**
 * @param {{
 *   fetch: HttpFetch,
 *   env: Record<string, string | undefined>,
 *   homedir: string,
 *   now?: () => number,
 *   log: import('./log.js').Logger,
 *   version: string,
 * }} options
 * @returns {{ port: PokeApiPort }}
 */
export function createPokeApiClient({ fetch, env, homedir, now = Date.now, log, version }) {
  const userAgent = `pokedex-retro-mcp/${version} (+${REPOSITORY_URL})`;
  const caches = [createListCache({ storage: createMapStorage(), now, prefix: '' })];
  if (env.POKEDEX_MCP_DISK_CACHE === '1') {
    const storage = createDiskStorage({ dir: cacheDir(env, homedir), log });
    caches.push(createListCache({ storage, now, prefix: '' }));
  }
  const fetchJson = createFetchJson({
    fetch: (url, init) => {
      log.debug(`GET ${url}`);
      return fetch(url, { ...init, headers: { 'User-Agent': userAgent } });
    },
    cache: createTieredCache(caches, log),
    now,
  });
  const limit = createLimit(MAX_CONCURRENT_REQUESTS);
  return {
    port: (url) => limit(() => fetchJson(url)).then((json) => ({ ok: true, status: 200, json })),
  };
}
