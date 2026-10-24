import { readFileSync } from 'node:fs';

export const API = 'https://pokeapi.co/api/v2';

const webFixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../site/js/mappers/fixtures/${name}.json`, import.meta.url),
      'utf8',
    ),
  );

const CHAR_NAMES = [
  [4, 'charmander'],
  [5, 'charmeleon'],
  [6, 'charizard'],
  [737, 'charjabug'],
  [935, 'charcadet'],
  [10034, 'charizard-mega-x'],
  [10035, 'charizard-mega-y'],
  [10196, 'charizard-gmax'],
  [2001, 'char-extra-1'],
  [2002, 'char-extra-2'],
  [2003, 'char-extra-3'],
  [2004, 'char-extra-4'],
];

function pokemonCatalog() {
  const named = new Map([...CHAR_NAMES, [25, 'pikachu'], [94, 'gengar'], [122, 'mr-mime']]);
  for (let id = 1; id <= 40; id += 1) if (!named.has(id)) named.set(id, `pokemon-${id}`);
  return [...named].sort(([a], [b]) => a - b);
}

/** Resource → { entries: [id, name][], fixture }. */
export const CATALOGO = {
  pokemon: { entries: pokemonCatalog(), fixture: webFixture('pokemon') },
  move: {
    entries: [
      [9, 'thunder-punch'],
      [33, 'tackle'],
      [85, 'thunderbolt'],
      [87, 'thunder'],
    ],
    fixture: webFixture('move'),
  },
  ability: {
    entries: [
      [1, 'stench'],
      [2, 'drizzle'],
    ],
    fixture: webFixture('ability'),
  },
  item: {
    entries: [
      [1, 'master-ball'],
      [2, 'ultra-ball'],
    ],
    fixture: webFixture('item'),
  },
  berry: {
    entries: [
      [1, 'cheri'],
      [2, 'chesto'],
      [3, 'pecha'],
    ],
    fixture: webFixture('berry'),
  },
};

const json = (status, body, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

function hang(signal) {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function serveCatalog(url) {
  const [resource, rest] = url.pathname.replace('/api/v2/', '').split('/');
  const catalog = CATALOGO[resource];
  if (!catalog) return json(404, { detail: 'Not found.' });
  if (rest === undefined) {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const results = catalog.entries
      .slice(offset, offset + limit)
      .map(([, name]) => ({ name, url: `${API}/${resource}/${name}/` }));
    return json(200, { count: catalog.entries.length, results });
  }
  const entry = catalog.entries.find(([id, name]) => name === rest || String(id) === rest);
  if (!entry) return json(404, { detail: 'Not found.' });
  return json(200, { ...catalog.fixture, id: entry[0], name: entry[1] });
}

/**
 * Fake PokéAPI over the web fixtures. `respuestas` scripts responses per URL: each step is
 * `{ status, headers?, body? }`, `'hang'` or `'red'` (network error); the last step repeats.
 * @param {{ respuestas?: Record<string, Array<object | 'hang' | 'red'>> }} [options]
 */
export function createFakePokeApi({ respuestas = {} } = {}) {
  const calls = [];
  const scripts = new Map(Object.entries(respuestas).map(([url, steps]) => [url, [...steps]]));
  async function fetch(input, init = {}) {
    const href = String(input);
    calls.push({ url: href, userAgent: new Headers(init.headers).get('User-Agent') });
    if (!href.startsWith(`${API}/`)) throw new Error(`URL ajena a PokéAPI: ${href}`);
    const steps = scripts.get(href);
    if (steps) {
      const step = steps.length > 1 ? steps.shift() : steps[0];
      if (step === 'hang') return hang(init.signal);
      if (step === 'red') throw new TypeError('fetch failed');
      return json(step.status, step.body ?? {}, step.headers);
    }
    return serveCatalog(new URL(href));
  }
  return { fetch, calls };
}
