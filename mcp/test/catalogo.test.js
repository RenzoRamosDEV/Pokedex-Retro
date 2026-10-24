import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapPokemon } from '../../site/js/mappers/pokemon.js';
import { mapMove } from '../../site/js/mappers/move.js';
import { API } from './support/pokeapi-falsa.js';
import { conectar, textOf, withTimers } from './support/conectar.js';

const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../site/js/mappers/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );

const CAIDA = 'PokéAPI no responde; inténtalo en unos minutos.';

async function setup(t, options) {
  const session = await conectar(options);
  t.after(session.close);
  const call = (name, args) => session.client.callTool({ name, arguments: args });
  return { ...session, call };
}

describe('buscar_* pagination', () => {
  test('first page: 10 results, page 1 of 2, total 12', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'char' });
    assert.equal(result.isError, undefined);
    const { resultados, ...rest } = result.structuredContent;
    assert.equal(resultados.length, 10);
    assert.deepEqual(rest, { pagina: 1, total_paginas: 2, total: 12 });
    assert.deepEqual(
      resultados.map((r) => r.id),
      [...resultados.map((r) => r.id)].sort((a, b) => a - b),
    );
  });

  test('last page: 2 results, page 2 of 2', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'char', pagina: 2 });
    assert.equal(result.structuredContent.resultados.length, 2);
    assert.equal(result.structuredContent.pagina, 2);
    assert.equal(result.structuredContent.total_paginas, 2);
  });

  test('the text starts with the summary and contains the structured JSON', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'char' });
    assert.equal(
      textOf(result),
      `12 resultados para "char" · página 1 de 2.\n\n${JSON.stringify(result.structuredContent, null, 2)}`,
    );
  });

  test('one result uses the singular', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'pikachu' });
    assert.match(textOf(result), /^1 resultado para "pikachu" · página 1 de 1\.\n\n/);
  });

  test('the query is normalized like the web', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: ' Mr Mime ' });
    assert.deepEqual(
      result.structuredContent.resultados.map((r) => r.name),
      ['mr-mime'],
    );
    assert.match(textOf(result), /^1 resultado para "mr-mime"/);
  });

  test('no matches is not an error: empty results, 0 pages, total 0', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'zzz' });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      resultados: [],
      pagina: 1,
      total_paginas: 0,
      total: 0,
    });
    assert.match(textOf(result), /^Sin resultados para "zzz"\.\n\n/);
  });

  for (const [size, max] of [
    [1, 1],
    [50, 50],
  ]) {
    test(`tamano_pagina ${size} is valid and returns at most ${max} results`, async (t) => {
      const { call } = await setup(t);
      const result = await call('buscar_pokemon', { consulta: 'char', tamano_pagina: size });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.resultados.length, Math.min(max, 12));
    });
  }

  for (const [tool, consulta, name] of [
    ['buscar_movimientos', 'thunderbolt', 'thunderbolt'],
    ['buscar_habilidades', 'stench', 'stench'],
    ['buscar_objetos', 'master', 'master-ball'],
    ['buscar_bayas', 'cheri', 'cheri'],
  ]) {
    test(`${tool} returns results shaped by its section mapper`, async (t) => {
      const { call } = await setup(t);
      const result = await call(tool, { consulta });
      assert.equal(result.isError, undefined);
      assert.deepEqual(
        result.structuredContent.resultados.map((r) => r.name),
        [name],
      );
    });
  }
});

describe('buscar_* page out of range', () => {
  test('page 9 of 3', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'char', tamano_pagina: 5, pagina: 9 });
    assert.equal(result.isError, true);
    assert.equal(textOf(result), 'La página 9 no existe; hay 3 páginas.');
  });

  test('page 2 of 1 uses the singular', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'pikachu', pagina: 2 });
    assert.equal(result.isError, true);
    assert.equal(textOf(result), 'La página 2 no existe; hay 1 página.');
  });

  test('page 4 of 3 is out of range and page 3 of 3 is not', async (t) => {
    const { call } = await setup(t);
    const last = await call('buscar_pokemon', { consulta: 'char', tamano_pagina: 5, pagina: 3 });
    const beyond = await call('buscar_pokemon', { consulta: 'char', tamano_pagina: 5, pagina: 4 });
    assert.equal(last.structuredContent.resultados.length, 2);
    assert.equal(textOf(beyond), 'La página 4 no existe; hay 3 páginas.');
  });
});

