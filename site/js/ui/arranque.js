import { createFetchJson } from '../api/client.js';
import { createApiCache } from '../api/cache.js';
import { createLimit } from '../core/limit.js';
import { initTheme } from './theme.js';
import { connectDisclosures } from './disclosure.js';
import { VERSION } from '../version.js';

const MAX_POKEAPI_REQUESTS = 6;

/** Storage access throws in some privacy modes; callers treat `null` as "no storage". */
export function storageOrNull(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

/** Version, theme and header dropdowns shared by every page. */
export function startPage() {
  document.querySelector('[data-version]').textContent = VERSION;
  initTheme(
    document,
    storageOrNull('localStorage'),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  connectDisclosures(document, [
    { button: 'theme-btn', panel: 'theme-dropdown' },
    { button: 'info-btn', panel: 'info-dropdown' },
    { button: 'nav-btn', panel: 'nav-menu' },
  ]);
}

/**
 * Cached PokéAPI port with at most 6 requests in flight across every caller.
 * @returns {(signal?: AbortSignal) => (url: string) => Promise<{ ok: true, status: 200, json: any }>}
 */
export function createPokeApiPort() {
  const fetchJson = createFetchJson({
    cache: createApiCache({
      local: storageOrNull('localStorage'),
      session: storageOrNull('sessionStorage'),
    }),
  });
  const limit = createLimit(MAX_POKEAPI_REQUESTS);
  return (signal) => (url) =>
    limit(() => fetchJson(url, { signal })).then((json) => ({ ok: true, status: 200, json }));
}
