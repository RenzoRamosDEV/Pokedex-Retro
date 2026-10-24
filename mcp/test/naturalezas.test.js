import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapNature } from '../../site/js/mappers/nature.js';
import { API } from './support/pokeapi-falsa.js';
import { conectar, textOf } from './support/conectar.js';

const NATURALEZAS = JSON.parse(
  readFileSync(new URL('./fixtures/naturalezas.json', import.meta.url), 'utf8'),
)
  .map(mapNature)
  .sort((a, b) => a.id - b.id);
const STATS = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];

async function setup(t, options) {
  const session = await conectar(options);
  t.after(session.close);
  const call = (args) => session.client.callTool({ name: 'naturalezas', arguments: args });
  return { ...session, call };
}

test('without a filter returns the 25 natures sorted by id', async (t) => {
  const { call } = await setup(t);
  const result = await call({});
  assert.deepEqual(result.structuredContent, { naturalezas: NATURALEZAS });
  assert.equal(result.structuredContent.naturalezas.length, 25);
  assert.match(textOf(result), /^25 naturalezas\.\n\n/);
});

for (const estadistica of STATS) {
  test(`filtering by ${estadistica} matches the direct computation`, async (t) => {
    const { call } = await setup(t);
    const result = await call({ estadistica });
    const expected = NATURALEZAS.filter(
      (n) => n.increasedStat === estadistica || n.decreasedStat === estadistica,
    );
    assert.deepEqual(result.structuredContent.naturalezas, expected);
    assert.equal(expected.length, 8);
    assert.equal(
      textOf(result),
      `8 naturalezas que suben o bajan ${estadistica}.\n\n${JSON.stringify(result.structuredContent, null, 2)}`,
    );
  });
}

test('hp is not an accepted stat', async (t) => {
  const { call, calls } = await setup(t);
  const result = await call({ estadistica: 'hp' });
  assert.equal(result.isError, true);
  assert.ok(
    textOf(result).includes(
      'estadistica debe ser attack, defense, special-attack, special-defense o speed.',
    ),
    textOf(result),
  );
  assert.equal(calls.length, 0);
});

test('a failing nature detail is an outage, not a partial list', async (t) => {
  const { call, logs } = await setup(t, {
    level: 'error',
    respuestas: { [`${API}/nature/hardy`]: [{ status: 404 }] },
  });
  const result = await call({});
  assert.equal(result.isError, true);
  assert.equal(textOf(result), 'PokéAPI no responde; inténtalo en unos minutos.');
  assert.deepEqual(logs, ['[pokedex-mcp] error: tool naturalezas: lista incompleta\n']);
});

test('a failing nature list is an outage', async (t) => {
  const { call } = await setup(t, {
    respuestas: { [`${API}/nature?limit=100`]: [{ status: 404 }] },
  });
  const result = await call({ estadistica: 'speed' });
  assert.equal(textOf(result), 'PokéAPI no responde; inténtalo en unos minutos.');
});

test('info logs the tool call', async (t) => {
  const { call, logs } = await setup(t, { level: 'info' });
  await call({});
  assert.deepEqual(logs, ['[pokedex-mcp] info: tool naturalezas\n']);
});