describe('invalid input', () => {
  for (const [label, args, message] of [
    [
      'tamano_pagina 51',
      { consulta: 'char', tamano_pagina: 51 },
      'tamano_pagina debe estar entre 1 y 50.',
    ],
    [
      'tamano_pagina 0',
      { consulta: 'char', tamano_pagina: 0 },
      'tamano_pagina debe estar entre 1 y 50.',
    ],
    ['empty consulta', { consulta: '' }, 'consulta debe tener entre 1 y 50 caracteres.'],
    ['blank consulta', { consulta: '   ' }, 'consulta debe tener entre 1 y 50 caracteres.'],
    [
      'consulta of 51 characters',
      { consulta: 'a'.repeat(51) },
      'consulta debe tener entre 1 y 50 caracteres.',
    ],
    ['pagina 0', { consulta: 'char', pagina: 0 }, 'pagina debe ser un entero mayor o igual que 1.'],
    [
      'pagina 1.5',
      { consulta: 'char', pagina: 1.5 },
      'pagina debe ser un entero mayor o igual que 1.',
    ],
    [
      'pagina as text',
      { consulta: 'char', pagina: 'dos' },
      'pagina debe ser un entero mayor o igual que 1.',
    ],
  ]) {
    test(`buscar_pokemon with ${label} is an error without requests`, async (t) => {
      const { call, calls } = await setup(t);
      const result = await call('buscar_pokemon', args);
      assert.equal(result.isError, true);
      assert.ok(textOf(result).includes(message), textOf(result));
      assert.equal(calls.length, 0);
    });
  }

  test('consulta of 50 characters is valid', async (t) => {
    const { call } = await setup(t);
    const result = await call('buscar_pokemon', { consulta: 'a'.repeat(50) });
    assert.equal(result.isError, undefined);
  });

  const NOMBRE_O_ID =
    'nombre_o_id debe ser un nombre (letras, números, espacios o guiones) o un entero mayor o igual que 1.';
  for (const value of ['../item/1', 'pika?chu', '', 'a'.repeat(51), 0, 1.5]) {
    test(`obtener_pokemon with ${JSON.stringify(value)} is an error without requests`, async (t) => {
      const { call, calls } = await setup(t);
      const result = await call('obtener_pokemon', { nombre_o_id: value });
      assert.equal(result.isError, true);
      assert.ok(textOf(result).includes(NOMBRE_O_ID), textOf(result));
      assert.equal(calls.length, 0);
    });
  }
});

