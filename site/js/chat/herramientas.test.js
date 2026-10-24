import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFINICIONES,
  ENTRADA_NO_JSON,
  ejecutarHerramienta,
  validarEntrada,
} from './herramientas.js';
import { MENSAJES, MENSAJES_ENTRADA } from '../core/mensajes.js';
import { CATALOGO, efectividad, obtener } from '../core/consultas.js';
import { okResult } from '../../../mcp/src/results.js';
import { API, crearPuertoPokeApi } from '../../../tests/support/puerto-pokeapi.js';

const fixture = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const GOLDEN = fixture('../../../mcp/test/fixtures/tools-list.golden.json');
const POKEMON = fixture('../mappers/fixtures/pokemon.json');
const GYARADOS = {
  [`${API}/pokemon/gyarados`]: [{ status: 200, body: { ...POKEMON, id: 130, name: 'gyarados' } }],
};
const PROHIBIDAS = [
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
  'default',
  'minItems',
  'maxItems',
];

/** Every key used anywhere inside a JSON value. */
const clavesDe = (valor) =>
  valor && typeof valor === 'object'
    ? Object.entries(valor).flatMap(([clave, hijo]) => [clave, ...clavesDe(hijo)])
    : [];

describe('DEFINICIONES', () => {
  test('declare the 12 MCP tools in tools/list order with their descriptions', () => {
    assert.deepEqual(
      DEFINICIONES.map((d) => [d.name, d.description]),
      GOLDEN.map((t) => [t.name, t.description]),
    );
  });

  test('keep the field names, descriptions and required fields of the MCP', () => {
    for (const [i, definicion] of DEFINICIONES.entries()) {
      const golden = GOLDEN[i].inputSchema;
      assert.deepEqual(
        Object.entries(definicion.input_schema.properties).map(([c, s]) => [c, s.description]),
        Object.entries(golden.properties).map(([c, s]) => [c, s.description]),
        definicion.name,
      );
      assert.deepEqual(definicion.input_schema.required, golden.required ?? [], definicion.name);
    }
  });

  test('are strict, stream their input eagerly and close their objects', () => {
    for (const definicion of DEFINICIONES) {
      assert.equal(definicion.strict, true);
      assert.equal(definicion.eager_input_streaming, true);
      assert.equal(definicion.input_schema.type, 'object');
      assert.equal(definicion.input_schema.additionalProperties, false);
    }
  });

  test('use no constraint the strict mode rejects', () => {
    const usadas = new Set(clavesDe(DEFINICIONES.map((d) => d.input_schema)));
    assert.deepEqual(
      PROHIBIDAS.filter((clave) => usadas.has(clave)),
      [],
    );
  });

  test('type every field', () => {
    const tipos = Object.fromEntries(
      DEFINICIONES.flatMap((d) => Object.entries(d.input_schema.properties)).map(([campo, s]) => [
        campo,
        { ...s, description: undefined },
      ]),
    );
    assert.deepEqual(JSON.parse(JSON.stringify(tipos)), {
      consulta: { type: 'string' },
      pagina: { type: 'integer' },
      tamano_pagina: { type: 'integer' },
      nombre_o_id: { anyOf: [{ type: 'string' }, { type: 'integer' }] },
      atacante: { type: 'string' },
      defensor: { type: 'array', items: { type: 'string' } },
      estadistica: {
        type: 'string',
        enum: ['attack', 'defense', 'special-attack', 'special-defense', 'speed'],
      },
    });
  });
});

