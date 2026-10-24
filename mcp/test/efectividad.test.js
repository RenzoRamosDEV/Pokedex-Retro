import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { API } from './support/pokeapi-falsa.js';
import { conectar, textOf, withTimers } from './support/conectar.js';

const TIPOS = JSON.parse(readFileSync(new URL('./fixtures/tipos.json', import.meta.url), 'utf8'));
const DIECIOCHO = TIPOS.filter((t) => t.id <= 18).map((t) => t.name);
const MSG_DEFENSOR = 'defensor debe tener 1 o 2 tipos distintos.';
const MSG_ATACANTE = 'atacante debe ser un nombre de tipo de PokéAPI, p. ej. fire.';

/** Multiplier computed straight from the captured relations, as an independent oracle. */
function oraculo(atacante, defensor) {
  const rel = TIPOS.find((t) => t.name === atacante).damage_relations;
  const has = (key) => rel[key].some((r) => r.name === defensor);
  if (has('double_damage_to')) return 2;
  if (has('half_damage_to')) return 0.5;
  if (has('no_damage_to')) return 0;
  return 1;
}

async function setup(t, options) {
  const session = await conectar(options);
  t.after(session.close);
  const call = (args) => session.client.callTool({ name: 'efectividad_tipos', arguments: args });
  return { ...session, call };
}

describe('efectividad_tipos', () => {
  test('electric against water/flying multiplies to 4', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'electric', defensor: ['water', 'flying'] });
    assert.deepEqual(result.structuredContent, {
      atacante: 'electric',
      defensor: ['water', 'flying'],
      multiplicador: 4,
    });
    assert.equal(
      textOf(result),
      `electric contra water/flying: ×4.\n\n${JSON.stringify(result.structuredContent, null, 2)}`,
    );
  });

  for (const [atacante, defensor, expected] of [
    ['ghost', ['normal'], 0],
    ['fire', ['water'], 0.5],
    ['fire', ['water', 'rock'], 0.25],
    ['normal', ['fire'], 1],
    ['ground', ['flying', 'fire'], 0],
  ]) {
    test(`${atacante} against ${defensor.join('/')} is ×${expected}`, async (t) => {
      const { call } = await setup(t);
      const result = await call({ atacante, defensor });
      assert.equal(result.structuredContent.multiplicador, expected);
      assert.match(
        textOf(result),
        new RegExp(`^${atacante} contra ${defensor.join('/')}: ×${expected}\\.`),
      );
    });
  }

  test('without defender: the 18 multipliers in id order', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'fire' });
    const { multiplicadores } = result.structuredContent;
    assert.deepEqual(Object.keys(multiplicadores), DIECIOCHO);
    assert.deepEqual(
      [multiplicadores.grass, multiplicadores.water, multiplicadores.normal],
      [2, 0.5, 1],
    );
    for (const defensor of DIECIOCHO) {
      assert.equal(multiplicadores[defensor], oraculo('fire', defensor), defensor);
    }
    assert.equal(result.structuredContent.defensor, undefined);
    assert.match(textOf(result), /^Multiplicadores de fire contra los 18 tipos\.\n\n/);
  });

  test('the attacker is trimmed and lower-cased', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: ' Electric ', defensor: [' WATER '] });
    assert.deepEqual(result.structuredContent, {
      atacante: 'electric',
      defensor: ['water'],
      multiplicador: 2,
    });
  });

  test('never requests stellar, unknown or shadow details', async (t) => {
    const { call, calls } = await setup(t);
    await call({ atacante: 'fire' });
    const details = calls.map((c) => c.url).filter((url) => !url.includes('?'));
    assert.equal(details.length, 18);
    assert.ok(!details.some((url) => /stellar|unknown|shadow/.test(url)), details.join('\n'));
  });

  for (const [label, defensor] of [
    ['repeated', ['grass', 'grass']],
    ['empty', []],
    ['with 3 types', ['grass', 'water', 'fire']],
  ]) {
    test(`a ${label} defender is a field error without requests`, async (t) => {
      const { call, calls } = await setup(t);
      const result = await call({ atacante: 'fire', defensor });
      assert.equal(result.isError, true);
      assert.ok(textOf(result).includes(MSG_DEFENSOR), textOf(result));
      assert.equal(calls.length, 0);
    });
  }

  for (const atacante of ['', 'a'.repeat(21)]) {
    test(`attacker ${JSON.stringify(atacante)} is a field error`, async (t) => {
      const { call } = await setup(t);
      const result = await call({ atacante });
      assert.equal(result.isError, true);
      assert.ok(textOf(result).includes(MSG_ATACANTE), textOf(result));
    });
  }

  test('an attacker of 20 characters passes validation and is unknown', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'a'.repeat(20) });
    assert.ok(textOf(result).startsWith(`El tipo "${'a'.repeat(20)}" no existe.`));
  });
});

describe('unknown type', () => {
  test('stellar has no damage table', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'stellar' });
    assert.equal(result.isError, true);
    assert.ok(textOf(result).startsWith('El tipo "stellar" no existe.'));
  });

  test('a Spanish name lists the 18 valid types in id order', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'fuego' });
    assert.equal(result.isError, true);
    assert.equal(
      textOf(result),
      `El tipo "fuego" no existe. Tipos válidos: ${DIECIOCHO.join(', ')}.`,
    );
    assert.ok(
      textOf(result).startsWith(
        'El tipo "fuego" no existe. Tipos válidos: normal, fighting, flying,',
      ),
    );
  });

  test('an unknown defender is named in the error', async (t) => {
    const { call } = await setup(t);
    const result = await call({ atacante: 'fire', defensor: ['grass', 'shadow'] });
    assert.ok(textOf(result).startsWith('El tipo "shadow" no existe.'));
  });
});

describe('PokéAPI unavailable', () => {
  test('a type detail failing permanently is an outage', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { call, logs } = await setup(t, {
      level: 'error',
      respuestas: { [`${API}/type/water`]: [{ status: 500 }] },
    });
    const result = await withTimers(t, call({ atacante: 'electric', defensor: ['water'] }));
    assert.equal(result.isError, true);
    assert.equal(textOf(result), 'PokéAPI no responde; inténtalo en unos minutos.');
    assert.deepEqual(logs, [
      '[pokedex-mcp] error: tool efectividad_tipos: tabla de tipos incompleta\n',
    ]);
  });

  test('a failing type list is an outage', async (t) => {
    const { call, logs } = await setup(t, {
      level: 'error',
      respuestas: { [`${API}/type?limit=100`]: [{ status: 404 }] },
    });
    const result = await call({ atacante: 'fire' });
    assert.equal(textOf(result), 'PokéAPI no responde; inténtalo en unos minutos.');
    assert.deepEqual(logs, [
      '[pokedex-mcp] error: tool efectividad_tipos: tabla de tipos incompleta\n',
    ]);
  });
});

test('info logs the tool call', async (t) => {
  const { call, logs } = await setup(t, { level: 'info' });
  await call({ atacante: 'fire' });
  assert.deepEqual(logs, ['[pokedex-mcp] info: tool efectividad_tipos\n']);
});
