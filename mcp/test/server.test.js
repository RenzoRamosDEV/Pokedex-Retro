import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { SECTIONS } from '../../site/js/core/sections.js';
import * as schemas from '../src/schemas.js';
import { conectar } from './support/conectar.js';
import { assertGolden } from './support/golden.js';

const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../site/js/mappers/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );

const CATALOGO = [
  ['pokedex', 'buscar_pokemon', 'obtener_pokemon', 'pokemon', 'gengar', schemas.POKEMON],
  [
    'movimientos',
    'buscar_movimientos',
    'obtener_movimiento',
    'move',
    'thunderbolt',
    schemas.MOVIMIENTO,
  ],
  [
    'habilidades',
    'buscar_habilidades',
    'obtener_habilidad',
    'ability',
    'stench',
    schemas.HABILIDAD,
  ],
  ['objetos', 'buscar_objetos', 'obtener_objeto', 'item', 'master-ball', schemas.OBJETO],
  ['bayas', 'buscar_bayas', 'obtener_baya', 'berry', 'cheri', schemas.BAYA],
];

async function setup(t) {
  const session = await conectar();
  t.after(session.close);
  return session;
}

test('identifies itself as pokedex-retro with the given version', async (t) => {
  const { client } = await setup(t);
  assert.deepEqual(client.getServerVersion(), { name: 'pokedex-retro', version: '1.0.0' });
});

const DOCE = [
  'buscar_pokemon',
  'obtener_pokemon',
  'buscar_movimientos',
  'obtener_movimiento',
  'buscar_habilidades',
  'obtener_habilidad',
  'buscar_objetos',
  'obtener_objeto',
  'buscar_bayas',
  'obtener_baya',
  'efectividad_tipos',
  'naturalezas',
];

test('lists exactly the 12 tools, each with description, inputSchema and outputSchema', async (t) => {
  const { client } = await setup(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...DOCE].sort());
  for (const tool of tools) {
    assert.ok(tool.description.length > 0, tool.name);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.outputSchema.type, 'object');
  }
});

test('efectividad_tipos output is strict to its schema', async (t) => {
  const { client } = await setup(t);
  const conDefensor = await client.callTool({
    name: 'efectividad_tipos',
    arguments: { atacante: 'fire', defensor: ['grass'] },
  });
  const sinDefensor = await client.callTool({
    name: 'efectividad_tipos',
    arguments: { atacante: 'fire' },
  });
  z.object(schemas.EFECTIVIDAD).strict().parse(conDefensor.structuredContent);
  z.object(schemas.EFECTIVIDAD).strict().parse(sinDefensor.structuredContent);
});

test('naturalezas output is strict to its schema and equals the web mapper', async (t) => {
  const { client } = await setup(t);
  const result = await client.callTool({ name: 'naturalezas', arguments: {} });
  z.object(schemas.NATURALEZAS).strict().parse(result.structuredContent);
  const hardy = JSON.parse(
    readFileSync(new URL('./fixtures/naturalezas.json', import.meta.url), 'utf8'),
  )[0];
  assert.deepEqual(result.structuredContent.naturalezas[0], SECTIONS.naturalezas.mapper(hardy));
});

for (const [clave, buscar, obtener, fixtureName, name, shape] of CATALOGO) {
  test(`${obtener} output is strict to its schema and equals the web mapper`, async (t) => {
    const { client } = await setup(t);
    const result = await client.callTool({ name: obtener, arguments: { nombre_o_id: name } });
    z.object(shape).strict().parse(result.structuredContent);
    assert.deepEqual(result.structuredContent, SECTIONS[clave].mapper(fixture(fixtureName)));
  });

  test(`${buscar} output is strict to the search schema`, async (t) => {
    const { client } = await setup(t);
    const result = await client.callTool({ name: buscar, arguments: { consulta: name } });
    z.object(schemas.busqueda(shape)).strict().parse(result.structuredContent);
    assert.deepEqual(result.structuredContent.resultados, [
      SECTIONS[clave].mapper(fixture(fixtureName)),
    ]);
  });
}

test('tools/list matches the golden file', async (t) => {
  const { client } = await setup(t);
  const { tools } = await client.listTools();
  assertGolden('tools-list.golden.json', tools);
});