describe('validarEntrada', () => {
  const ok = (valor) => ({ ok: true, valor });
  const falla = (campo) => ({ ok: false, mensaje: MENSAJES_ENTRADA[campo] });
  const x = (n) => 'x'.repeat(n);

  for (const [nombre, entrada, esperado] of [
    [
      'buscar_pokemon',
      { consulta: 'char' },
      ok({ consulta: 'char', pagina: 1, tamano_pagina: 10 }),
    ],
    ['buscar_pokemon', { consulta: '' }, falla('consulta')],
    ['buscar_pokemon', { consulta: '   ' }, falla('consulta')],
    ['buscar_pokemon', { consulta: 'a' }, ok({ consulta: 'a', pagina: 1, tamano_pagina: 10 })],
    [
      'buscar_pokemon',
      { consulta: ` ${x(50)} ` },
      ok({ consulta: x(50), pagina: 1, tamano_pagina: 10 }),
    ],
    ['buscar_pokemon', { consulta: x(51) }, falla('consulta')],
    ['buscar_pokemon', {}, falla('consulta')],
    ['buscar_pokemon', { consulta: 3 }, falla('consulta')],
    ['buscar_pokemon', { consulta: 'a', pagina: 0 }, falla('pagina')],
    [
      'buscar_pokemon',
      { consulta: 'a', pagina: 1 },
      ok({ consulta: 'a', pagina: 1, tamano_pagina: 10 }),
    ],
    ['buscar_pokemon', { consulta: 'a', pagina: 1.5 }, falla('pagina')],
    ['buscar_pokemon', { consulta: 'a', pagina: '2' }, falla('pagina')],
    ['buscar_pokemon', { consulta: 'a', tamano_pagina: 0 }, falla('tamano_pagina')],
    [
      'buscar_pokemon',
      { consulta: 'a', tamano_pagina: 1 },
      ok({ consulta: 'a', pagina: 1, tamano_pagina: 1 }),
    ],
    [
      'buscar_pokemon',
      { consulta: 'a', tamano_pagina: 50 },
      ok({ consulta: 'a', pagina: 1, tamano_pagina: 50 }),
    ],
    ['buscar_pokemon', { consulta: 'a', tamano_pagina: 51 }, falla('tamano_pagina')],
    ['buscar_pokemon', { consulta: 'a', tamano_pagina: 2.5 }, falla('tamano_pagina')],
    ['buscar_pokemon', { consulta: 'a', tamano_pagina: '5' }, falla('tamano_pagina')],
    [
      'buscar_bayas',
      { consulta: 'a', pagina: 2, extra: true },
      ok({ consulta: 'a', pagina: 2, tamano_pagina: 10 }),
    ],
    ['obtener_pokemon', { nombre_o_id: 'pikachu' }, ok({ nombre_o_id: 'pikachu' })],
    ['obtener_pokemon', { nombre_o_id: ' Mr Mime ' }, ok({ nombre_o_id: 'Mr Mime' })],
    ['obtener_pokemon', { nombre_o_id: 'mr-mime' }, ok({ nombre_o_id: 'mr-mime' })],
    ['obtener_pokemon', { nombre_o_id: 'a/b' }, falla('nombre_o_id')],
    ['obtener_pokemon', { nombre_o_id: '' }, falla('nombre_o_id')],
    ['obtener_pokemon', { nombre_o_id: x(50) }, ok({ nombre_o_id: x(50) })],
    ['obtener_pokemon', { nombre_o_id: x(51) }, falla('nombre_o_id')],
    ['obtener_pokemon', { nombre_o_id: 0 }, falla('nombre_o_id')],
    ['obtener_pokemon', { nombre_o_id: 1 }, ok({ nombre_o_id: 1 })],
    ['obtener_pokemon', { nombre_o_id: 1.5 }, falla('nombre_o_id')],
    ['obtener_pokemon', { nombre_o_id: true }, falla('nombre_o_id')],
    ['obtener_objeto', {}, falla('nombre_o_id')],
    ['efectividad_tipos', { atacante: ' Electric ' }, ok({ atacante: 'electric' })],
    ['efectividad_tipos', { atacante: '' }, falla('atacante')],
    ['efectividad_tipos', { atacante: x(20) }, ok({ atacante: x(20) })],
    ['efectividad_tipos', { atacante: x(21) }, falla('atacante')],
    ['efectividad_tipos', { defensor: ['water'] }, falla('atacante')],
    ['efectividad_tipos', { atacante: 'fire', defensor: [] }, falla('defensor')],
    [
      'efectividad_tipos',
      { atacante: 'fire', defensor: ['Water'] },
      ok({ atacante: 'fire', defensor: ['water'] }),
    ],
    [
      'efectividad_tipos',
      { atacante: 'fire', defensor: ['water', 'rock'] },
      ok({ atacante: 'fire', defensor: ['water', 'rock'] }),
    ],
    [
      'efectividad_tipos',
      { atacante: 'fire', defensor: ['water', 'rock', 'ice'] },
      falla('defensor'),
    ],
    ['efectividad_tipos', { atacante: 'fire', defensor: ['Water', 'water'] }, falla('defensor')],
    ['efectividad_tipos', { atacante: 'fire', defensor: [' '] }, falla('defensor')],
    ['efectividad_tipos', { atacante: 'fire', defensor: [x(21)] }, falla('defensor')],
    ['efectividad_tipos', { atacante: 'fire', defensor: [3] }, falla('defensor')],
    ['efectividad_tipos', { atacante: 'fire', defensor: 'water' }, falla('defensor')],
    ['naturalezas', {}, ok({})],
    ['naturalezas', { estadistica: 'speed' }, ok({ estadistica: 'speed' })],
    ['naturalezas', { estadistica: 'hp' }, falla('estadistica')],
    ['naturalezas', { estadistica: 'Speed' }, falla('estadistica')],
    ['naturalezas', null, ok({})],
  ]) {
    test(`${nombre} ${JSON.stringify(entrada)}`, () => {
      assert.deepEqual(validarEntrada(nombre, entrada), esperado);
    });
  }
});

