import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFINICIONES } from '../herramientas.js';
import { BASE, REGLA_ALCANCE } from './alcance.js';
import { SUBAGENTES } from './subagentes.js';

const HERRAMIENTAS = {
  'estratega-tipos': [
    'obtener_pokemon',
    'buscar_movimientos',
    'obtener_movimiento',
    'efectividad_tipos',
  ],
  'entrenador-equipos': [
    'buscar_pokemon',
    'obtener_pokemon',
    'obtener_habilidad',
    'efectividad_tipos',
    'naturalezas',
  ],
  'investigador-pokedex': [
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
  ],
};

const subagente = (nombre) => SUBAGENTES.find((s) => s.nombre === nombre);

describe('SUBAGENTES', () => {
  test('lists the three subagents in order', () => {
    assert.deepEqual(
      SUBAGENTES.map((s) => s.nombre),
      ['estratega-tipos', 'entrenador-equipos', 'investigador-pokedex'],
    );
  });

  for (const [nombre, herramientas] of Object.entries(HERRAMIENTAS)) {
    test(`${nombre} declares exactly its tools in catalog order`, () => {
      assert.deepEqual(
        subagente(nombre).herramientas.map((h) => h.name),
        herramientas,
      );
    });

    test(`${nombre} reuses the main agent's tool definitions`, () => {
      for (const definicion of subagente(nombre).herramientas) {
        assert.ok(DEFINICIONES.includes(definicion), definicion.name);
      }
    });

    test(`${nombre} allows 6 tool iterations`, () => {
      assert.equal(subagente(nombre).maxIteraciones, 6);
    });

    test(`${nombre} prompt carries the scope rule and the base text`, () => {
      const { sistema } = subagente(nombre);
      assert.ok(sistema.includes(REGLA_ALCANCE));
      assert.ok(sistema.includes(BASE));
      assert.ok(sistema.includes('Solo puedo responder preguntas sobre Pokémon.'));
    });

    test(`${nombre} prompt starts with its own role`, () => {
      const { sistema } = subagente(nombre);
      assert.match(sistema, /^Eres el [a-z ]+ de la Pokédex Retro: /);
    });

    test(`${nombre} has a one-line description`, () => {
      const { descripcion } = subagente(nombre);
      assert.ok(descripcion.trim().length > 0);
      assert.ok(!descripcion.includes('\n'));
    });

    test(`${nombre} cannot delegate or load skills`, () => {
      const nombres = subagente(nombre).herramientas.map((h) => h.name);
      assert.ok(!nombres.includes('delegar_subagente'));
      assert.ok(!nombres.includes('usar_skill'));
    });
  }

  test('each subagent has its own prompt', () => {
    assert.equal(new Set(SUBAGENTES.map((s) => s.sistema)).size, 3);
  });
});