describe('obtener_* detail', () => {
  test('a name padded beyond 50 characters is trimmed before validating', async (t) => {
    const { call } = await setup(t);
    const result = await call('obtener_pokemon', { nombre_o_id: `${' '.repeat(45)}gengar` });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.name, 'gengar');
  });

  test('by name: requests the normalized name and returns the mapper output', async (t) => {
    const { call, calls } = await setup(t);
    const result = await call('obtener_pokemon', { nombre_o_id: 'Gengar' });
    assert.deepEqual(
      calls.map((c) => c.url),
      [`${API}/pokemon/gengar`],
    );
    assert.deepEqual(result.structuredContent, mapPokemon(fixture('pokemon')));
    assert.equal(
      textOf(result),
      `Pokémon gengar (#94).\n\n${JSON.stringify(result.structuredContent, null, 2)}`,
    );
  });

  test('by number: requests /move/85 and returns the mapped move', async (t) => {
    const { call, calls } = await setup(t);
    const result = await call('obtener_movimiento', { nombre_o_id: 85 });
    assert.deepEqual(
      calls.map((c) => c.url),
      [`${API}/move/85`],
    );
    assert.deepEqual(result.structuredContent, mapMove(fixture('move')));
    assert.match(textOf(result), /^Movimiento thunderbolt \(#85\)\.\n\n/);
  });

  for (const [tool, nombre, summary] of [
    ['obtener_habilidad', 'stench', 'Habilidad stench (#1).'],
    ['obtener_objeto', 'master ball', 'Objeto master-ball (#1).'],
    ['obtener_baya', 1, 'Baya cheri (#1).'],
  ]) {
    test(`${tool} summarizes as "${summary}"`, async (t) => {
      const { call } = await setup(t);
      const result = await call(tool, { nombre_o_id: nombre });
      assert.ok(textOf(result).startsWith(`${summary}\n\n`), textOf(result));
    });
  }
});

describe('obtener_* not found', () => {
  for (const [tool, nombre, text] of [
    [
      'obtener_pokemon',
      'xyz',
      'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
    ],
    [
      'obtener_movimiento',
      'xyz',
      'No existe el movimiento "xyz". Usa buscar_movimientos para encontrar el nombre exacto.',
    ],
    [
      'obtener_habilidad',
      'xyz',
      'No existe la habilidad "xyz". Usa buscar_habilidades para encontrar el nombre exacto.',
    ],
    [
      'obtener_objeto',
      'xyz',
      'No existe el objeto "xyz". Usa buscar_objetos para encontrar el nombre exacto.',
    ],
    [
      'obtener_baya',
      'zzz',
      'No existe la baya "zzz". Usa buscar_bayas para encontrar el nombre exacto.',
    ],
    [
      'obtener_pokemon',
      9999,
      'No existe el Pokémon "9999". Usa buscar_pokemon para encontrar el nombre exacto.',
    ],
  ]) {
    test(`${tool} ${nombre} answers 404 with the exact text`, async (t) => {
      const { call, calls } = await setup(t);
      const result = await call(tool, { nombre_o_id: nombre });
      assert.equal(result.isError, true);
      assert.equal(textOf(result), text);
      assert.equal(calls.length, 1);
    });
  }
});

describe('PokéAPI unavailable', () => {
  test('a permanent 503 on a detail is an outage after 3 attempts', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { call, calls, logs } = await setup(t, {
      respuestas: { [`${API}/pokemon/pikachu`]: [{ status: 503 }] },
    });
    const result = await withTimers(t, call('obtener_pokemon', { nombre_o_id: 'pikachu' }));
    assert.equal(result.isError, true);
    assert.equal(textOf(result), CAIDA);
    assert.equal(calls.length, 3);
    assert.ok(logs.includes('[pokedex-mcp] error: tool obtener_pokemon: HttpError 503\n'), logs);
  });

  test('a failing list is an outage for buscar_*', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { call, logs } = await setup(t, {
      respuestas: { [`${API}/berry?limit=100000`]: [{ status: 500 }] },
    });
    const result = await withTimers(t, call('buscar_bayas', { consulta: 'che' }));
    assert.equal(result.isError, true);
    assert.equal(textOf(result), CAIDA);
    assert.ok(logs.includes('[pokedex-mcp] error: tool buscar_bayas: lista no disponible\n'), logs);
  });

  test('every detail failing is an outage for buscar_*', async (t) => {
    const { call, logs } = await setup(t, {
      respuestas: { [`${API}/ability/stench`]: [{ status: 404 }] },
    });
    const result = await call('buscar_habilidades', { consulta: 'stench' });
    assert.equal(result.isError, true);
    assert.equal(textOf(result), CAIDA);
    assert.ok(
      logs.includes('[pokedex-mcp] error: tool buscar_habilidades: 1 detalles no disponibles\n'),
      logs,
    );
  });

  test('a partial failure returns the loaded results and says how many failed', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { call } = await setup(t, {
      respuestas: { [`${API}/move/thunder`]: [{ status: 500 }] },
    });
    const result = await withTimers(t, call('buscar_movimientos', { consulta: 'thunder' }));
    assert.equal(result.isError, undefined);
    assert.deepEqual(
      result.structuredContent.resultados.map((r) => r.name),
      ['thunder-punch', 'thunderbolt'],
    );
    assert.equal(result.structuredContent.total, 3);
    assert.match(
      textOf(result),
      /^3 resultados para "thunder" · página 1 de 1\. 1 no se pudo cargar\.\n\n/,
    );
  });

  test('two failures use the plural', async (t) => {
    const { call } = await setup(t, {
      respuestas: {
        [`${API}/move/thunder`]: [{ status: 404 }],
        [`${API}/move/thunderbolt`]: [{ status: 404 }],
      },
    });
    const result = await call('buscar_movimientos', { consulta: 'thunder' });
    assert.match(textOf(result), / 2 no se pudieron cargar\.\n\n/);
  });
});

test('info logs each tool call', async (t) => {
  const { call, logs } = await setup(t, { level: 'info' });
  await call('buscar_pokemon', { consulta: 'pikachu' });
  await call('obtener_baya', { nombre_o_id: 'cheri' });
  assert.deepEqual(logs, [
    '[pokedex-mcp] info: tool buscar_pokemon\n',
    '[pokedex-mcp] info: tool obtener_baya\n',
  ]);
});

test('a network outage logs the error name without a status', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { call, logs } = await setup(t, {
    level: 'error',
    respuestas: { [`${API}/item/master-ball`]: ['red'] },
  });
  const result = await withTimers(t, call('obtener_objeto', { nombre_o_id: 'master-ball' }));
  assert.equal(textOf(result), CAIDA);
  assert.deepEqual(logs, ['[pokedex-mcp] error: tool obtener_objeto: TypeError\n']);
});
