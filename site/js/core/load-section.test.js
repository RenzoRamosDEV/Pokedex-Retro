import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSection } from './load-section.js';
import { parseQuery } from './query.js';
import { SECTIONS } from './sections.js';

const API = 'https://pokeapi.co/api/v2';

function fakeFetchJson(routes) {
  const requested = [];
  const fetchJson = async (url) => {
    requested.push(url);
    const route = routes[url];
    if (route instanceof Error) throw route;
    if (route === undefined) return { ok: false, status: 404, json: null };
    const status = route.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: route.json };
  };
  return { fetchJson, requested };
}

const listOf = (names, count = names.length) => ({ json: { count, results: names.map((name) => ({ name, url: `x/${name}` })) } });
const detail = (id, name) => ({ json: { id, name } });
const idName = (json) => ({ id: json.id, name: json.name });
const section = (key) => ({ ...SECTIONS[key], mapper: idName });

describe('loadSection on a paginated section with a search query', () => {
  test('fetches the full list, then details only for matching names, sorted by id', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/pokemon?limit=100000`]: listOf(['pikachu', 'mr-mime-galar', 'mime-jr', 'mr-mime']),
      [`${API}/pokemon/mr-mime-galar`]: detail(10168, 'mr-mime-galar'),
      [`${API}/pokemon/mr-mime`]: detail(122, 'mr-mime'),
    });

    const result = await loadSection(fetchJson, section('pokedex'), parseQuery('?q=Mr%20Mime'));

    assert.deepStrictEqual(result, {
      status: 'ok',
      items: [detail(122, 'mr-mime').json, detail(10168, 'mr-mime-galar').json],
      page: 1,
      totalPages: 1,
      rawQuery: 'Mr Mime',
    });
    assert.deepEqual(requested, [
      `${API}/pokemon?limit=100000`,
      `${API}/pokemon/mr-mime-galar`,
      `${API}/pokemon/mr-mime`,
    ]);
  });

  test('requests no details and reports zero pages when nothing matches', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/berry?limit=100000`]: listOf(['cheri', 'chesto']),
    });

    const result = await loadSection(fetchJson, section('bayas'), parseQuery('?q=zzzz'));

    assert.deepStrictEqual(result, { status: 'ok', items: [], page: 1, totalPages: 0, rawQuery: 'zzzz' });
    assert.deepEqual(requested, [`${API}/berry?limit=100000`]);
  });

  test('slices the second page of filtered results', async () => {
    const names = Array.from({ length: 20 }, (_, i) => `berry-${i + 1}`);
    const routes = { [`${API}/berry?limit=100000`]: listOf(['cheri', ...names]) };
    names.forEach((name, i) => {
      routes[`${API}/berry/${name}`] = detail(i + 1, name);
    });
    const { fetchJson, requested } = fakeFetchJson(routes);

    const result = await loadSection(fetchJson, section('bayas'), parseQuery('?q=berry&page=2'));

    assert.deepEqual(result.items.map((b) => b.name), ['berry-16', 'berry-17', 'berry-18', 'berry-19', 'berry-20']);
    assert.equal(result.totalPages, 2);
    assert.equal(result.page, 2);
    assert.equal(requested.length, 6);
  });

  test('returns no items for a page beyond the last filtered page', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/berry?limit=100000`]: listOf(['cheri', 'chesto']),
    });

    const result = await loadSection(fetchJson, section('bayas'), parseQuery('?q=ch&page=2'));

    assert.deepStrictEqual(result, { status: 'ok', items: [], page: 2, totalPages: 1, rawQuery: 'ch' });
    assert.equal(requested.length, 1);
  });
});

describe('loadSection on a paginated section without a query', () => {
  test('requests the page through limit and offset and derives total pages from count', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/move?limit=16&offset=32`]: listOf(['thunderbolt', 'thunder'], 937),
      [`${API}/move/thunderbolt`]: detail(85, 'thunderbolt'),
      [`${API}/move/thunder`]: detail(87, 'thunder'),
    });

    const result = await loadSection(fetchJson, section('movimientos'), parseQuery('?page=3'));

    assert.deepStrictEqual(result, {
      status: 'ok',
      items: [detail(85, 'thunderbolt').json, detail(87, 'thunder').json],
      page: 3,
      totalPages: 59,
      rawQuery: null,
    });
    assert.equal(requested[0], `${API}/move?limit=16&offset=32`);
  });

  test('treats an invalid page as page 1', async () => {
    const { fetchJson, requested } = fakeFetchJson({ [`${API}/item?limit=12&offset=0`]: listOf([], 0) });

    await loadSection(fetchJson, section('objetos'), parseQuery('?page=abc'));

    assert.deepEqual(requested, [`${API}/item?limit=12&offset=0`]);
  });

  test('treats a blank query as no query', async () => {
    const { fetchJson, requested } = fakeFetchJson({ [`${API}/ability?limit=8&offset=8`]: listOf([], 0) });

    const result = await loadSection(fetchJson, section('habilidades'), parseQuery('?page=2&q=%20%20'));

    assert.deepEqual(requested, [`${API}/ability?limit=8&offset=8`]);
    assert.equal(result.rawQuery, null);
  });

  test('drops entries whose detail request fails or rejects and sorts the rest by id', async () => {
    const names = Array.from({ length: 18 }, (_, i) => `mon-${i + 1}`);
    const routes = { [`${API}/pokemon?limit=18&offset=0`]: listOf(names, 1300) };
    names.forEach((name, i) => {
      routes[`${API}/pokemon/${name}`] = detail(100 - i, name);
    });
    routes[`${API}/pokemon/mon-3`] = { status: 404, json: null };
    routes[`${API}/pokemon/mon-7`] = new TypeError('Failed to fetch');
    const { fetchJson } = fakeFetchJson(routes);

    const result = await loadSection(fetchJson, section('pokedex'), parseQuery(''));

    const expectedIds = names
      .map((_, i) => 100 - i)
      .filter((id) => id !== 98 && id !== 94)
      .sort((a, b) => a - b);
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.items.map((p) => p.id), expectedIds);
  });

  test('drops an entry whose detail cannot be mapped', async () => {
    const { fetchJson } = fakeFetchJson({
      [`${API}/pokemon?limit=18&offset=0`]: listOf(['bulbasaur', 'missingno'], 2),
      [`${API}/pokemon/bulbasaur`]: detail(1, 'bulbasaur'),
      [`${API}/pokemon/missingno`]: { json: { id: 0 } },
    });
    const strictMapper = (json) => ({ id: json.id, name: json.name.toUpperCase() });

    const result = await loadSection(fetchJson, { ...SECTIONS.pokedex, mapper: strictMapper }, parseQuery(''));

    assert.deepEqual(result.items, [{ id: 1, name: 'BULBASAUR' }]);
  });
});

