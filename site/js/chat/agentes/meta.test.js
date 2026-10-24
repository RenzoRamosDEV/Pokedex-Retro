import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from './skills.js';
import {
  DELEGAR_SUBAGENTE,
  META,
  USAR_SKILL,
  cargarSkill,
  resultadoSubagente,
  validarDelegacion,
} from './meta.js';

const ERROR_SUBAGENTE =
  'subagente debe ser uno de: estratega-tipos, entrenador-equipos, investigador-pokedex.';
const ERROR_TAREA = 'tarea debe tener entre 1 y 2000 caracteres.';
const ERROR_SKILL =
  'nombre debe ser uno de: comparar-pokemon, equipo-contra-tipo, analizar-debilidades, recomendar-naturaleza.';

const fallo = (mensaje) => ({ ok: false, mensaje });
const delegacion = (subagente, tarea) => ({ ok: true, valor: { subagente, tarea } });

describe('DELEGAR_SUBAGENTE', () => {
  test('is a strict tool with both fields required and no extra properties', () => {
    assert.equal(DELEGAR_SUBAGENTE.name, 'delegar_subagente');
    assert.equal(DELEGAR_SUBAGENTE.strict, true);
    assert.equal(DELEGAR_SUBAGENTE.eager_input_streaming, true);
    assert.deepEqual(DELEGAR_SUBAGENTE.input_schema.required, ['subagente', 'tarea']);
    assert.equal(DELEGAR_SUBAGENTE.input_schema.additionalProperties, false);
    assert.equal(DELEGAR_SUBAGENTE.input_schema.type, 'object');
  });

  test('enumerates the subagents and states the task limits', () => {
    const { subagente, tarea } = DELEGAR_SUBAGENTE.input_schema.properties;
    assert.equal(subagente.type, 'string');
    assert.deepEqual(subagente.enum, [
      'estratega-tipos',
      'entrenador-equipos',
      'investigador-pokedex',
    ]);
    assert.equal(tarea.type, 'string');
    assert.match(tarea.description, /de 1 a 2000 caracteres/);
  });

  test('asks to delegate only when needed', () => {
    assert.match(DELEGAR_SUBAGENTE.description, /solo cuando/);
  });
});

describe('USAR_SKILL', () => {
  test('is a strict tool with the skill name required', () => {
    assert.equal(USAR_SKILL.name, 'usar_skill');
    assert.equal(USAR_SKILL.strict, true);
    assert.equal(USAR_SKILL.eager_input_streaming, true);
    assert.deepEqual(USAR_SKILL.input_schema.required, ['nombre']);
    assert.equal(USAR_SKILL.input_schema.additionalProperties, false);
    assert.equal(USAR_SKILL.input_schema.type, 'object');
  });

  test('enumerates the skills', () => {
    const { nombre } = USAR_SKILL.input_schema.properties;
    assert.equal(nombre.type, 'string');
    assert.deepEqual(nombre.enum, [
      'comparar-pokemon',
      'equipo-contra-tipo',
      'analizar-debilidades',
      'recomendar-naturaleza',
    ]);
  });

  test('every property has a description', () => {
    for (const definicion of META) {
      assert.ok(definicion.description.length > 0);
      for (const propiedad of Object.values(definicion.input_schema.properties)) {
        assert.ok(propiedad.description.length > 0, definicion.name);
      }
    }
  });
});

describe('META', () => {
  test('lists delegar_subagente then usar_skill', () => {
    assert.deepEqual(META, [DELEGAR_SUBAGENTE, USAR_SKILL]);
  });
});

