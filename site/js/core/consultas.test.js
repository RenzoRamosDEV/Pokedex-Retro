import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATALOGO,
  DESCRIPCIONES,
  DESCRIPCIONES_CAMPO,
  ESTADISTICAS,
  buscar,
  efectividad,
  naturalezas,
  obtener,
  resumenBusqueda,
} from './consultas.js';
import { MENSAJES } from './mensajes.js';
import { API, crearPuertoPokeApi } from '../../../tests/support/puerto-pokeapi.js';

const fixture = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const GOLDEN = fixture('../../../mcp/test/fixtures/tools-list.golden.json');
const TIPOS = fixture('../../../mcp/test/fixtures/tipos.json')
  .filter((tipo) => tipo.id <= 18)
  .map((tipo) => tipo.name);
const POKEDEX = CATALOGO.find((fila) => fila.clave === 'pokedex');
const fallo = (status) => [{ status }];

describe('tool descriptions', () => {
  test('describe the 12 MCP tools in tools/list order with the golden texts', () => {
    assert.deepEqual(
      Object.entries(DESCRIPCIONES),
      GOLDEN.map((tool) => [tool.name, tool.description]),
    );
  });

  test('describe every input field with the golden texts', () => {
    const golden = Object.fromEntries(
      GOLDEN.flatMap((tool) =>
        Object.entries(tool.inputSchema.properties).map(([campo, schema]) => [
          campo,
          schema.description,
        ]),
      ),
    );
    assert.deepEqual(DESCRIPCIONES_CAMPO, golden);
  });

  test('list the five stats a nature can raise or lower', () => {
    assert.deepEqual(ESTADISTICAS, [
      'attack',
      'defense',
      'special-attack',
      'special-defense',
      'speed',
    ]);
  });

  test('map each catalog row to its search and detail tools', () => {
    assert.deepEqual(
      CATALOGO.map((fila) => [fila.clave, fila.buscar, fila.obtener, fila.recurso]),
      [
        ['pokedex', 'buscar_pokemon', 'obtener_pokemon', 'el Pokémon'],
        ['movimientos', 'buscar_movimientos', 'obtener_movimiento', 'el movimiento'],
        ['habilidades', 'buscar_habilidades', 'obtener_habilidad', 'la habilidad'],
        ['objetos', 'buscar_objetos', 'obtener_objeto', 'el objeto'],
        ['bayas', 'buscar_bayas', 'obtener_baya', 'la baya'],
      ],
    );
  });
});

describe('resumenBusqueda', () => {
  const base = { page: 1, totalPages: 1, failedCount: 0 };
  for (const [result, expected] of [
    [{ ...base, total: 0 }, 'Sin resultados para "zz".'],
    [{ ...base, total: 1 }, '1 resultado para "zz" · página 1 de 1.'],
    [{ ...base, total: 2, page: 2, totalPages: 3 }, '2 resultados para "zz" · página 2 de 3.'],
    [
      { ...base, total: 2, failedCount: 1 },
      '2 resultados para "zz" · página 1 de 1. 1 no se pudo cargar.',
    ],
    [
      { ...base, total: 2, failedCount: 2 },
      '2 resultados para "zz" · página 1 de 1. 2 no se pudieron cargar.',
    ],
  ]) {
    test(`summarises ${JSON.stringify(result)}`, () => {
      assert.equal(resumenBusqueda('zz', result), expected);
    });
  }
});

