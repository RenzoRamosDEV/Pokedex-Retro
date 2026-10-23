import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://pokeapi.co/api/v2';
const LOCAL_HOST = '127.0.0.1';
const FIXTURES = join(import.meta.dirname, '..', '..', 'site', 'js', 'mappers', 'fixtures');
const SPRITE = readFileSync(
  join(import.meta.dirname, '..', '..', 'site', 'images', 'icon-192.png'),
);
const DEFAULT_LIMIT = 20;

const TYPE_NAMES = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
  'unknown',
  'shadow',
];

const fixture = (resource) => JSON.parse(readFileSync(join(FIXTURES, `${resource}.json`), 'utf8'));

function numbered(resource, size, nameFor) {
  const base = fixture(resource);
  return Array.from({ length: size }, (_, index) => {
    const id = index + 1;
    return { id, name: nameFor(id, base.name) };
  });
}

const generic = (id, fixtureName) => `${fixtureName}-${id}`;

const CATALOG = {
  pokemon: numbered('pokemon', 40, (id) => (id === 25 ? 'pikachu' : `pokemon-${id}`)),
  move: numbered('move', 20, generic),
  item: numbered('item', 15, generic),
  berry: numbered('berry', 20, generic),
  ability: numbered('ability', 10, generic),
  nature: numbered('nature', 25, generic),
  type: TYPE_NAMES.map((name, index) => ({ id: index + 1, name })),
};

function listBody(resource, searchParams) {
  const entries = CATALOG[resource];
  const limit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
  const offset = Number(searchParams.get('offset') ?? 0);
  return {
    count: entries.length,
    next: null,
    previous: null,
    results: entries
      .slice(offset, offset + limit)
      .map(({ id, name }) => ({ name, url: `${API}/${resource}/${id}/` })),
  };
}

function detailBody(resource, name) {
  const entry = CATALOG[resource].find((candidate) => candidate.name === name);
  if (!entry) return null;
  return { ...structuredClone(fixture(resource)), id: entry.id, name: entry.name };
}

function apiResponse(url) {
  const [resource, name] = new URL(url).pathname.replace('/api/v2/', '').split('/');
  if (!(resource in CATALOG)) return { status: 404, body: { detail: 'Not found.' } };
  if (!name) return { status: 200, body: listBody(resource, new URL(url).searchParams) };
  const body = detailBody(resource, name);
  return body ? { status: 200, body } : { status: 404, body: { detail: 'Not found.' } };
}

export async function mockPokeApi(page) {
  const record = { external: [], csp: [] };
  await page.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== LOCAL_HOST,
    (route) => {
      record.external.push(route.request().url());
      return route.abort();
    },
  );
  await page.route(`${API}/**`, (route) => {
    const { status, body } = apiResponse(route.request().url());
    return route.fulfill({ status, json: body, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: SPRITE }),
  );
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) record.csp.push(message.text());
  });
  return record;
}