describe('validarDelegacion', () => {
  const casos = [
    [
      'a one-character task',
      { subagente: 'estratega-tipos', tarea: 'x' },
      delegacion('estratega-tipos', 'x'),
    ],
    [
      'a 2000-character task',
      { subagente: 'investigador-pokedex', tarea: 'a'.repeat(2000) },
      delegacion('investigador-pokedex', 'a'.repeat(2000)),
    ],
    [
      'a padded 2000-character task, trimmed',
      { subagente: 'entrenador-equipos', tarea: `  ${'b'.repeat(2000)}  ` },
      delegacion('entrenador-equipos', 'b'.repeat(2000)),
    ],
    [
      'a subagent name with spaces, trimmed',
      { subagente: ' estratega-tipos ', tarea: 'debilidades de gyarados' },
      delegacion('estratega-tipos', 'debilidades de gyarados'),
    ],
    [
      'unknown extra properties, ignored',
      { subagente: 'estratega-tipos', tarea: 'x', prioridad: 1 },
      delegacion('estratega-tipos', 'x'),
    ],
    ['an empty task', { subagente: 'estratega-tipos', tarea: '' }, fallo(ERROR_TAREA)],
    ['a blank task', { subagente: 'estratega-tipos', tarea: '   ' }, fallo(ERROR_TAREA)],
    [
      'a 2001-character task',
      { subagente: 'estratega-tipos', tarea: 'a'.repeat(2001) },
      fallo(ERROR_TAREA),
    ],
    ['a non-text task', { subagente: 'estratega-tipos', tarea: 5 }, fallo(ERROR_TAREA)],
    ['a missing task', { subagente: 'estratega-tipos' }, fallo(ERROR_TAREA)],
    [
      'an unknown subagent',
      { subagente: 'chef', tarea: 'ataques de pikachu' },
      fallo(ERROR_SUBAGENTE),
    ],
    [
      'an upper-case subagent',
      { subagente: 'ESTRATEGA-TIPOS', tarea: 'x' },
      fallo(ERROR_SUBAGENTE),
    ],
    ['a missing subagent', { tarea: 'x' }, fallo(ERROR_SUBAGENTE)],
    ['a non-text subagent', { subagente: 1, tarea: 'x' }, fallo(ERROR_SUBAGENTE)],
    ['both invalid, subagent first', { subagente: 'chef', tarea: '' }, fallo(ERROR_SUBAGENTE)],
    ['an undefined input', undefined, fallo(ERROR_SUBAGENTE)],
    ['a null input', null, fallo(ERROR_SUBAGENTE)],
  ];
  for (const [nombre, entrada, esperado] of casos) {
    test(`handles ${nombre}`, () => {
      assert.deepEqual(validarDelegacion(entrada), esperado);
    });
  }
});

describe('cargarSkill', () => {
  for (const skill of SKILLS) {
    test(`returns the instructions of ${skill.nombre}`, () => {
      assert.deepEqual(cargarSkill({ nombre: skill.nombre }), {
        contenido: skill.instrucciones,
        esError: false,
        nombre: skill.nombre,
      });
    });
  }

  test('trims the skill name', () => {
    assert.equal(cargarSkill({ nombre: ' analizar-debilidades ' }).nombre, 'analizar-debilidades');
  });

  for (const [caso, entrada] of [
    ['an unknown name', { nombre: 'cocinar' }],
    ['an upper-case name', { nombre: 'COMPARAR-POKEMON' }],
    ['a missing name', {}],
    ['a non-text name', { nombre: 3 }],
    ['an undefined input', undefined],
  ]) {
    test(`rejects ${caso}`, () => {
      assert.deepEqual(cargarSkill(entrada), { contenido: ERROR_SKILL, esError: true });
    });
  }
});

describe('resultadoSubagente', () => {
  const ok = (contenido) => ({ contenido, esError: false });
  const error = (contenido) => ({ contenido, esError: true });
  const casos = [
    [
      'fin with text',
      { estado: 'fin', texto: 'Gyarados es débil a electric.', pendientes: false },
      ok('Gyarados es débil a electric.'),
    ],
    [
      'cortada without calls',
      { estado: 'cortada', texto: 'Texto a medias', pendientes: false },
      ok('Texto a medias'),
    ],
    [
      'fin with empty text',
      { estado: 'fin', texto: '', pendientes: false },
      error('El subagente estratega-tipos no terminó su respuesta.'),
    ],
    [
      'fin with blank text',
      { estado: 'fin', texto: '  \n ', pendientes: false },
      error('El subagente estratega-tipos no terminó su respuesta.'),
    ],
    [
      'cortada with calls',
      { estado: 'cortada', texto: 'Voy a consultar', pendientes: true },
      error('El subagente estratega-tipos no terminó su respuesta.'),
    ],
    [
      'rechazo',
      { estado: 'rechazo', texto: 'No', pendientes: false },
      error('El subagente estratega-tipos no puede responder a esta tarea.'),
    ],
    [
      'limite',
      { estado: 'limite', texto: 'Sigo', pendientes: true },
      error('El subagente estratega-tipos alcanzó el límite de consultas.'),
    ],
  ];
  for (const [nombre, final, esperado] of casos) {
    test(`maps ${nombre}`, () => {
      assert.deepEqual(resultadoSubagente('estratega-tipos', final), esperado);
    });
  }

  test('names the given subagent', () => {
    assert.deepEqual(
      resultadoSubagente('investigador-pokedex', {
        estado: 'rechazo',
        texto: '',
        pendientes: false,
      }),
      error('El subagente investigador-pokedex no puede responder a esta tarea.'),
    );
  });
});