describe('buscar', () => {
  const entrada = (consulta, extra = {}) => ({ consulta, pagina: 1, tamano_pagina: 10, ...extra });
  const LISTA = `${API}/pokemon?limit=100000`;

  test('returns the page of full results sorted by number', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await buscar(port, POKEDEX, entrada('char'));
    assert.equal(salida.resumen, '12 resultados para "char" · página 1 de 2.');
    assert.deepEqual(
      salida.datos.resultados.map((p) => p.name),
      [
        'charmander',
        'charmeleon',
        'charizard',
        'charjabug',
        'charcadet',
        'char-extra-1',
        'char-extra-2',
        'char-extra-3',
        'char-extra-4',
        'charizard-mega-x',
      ],
    );
    assert.deepEqual(
      { ...salida.datos, resultados: salida.datos.resultados.length },
      { resultados: 10, pagina: 1, total_paginas: 2, total: 12 },
    );
  });

  test('respects tamano_pagina', async () => {
    const { port } = crearPuertoPokeApi();
    const { datos } = await buscar(port, POKEDEX, entrada('char', { tamano_pagina: 5 }));
    assert.equal(datos.resultados.length, 5);
    assert.equal(datos.total_paginas, 3);
  });

  test('accepts the last page', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await buscar(port, POKEDEX, entrada('char', { pagina: 2 }));
    assert.equal(salida.resumen, '12 resultados para "char" · página 2 de 2.');
    assert.equal(salida.datos.resultados.length, 2);
  });

  test('rejects the page after the last one', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await buscar(port, POKEDEX, entrada('char', { pagina: 3 }));
    assert.deepEqual(salida, { error: 'La página 3 no existe; hay 2 páginas.' });
  });

  test('accepts page 1 without results', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await buscar(port, POKEDEX, entrada('zzz'));
    assert.deepEqual(salida, {
      resumen: 'Sin resultados para "zzz".',
      datos: { resultados: [], pagina: 1, total_paginas: 0, total: 0 },
    });
  });

  test('normalises a query with spaces', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await buscar(port, POKEDEX, entrada('Mr Mime'));
    assert.equal(salida.resumen, '1 resultado para "mr-mime" · página 1 de 1.');
    assert.deepEqual(
      salida.datos.resultados.map((p) => p.name),
      ['mr-mime'],
    );
  });

  test('reports the outage and logs it when the list is down', async () => {
    const { port } = crearPuertoPokeApi({ respuestas: { [LISTA]: fallo(500) } });
    const salida = await buscar(port, POKEDEX, entrada('char'));
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: 'lista no disponible' });
  });

  test('reports the outage when every detail fails', async () => {
    const { port } = crearPuertoPokeApi({
      respuestas: { [`${API}/pokemon/pikachu`]: fallo(500) },
    });
    const salida = await buscar(port, POKEDEX, entrada('pika'));
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: '1 detalles no disponibles' });
  });

  test('counts partial failures in the summary', async () => {
    const { port } = crearPuertoPokeApi({
      respuestas: { [`${API}/pokemon/charmander`]: fallo(500) },
    });
    const salida = await buscar(port, POKEDEX, entrada('char'));
    assert.equal(salida.resumen, '12 resultados para "char" · página 1 de 2. 1 no se pudo cargar.');
    assert.equal(salida.datos.resultados.length, 9);
  });
});

describe('obtener', () => {
  test('finds a Pokémon by normalised name', async () => {
    const { port, calls } = crearPuertoPokeApi();
    const salida = await obtener(port, POKEDEX, { nombre_o_id: 'Mr Mime' });
    assert.equal(salida.resumen, 'Pokémon mr-mime (#122).');
    assert.equal(salida.datos.name, 'mr-mime');
    assert.deepEqual(
      calls.map((c) => c.url),
      [`${API}/pokemon/mr-mime`],
    );
  });

  test('finds a Pokémon by number', async () => {
    const { port, calls } = crearPuertoPokeApi();
    const salida = await obtener(port, POKEDEX, { nombre_o_id: 25 });
    assert.equal(salida.resumen, 'Pokémon pikachu (#25).');
    assert.deepEqual(
      calls.map((c) => c.url),
      [`${API}/pokemon/25`],
    );
  });

  test('uses the label of each catalog row', async () => {
    const { port } = crearPuertoPokeApi();
    const bayas = CATALOGO.find((fila) => fila.clave === 'bayas');
    const salida = await obtener(port, bayas, { nombre_o_id: 'cheri' });
    assert.equal(salida.resumen, 'Baya cheri (#1).');
  });

  test('answers a missing resource without logging', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await obtener(port, POKEDEX, { nombre_o_id: 'xyz' });
    assert.deepEqual(salida, {
      error: 'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
    });
  });

  test('reports the outage and logs the status on a server error', async () => {
    const { port } = crearPuertoPokeApi({
      respuestas: { [`${API}/pokemon/pikachu`]: fallo(500) },
    });
    const salida = await obtener(port, POKEDEX, { nombre_o_id: 'pikachu' });
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: 'HttpError 500' });
  });

  test('logs only the error name when it has no status', async () => {
    const { port } = crearPuertoPokeApi({ respuestas: { [`${API}/pokemon/pikachu`]: ['red'] } });
    const salida = await obtener(port, POKEDEX, { nombre_o_id: 'pikachu' });
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: 'TypeError' });
  });
});

