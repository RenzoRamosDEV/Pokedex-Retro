import { createFetchJson } from '../../site/js/api/client.js';
import { API, createFakePokeApi } from '../../mcp/test/support/pokeapi-falsa.js';

export { API };

/**
 * PokéAPI port over the MCP fake PokéAPI, wired like the MCP and the web: HTTP errors are thrown
 * with their status. No retries, so scripted failures resolve at once.
 * @param {{ respuestas?: Record<string, Array<object | 'hang' | 'red'>> }} [options]
 */
export function crearPuertoPokeApi(options) {
  const pokeApi = createFakePokeApi(options);
  const fetchJson = createFetchJson({ fetch: pokeApi.fetch, retries: 0 });
  return {
    port: (url) => fetchJson(url).then((json) => ({ ok: true, status: 200, json })),
    calls: pokeApi.calls,
  };
}
