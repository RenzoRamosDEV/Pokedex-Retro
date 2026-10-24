import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTIONS } from '../../site/js/core/sections.js';
import { API } from './support/pokeapi-falsa.js';
import { conectar, withTimers } from './support/conectar.js';

const TIPOS = JSON.parse(readFileSync(new URL('./fixtures/tipos.json', import.meta.url), 'utf8'));
const DIECIOCHO = TIPOS.filter((t) => t.id <= 18).map((t) => t.name);

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
  const read = async (uri) => {
    const { contents } = await session.client.readResource({ uri });
    assert.equal(contents.length, 1);
    assert.equal(contents[0].uri, uri);
    assert.equal(contents[0].mimeType, 'application/json');
    return JSON.parse(contents[0].text);
  };
  return { ...session, read };
}

test('lists both resources with uri, JSON mime type and title', async (t) => {
  const { client } = await setup(t);
  const { resources } = await client.listResources();
  assert.deepEqual(
    resources.map(({ uri, name, title, mimeType }) => ({ uri, name, title, mimeType })),
    [
      {
        uri: 'pokedex://tipos/tabla',
        name: 'tabla-tipos',
        title: 'Tabla de tipos',
        mimeType: 'application/json',
      },
      {
        uri: 'pokedex://secciones',
        name: 'secciones',
        title: 'Secciones de la Pokédex',
        mimeType: 'application/json',
      },
    ],
  );
  for (const resource of resources) assert.ok(resource.description.length > 0);
});

test('the type table has the 18 types and their 18 × 18 multipliers', async (t) => {
  const { read } = await setup(t);
  const tabla = await read('pokedex://tipos/tabla');
  assert.deepEqual(tabla.tipos, DIECIOCHO);
  assert.deepEqual(Object.keys(tabla.multiplicadores), DIECIOCHO);
  for (const atacante of DIECIOCHO) {
    assert.deepEqual(Object.keys(tabla.multiplicadores[atacante]), DIECIOCHO);
    for (const defensor of DIECIOCHO) {
      assert.equal(tabla.multiplicadores[atacante][defensor], oraculo(atacante, defensor));
    }
  }
  assert.equal(tabla.multiplicadores.electric.ground, 0);
  assert.equal(tabla.multiplicadores.fire.grass, 2);
  assert.equal(tabla.multiplicadores.stellar, undefined);
});

test('the type table is a JSON-RPC error when PokéAPI is down', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, logs } = await setup(t, {
    level: 'error',
    respuestas: { [`${API}/type?limit=100`]: [{ status: 503 }] },
  });
  await assert.rejects(withTimers(t, client.readResource({ uri: 'pokedex://tipos/tabla' })), {
    message: /PokéAPI no responde; inténtalo en unos minutos\./,
  });
  assert.deepEqual(logs, [
    '[pokedex-mcp] error: resource pokedex://tipos/tabla: tabla de tipos incompleta\n',
  ]);
});

test('the sections catalog follows SECTIONS without any request', async (t) => {
  const { read, calls } = await setup(t);
  const { secciones } = await read('pokedex://secciones');
  assert.deepEqual(
    secciones,
    Object.entries(SECTIONS).map(([clave, s]) => ({
      clave,
      recurso: s.resource,
      tamano_pagina: s.pageSize,
    })),
  );
  assert.equal(secciones.length, 7);
  assert.deepEqual(secciones[0], { clave: 'pokedex', recurso: 'pokemon', tamano_pagina: 18 });
  assert.ok(
    secciones.some((s) => s.clave === 'tipos' && s.recurso === 'type' && s.tamano_pagina === null),
  );
  assert.equal(calls.length, 0);
});