describe('ejecutarHerramienta', () => {
  test('answers a success with the summary and the indented data', async () => {
    const { port } = crearPuertoPokeApi();
    const resultado = await ejecutarHerramienta(port, 'naturalezas', { estadistica: 'speed' });
    assert.equal(resultado.esError, false);
    assert.match(
      resultado.contenido,
      /^8 naturalezas que suben o bajan speed\.\n\n\{\n {2}"naturalezas": \[/,
    );
  });

  test('answers a failed operation as an error', async () => {
    const { port } = crearPuertoPokeApi();
    assert.deepEqual(await ejecutarHerramienta(port, 'obtener_pokemon', { nombre_o_id: 'xyz' }), {
      contenido: 'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
      esError: true,
    });
  });

  test('answers an invalid input without calling PokéAPI', async () => {
    const { port, calls } = crearPuertoPokeApi();
    const resultado = await ejecutarHerramienta(port, 'buscar_pokemon', {
      consulta: 'char',
      tamano_pagina: 51,
    });
    assert.deepEqual(resultado, {
      contenido: 'tamano_pagina debe estar entre 1 y 50.',
      esError: true,
    });
    assert.deepEqual(calls, []);
  });

  test('answers an unknown tool without calling PokéAPI', async () => {
    const { port, calls } = crearPuertoPokeApi();
    assert.deepEqual(await ejecutarHerramienta(port, 'borrar_todo', {}), {
      contenido: 'Herramienta desconocida: borrar_todo.',
      esError: true,
    });
    assert.deepEqual(calls, []);
  });

  test('answers an input that was not valid JSON without calling PokéAPI', async () => {
    const { port, calls } = crearPuertoPokeApi();
    assert.deepEqual(await ejecutarHerramienta(port, 'naturalezas', ENTRADA_NO_JSON), {
      contenido: 'La entrada de la herramienta no es JSON válido.',
      esError: true,
    });
    assert.deepEqual(calls, []);
  });

  test('runs efectividad_tipos with the normalised input', async () => {
    const { port } = crearPuertoPokeApi();
    const resultado = await ejecutarHerramienta(port, 'efectividad_tipos', {
      atacante: ' Electric ',
    });
    assert.match(resultado.contenido, /^Multiplicadores de electric contra los 18 tipos\./);
  });

  for (const [clave, nombre, entrada] of [
    ['bayas', 'buscar_bayas', { consulta: 'che' }],
    ['movimientos', 'obtener_movimiento', { nombre_o_id: 85 }],
  ]) {
    test(`runs ${nombre} on its catalog row`, async () => {
      const { port } = crearPuertoPokeApi();
      const fila = CATALOGO.find((f) => f.clave === clave);
      const resultado = await ejecutarHerramienta(port, nombre, entrada);
      assert.equal(resultado.esError, false);
      assert.match(
        resultado.contenido,
        new RegExp(clave === 'bayas' ? '^2 resultados' : `^${fila.etiqueta} thunderbolt`),
      );
    });
  }

  test('golden: obtener_pokemon gyarados answers the same text as the MCP', async () => {
    const { port } = crearPuertoPokeApi({ respuestas: GYARADOS });
    const pokedex = CATALOGO[0];
    const mcp = await obtener(port, pokedex, { nombre_o_id: 'gyarados' });
    const chat = await ejecutarHerramienta(port, 'obtener_pokemon', { nombre_o_id: 'gyarados' });
    assert.equal(chat.contenido, okResult(mcp.resumen, mcp.datos).content[0].text);
    assert.match(chat.contenido, /^Pokémon gyarados \(#130\)\./);
  });

  test('golden: efectividad_tipos electric against water/flying answers the same text as the MCP', async () => {
    const { port } = crearPuertoPokeApi();
    const entrada = { atacante: 'electric', defensor: ['water', 'flying'] };
    const mcp = await efectividad(port, entrada);
    const chat = await ejecutarHerramienta(port, 'efectividad_tipos', entrada);
    assert.equal(chat.contenido, okResult(mcp.resumen, mcp.datos).content[0].text);
    assert.match(chat.contenido, /"multiplicador": 4/);
  });

  test('answers the outage text of a failed table', async () => {
    const { port } = crearPuertoPokeApi({
      respuestas: { [`${API}/type?limit=100`]: [{ status: 500 }] },
    });
    assert.deepEqual(await ejecutarHerramienta(port, 'efectividad_tipos', { atacante: 'fire' }), {
      contenido: MENSAJES.caida,
      esError: true,
    });
  });
});
