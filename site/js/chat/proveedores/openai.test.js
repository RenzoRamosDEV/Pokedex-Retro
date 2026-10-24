import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FUNCIONES, openai } from './openai.js';
import { DEFINICIONES } from '../herramientas.js';
import { SISTEMA } from '../peticion.js';
import { MODELOS_OPENAI } from '../modelos.js';
import { DESCRIPCIONES } from '../../core/consultas.js';

const CLAVE = 'sk-proj-prueba';
const HISTORIAL = [{ role: 'user', content: 'hola' }];

const peticion = (modelo = 'gpt-6.1-sol') =>
  openai.construirPeticion({ modelo, clave: CLAVE, historial: HISTORIAL });
const cuerpo = (modelo) => JSON.parse(peticion(modelo).opciones.body);
const funcion = (nombre) => FUNCIONES.find((f) => f.name === nombre);

describe('openai.construirPeticion', () => {
  test('posts to the Responses API', () => {
    const { url, opciones } = peticion();
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(opciones.method, 'POST');
  });

  test('sends exactly content-type and the key as a bearer token', () => {
    assert.deepEqual(peticion().opciones.headers, {
      'content-type': 'application/json',
      authorization: `Bearer ${CLAVE}`,
    });
  });

  test('sends the fields in a fixed order with the documented values', () => {
    const datos = cuerpo('gpt-6.1-sol');
    assert.deepEqual(Object.keys(datos), [
      'model',
      'instructions',
      'input',
      'tools',
      'max_output_tokens',
      'reasoning',
      'store',
      'stream',
    ]);
    assert.deepEqual(datos, {
      model: 'gpt-6.1-sol',
      instructions: SISTEMA,
      input: HISTORIAL,
      tools: FUNCIONES,
      max_output_tokens: 8000,
      reasoning: { effort: 'low' },
      store: false,
      stream: true,
    });
  });

  for (const { id } of MODELOS_OPENAI) {
    test(`${id} carries no forbidden parameter and never stores`, () => {
      const datos = cuerpo(id);
      assert.equal(datos.model, id);
      for (const prohibido of [
        'temperature',
        'top_p',
        'previous_response_id',
        'conversation',
        'background',
        'tool_choice',
        'include',
      ]) {
        assert.equal(prohibido in datos, false, prohibido);
      }
      assert.equal(datos.store, false);
    });
  }
});

describe('FUNCIONES', () => {
  test('declares the 12 tools as strict functions in the order, names and descriptions of Claude', () => {
    assert.equal(FUNCIONES.length, 12);
    assert.deepEqual(
      FUNCIONES.map((f) => [f.type, f.name, f.description, f.strict]),
      DEFINICIONES.map((d) => ['function', d.name, d.description, true]),
    );
    assert.deepEqual(Object.keys(FUNCIONES[0]), [
      'type',
      'name',
      'description',
      'parameters',
      'strict',
    ]);
  });

  test('every parameters object closes extra properties and requires all of them', () => {
    for (const { name, parameters } of FUNCIONES) {
      assert.equal(parameters.type, 'object', name);
      assert.equal(parameters.additionalProperties, false, name);
      assert.deepEqual(parameters.required, Object.keys(parameters.properties), name);
    }
  });

  test('golden: buscar_pokemon makes its optional fields nullable', () => {
    assert.deepEqual(funcion('buscar_pokemon'), {
      type: 'function',
      name: 'buscar_pokemon',
      description: DESCRIPCIONES.buscar_pokemon,
      parameters: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description:
              'Texto que debe contener el nombre, en inglés como en PokéAPI (p. ej. "char")',
          },
          pagina: { type: ['integer', 'null'], description: 'Página de resultados, desde 1' },
          tamano_pagina: {
            type: ['integer', 'null'],
            description: 'Resultados por página, de 1 a 50',
          },
        },
        required: ['consulta', 'pagina', 'tamano_pagina'],
        additionalProperties: false,
      },
      strict: true,
    });
  });

  test('golden: obtener_pokemon keeps its required anyOf as is', () => {
    assert.deepEqual(funcion('obtener_pokemon').parameters, {
      type: 'object',
      properties: {
        nombre_o_id: {
          anyOf: [{ type: 'string' }, { type: 'integer' }],
          description: 'Nombre en inglés de PokéAPI (p. ej. "pikachu") o número',
        },
      },
      required: ['nombre_o_id'],
      additionalProperties: false,
    });
  });

  test('golden: efectividad_tipos makes the defender array nullable', () => {
    assert.deepEqual(funcion('efectividad_tipos').parameters, {
      type: 'object',
      properties: {
        atacante: { type: 'string', description: 'Tipo atacante en inglés, p. ej. "electric"' },
        defensor: {
          type: ['array', 'null'],
          description: '1 o 2 tipos defensores distintos, p. ej. ["water", "flying"]',
          items: { type: 'string' },
        },
      },
      required: ['atacante', 'defensor'],
      additionalProperties: false,
    });
  });

  test('golden: naturalezas keeps the enum and makes the stat nullable', () => {
    assert.deepEqual(funcion('naturalezas').parameters, {
      type: 'object',
      properties: {
        estadistica: {
          type: ['string', 'null'],
          description: 'Estadística que la naturaleza sube o baja',
          enum: ['attack', 'defense', 'special-attack', 'special-defense', 'speed'],
        },
      },
      required: ['estadistica'],
      additionalProperties: false,
    });
  });

  test('leaves the Claude definitions untouched', () => {
    const naturalezas = DEFINICIONES.find((d) => d.name === 'naturalezas');
    assert.deepEqual(naturalezas.input_schema.required, []);
    assert.equal(naturalezas.input_schema.properties.estadistica.type, 'string');
    const buscar = DEFINICIONES.find((d) => d.name === 'buscar_pokemon');
    assert.deepEqual(buscar.input_schema.required, ['consulta']);
    assert.equal(buscar.input_schema.properties.pagina.type, 'integer');
  });
});
