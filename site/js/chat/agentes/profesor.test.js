import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFINICIONES } from '../herramientas.js';
import { BASE, REGLA_ALCANCE } from './alcance.js';
import { DELEGAR_SUBAGENTE, USAR_SKILL } from './meta.js';
import { PROFESOR } from './profesor.js';
import { SKILLS } from './skills.js';
import { SUBAGENTES } from './subagentes.js';

describe('PROFESOR', () => {
  test('is named profesor and allows 8 tool iterations', () => {
    assert.equal(PROFESOR.nombre, 'profesor');
    assert.equal(PROFESOR.maxIteraciones, 8);
  });

  test('declares the 12 query tools, then delegar_subagente and usar_skill', () => {
    assert.equal(PROFESOR.herramientas.length, 14);
    assert.deepEqual(PROFESOR.herramientas, [...DEFINICIONES, DELEGAR_SUBAGENTE, USAR_SKILL]);
  });

  test('prompt starts with the base text and carries the scope rule', () => {
    assert.ok(PROFESOR.sistema.startsWith(BASE));
    assert.ok(PROFESOR.sistema.includes(REGLA_ALCANCE));
    assert.ok(PROFESOR.sistema.includes('Solo puedo responder preguntas sobre Pokémon.'));
  });

  for (const { nombre, descripcion } of [...SUBAGENTES, ...SKILLS]) {
    test(`prompt lists ${nombre} with its description`, () => {
      assert.ok(PROFESOR.sistema.includes(`\n- ${nombre}: ${descripcion}`));
    });
  }

  for (const { nombre, instrucciones } of SKILLS) {
    test(`prompt leaves out the instructions of ${nombre}`, () => {
      assert.ok(!PROFESOR.sistema.includes(instrucciones));
    });
  }

  test('prompt explains when to delegate and how to load a skill', () => {
    assert.match(PROFESOR.sistema, /delegar_subagente/);
    assert.match(PROFESOR.sistema, /usar_skill/);
  });

  test('prompt carries no date or other variable data', () => {
    assert.doesNotMatch(PROFESOR.sistema, /\d{4}-\d{2}-\d{2}/);
  });
});
