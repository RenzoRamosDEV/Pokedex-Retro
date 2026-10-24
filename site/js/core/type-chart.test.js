import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypeChart } from './type-chart.js';

const API = 'https://pokeapi.co/api/v2';
const LIST_URL = `${API}/type?limit=100`;
const GHOST = JSON.parse(
  readFileSync(new URL('../mappers/fixtures/type.json', import.meta.url), 'utf8'),
);
const NORMAL = { id: 1, name: 'normal', damage_relations: {} };
const LIST_NAMES = ['normal', 'ghost', 'stellar', 'unknown', 'shadow'];

/** Fake port: every url maps to a JSON body, an HTTP status or a thrown error. */
function fakePort(routes) {
  const requested = [];
  const port = async (url) => {
    requested.push(url);
    const route = routes[url];
    if (route instanceof Error) throw route;
    if (typeof route === 'number') return { ok: false, status: route, json: null };
    if (route === undefined) return { ok: false, status: 404, json: null };
    return { ok: true, status: 200, json: route };
  };
  return { port, requested };
}

const list = (names) => ({ count: names.length, results: names.map((name) => ({ name })) });

const completeRoutes = () => ({
  [LIST_URL]: list(LIST_NAMES),
  [`${API}/type/normal`]: NORMAL,
  [`${API}/type/ghost`]: GHOST,
});

describe('loadTypeChart', () => {
  test('lists the type names sorted by id without stellar, unknown or shadow', async () => {
    const { port, requested } = fakePort(completeRoutes());
    const chart = await loadTypeChart(port);
    assert.deepEqual(chart.names, ['normal', 'ghost']);
    assert.deepEqual(requested, [LIST_URL, `${API}/type/normal`, `${API}/type/ghost`]);
  });

  for (const [defensor, expected] of [
    ['psychic', 2],
    ['dark', 0.5],
    ['normal', 0],
    ['fire', 1],
  ]) {
    test(`ghost against ${defensor} multiplies by ${expected}`, async () => {
      const chart = await loadTypeChart(fakePort(completeRoutes()).port);
      assert.equal(chart.multiplier('ghost', defensor), expected);
    });
  }

  test('a type with no relations multiplies by 1', async () => {
    const chart = await loadTypeChart(fakePort(completeRoutes()).port);
    assert.equal(chart.multiplier('normal', 'ghost'), 1);
  });

  test('throws when the list is down', async () => {
    const { port } = fakePort({ ...completeRoutes(), [LIST_URL]: 500 });
    await assert.rejects(loadTypeChart(port), { message: 'tabla de tipos incompleta' });
  });

  test('throws when a single detail fails', async () => {
    const { port } = fakePort({ ...completeRoutes(), [`${API}/type/normal`]: new Error('red') });
    await assert.rejects(loadTypeChart(port), { message: 'tabla de tipos incompleta' });
  });
});
