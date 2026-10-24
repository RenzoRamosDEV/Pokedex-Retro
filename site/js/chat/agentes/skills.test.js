import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIA_COMPARAR, GUIA_EQUIPO } from '../../core/guias.js';
import { SKILLS } from './skills.js';

const HERRAMIENTAS_POR_SKILL = {
  'comparar-pokemon': ['obtener_pokemon', 'efectividad_tipos', 'buscar_pokemon'],
  'equipo-contra-tipo': ['efectividad_tipos', 'buscar_pokemon', 'obtener_pokemon'],
  'analizar-debilidades': ['obtener_pokemon', 'efectividad_tipos'],
  'recomendar-naturaleza': ['obtener_pokemon', 'naturalezas'],
};

const skill = (nombre) => SKILLS.find((s) => s.nombre === nombre);

describe('SKILLS', () => {
  test('lists the four skills in order', () => {
    assert.deepEqual(
      SKILLS.map((s) => s.nombre),
      ['comparar-pokemon', 'equipo-contra-tipo', 'analizar-debilidades', 'recomendar-naturaleza'],
    );
  });

  for (const [nombre, herramientas] of Object.entries(HERRAMIENTAS_POR_SKILL)) {
    test(`${nombre} has a one-line description`, () => {
      const { descripcion } = skill(nombre);
      assert.ok(descripcion.trim().length > 0);
      assert.ok(!descripcion.includes('\n'));
    });

    test(`${nombre} instructions name ${herramientas.join(', ')}`, () => {
      for (const herramienta of herramientas) {
        assert.ok(skill(nombre).instrucciones.includes(herramienta), herramienta);
      }
    });

    test(`${nombre} instructions differ from its description`, () => {
      assert.notEqual(skill(nombre).instrucciones, skill(nombre).descripcion);
    });
  }

  test('comparar-pokemon ends with the guide shared with the MCP', () => {
    assert.equal(
      skill('comparar-pokemon').instrucciones,
      `Compara los dos Pokémon que indique el usuario. ${GUIA_COMPARAR}`,
    );
  });

  test('equipo-contra-tipo ends with the guide shared with the MCP', () => {
    assert.equal(
      skill('equipo-contra-tipo').instrucciones,
      `Propón un equipo de 6 Pokémon contra el tipo que indique el usuario. ${GUIA_EQUIPO}`,
    );
  });
});