describe('efectividad', () => {
  test('rejects an unknown attacker with the valid types', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await efectividad(port, { atacante: 'lava' });
    assert.deepEqual(salida, { error: MENSAJES.tipoDesconocido('lava', TIPOS) });
  });

  test('rejects an unknown defender with the valid types', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await efectividad(port, { atacante: 'fire', defensor: ['water', 'lava'] });
    assert.deepEqual(salida, { error: MENSAJES.tipoDesconocido('lava', TIPOS) });
  });

  test('multiplies against one defender', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await efectividad(port, { atacante: 'fire', defensor: ['grass'] });
    assert.deepEqual(salida, {
      resumen: 'fire contra grass: ×2.',
      datos: { atacante: 'fire', defensor: ['grass'], multiplicador: 2 },
    });
  });

  for (const [atacante, defensor, multiplicador] of [
    ['electric', ['water', 'flying'], 4],
    ['ground', ['flying', 'fire'], 0],
    ['fire', ['water', 'rock'], 0.25],
  ]) {
    test(`${atacante} against ${defensor.join('/')} is ×${multiplicador}`, async () => {
      const { port } = crearPuertoPokeApi();
      const salida = await efectividad(port, { atacante, defensor });
      assert.deepEqual(salida, {
        resumen: `${atacante} contra ${defensor.join('/')}: ×${multiplicador}.`,
        datos: { atacante, defensor, multiplicador },
      });
    });
  }

  test('without defender lists the 18 multipliers', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await efectividad(port, { atacante: 'electric' });
    assert.equal(salida.resumen, 'Multiplicadores de electric contra los 18 tipos.');
    assert.deepEqual(Object.keys(salida.datos), ['atacante', 'multiplicadores']);
    assert.deepEqual(Object.keys(salida.datos.multiplicadores), TIPOS);
    assert.equal(salida.datos.multiplicadores.water, 2);
    assert.equal(salida.datos.multiplicadores.ground, 0);
    assert.equal(salida.datos.multiplicadores.grass, 0.5);
    assert.equal(salida.datos.multiplicadores.normal, 1);
  });

  test('reports the outage when the table is down', async () => {
    const { port } = crearPuertoPokeApi({ respuestas: { [`${API}/type?limit=100`]: fallo(500) } });
    const salida = await efectividad(port, { atacante: 'fire' });
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: 'tabla de tipos incompleta' });
  });
});

describe('naturalezas', () => {
  test('lists every nature sorted by number', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await naturalezas(port, {});
    assert.equal(salida.resumen, '25 naturalezas.');
    assert.equal(salida.datos.naturalezas.length, 25);
    assert.equal(salida.datos.naturalezas[0].name, 'hardy');
  });

  test('filters by the stat they raise or lower', async () => {
    const { port } = crearPuertoPokeApi();
    const salida = await naturalezas(port, { estadistica: 'attack' });
    assert.equal(salida.resumen, '8 naturalezas que suben o bajan attack.');
    assert.deepEqual(
      salida.datos.naturalezas.map((n) => n.name),
      ['bold', 'modest', 'calm', 'timid', 'lonely', 'adamant', 'naughty', 'brave'],
    );
  });

  test('reports the outage when the list is incomplete', async () => {
    const { port } = crearPuertoPokeApi({ respuestas: { [`${API}/nature/bold`]: fallo(500) } });
    const salida = await naturalezas(port, {});
    assert.deepEqual(salida, { error: MENSAJES.caida, registro: 'lista incompleta' });
  });
});