describe('loadSection list failures', () => {
  test('returns the error state when the list request rejects', async () => {
    const { fetchJson } = fakeFetchJson({ [`${API}/item?limit=12&offset=0`]: new TypeError('Failed to fetch') });

    assert.deepStrictEqual(await loadSection(fetchJson, section('objetos'), parseQuery('')), { status: 'error' });
  });

  test('returns the error state when the list request answers 500', async () => {
    const { fetchJson, requested } = fakeFetchJson({ [`${API}/item?limit=12&offset=0`]: { status: 500, json: null } });

    assert.deepStrictEqual(await loadSection(fetchJson, section('objetos'), parseQuery('')), { status: 'error' });
    assert.equal(requested.length, 1);
  });

  test('returns the error state when the list body is malformed', async () => {
    const { fetchJson } = fakeFetchJson({ [`${API}/item?limit=12&offset=0`]: { json: { detail: 'Not found' } } });

    assert.deepStrictEqual(await loadSection(fetchJson, section('objetos'), parseQuery('')), { status: 'error' });
  });
});

describe('loadSection on an unpaginated section', () => {
  test('requests the list with limit 100 and every detail, ignoring the page', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/nature?limit=100`]: listOf(['hardy', 'adamant']),
      [`${API}/nature/hardy`]: detail(1, 'hardy'),
      [`${API}/nature/adamant`]: detail(11, 'adamant'),
    });

    const result = await loadSection(fetchJson, section('naturalezas'), parseQuery('?page=3'));

    assert.deepStrictEqual(result, {
      status: 'ok',
      items: [detail(1, 'hardy').json, detail(11, 'adamant').json],
      page: 1,
      totalPages: 1,
      rawQuery: null,
    });
    assert.deepEqual(requested, [`${API}/nature?limit=100`, `${API}/nature/hardy`, `${API}/nature/adamant`]);
  });

  test('filters by the query without paginating', async () => {
    const { fetchJson, requested } = fakeFetchJson({
      [`${API}/type?limit=100`]: listOf(['normal', 'fire', 'water']),
      [`${API}/type/fire`]: detail(10, 'fire'),
    });

    const result = await loadSection(fetchJson, section('tipos'), parseQuery('?q=Fire'));

    assert.deepEqual(result.items, [detail(10, 'fire').json]);
    assert.equal(result.rawQuery, 'Fire');
    assert.deepEqual(requested, [`${API}/type?limit=100`, `${API}/type/fire`]);
  });

  test('excludes the unknown and shadow pseudo-types', async () => {
    const { fetchJson } = fakeFetchJson({
      [`${API}/type?limit=100`]: listOf(['ghost', 'unknown', 'shadow']),
      [`${API}/type/ghost`]: detail(8, 'ghost'),
      [`${API}/type/unknown`]: detail(10001, 'unknown'),
      [`${API}/type/shadow`]: detail(10002, 'shadow'),
    });

    const result = await loadSection(fetchJson, section('tipos'), parseQuery(''));

    assert.deepEqual(result.items.map((t) => t.name), ['ghost']);
  });

  test('reports zero pages when the list is empty', async () => {
    const { fetchJson } = fakeFetchJson({ [`${API}/type?limit=100`]: listOf([]) });

    const result = await loadSection(fetchJson, section('tipos'), parseQuery(''));

    assert.deepEqual([result.items, result.totalPages], [[], 0]);
  });
});
