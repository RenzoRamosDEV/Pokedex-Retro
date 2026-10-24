import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MENSAJES, MENSAJES_ENTRADA, textoResultado } from './mensajes.js';

describe('MENSAJES', () => {
  test('caida names the PokéAPI outage', () => {
    assert.equal(MENSAJES.caida, 'PokéAPI no responde; inténtalo en unos minutos.');
  });

  test('paginaInexistente uses the singular for a single page', () => {
    assert.equal(MENSAJES.paginaInexistente(2, 1), 'La página 2 no existe; hay 1 página.');
  });

  test('paginaInexistente uses the plural for two pages', () => {
    assert.equal(MENSAJES.paginaInexistente(3, 2), 'La página 3 no existe; hay 2 páginas.');
  });

  test('recursoInexistente points to the search tool', () => {
    assert.equal(
      MENSAJES.recursoInexistente('el Pokémon', 'xyz', 'buscar_pokemon'),
      'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
    );
  });

  test('tipoDesconocido lists the valid types', () => {
    assert.equal(
      MENSAJES.tipoDesconocido('lava', ['fire', 'water']),
      'El tipo "lava" no existe. Tipos válidos: fire, water.',
    );
  });
});

describe('MENSAJES_ENTRADA', () => {
  test('keeps the seven input validation texts of the MCP', () => {
    assert.deepEqual(MENSAJES_ENTRADA, {
      consulta: 'consulta debe tener entre 1 y 50 caracteres.',
      pagina: 'pagina debe ser un entero mayor o igual que 1.',
      tamano_pagina: 'tamano_pagina debe estar entre 1 y 50.',
      nombre_o_id:
        'nombre_o_id debe ser un nombre (letras, números, espacios o guiones) o un entero mayor o igual que 1.',
      atacante: 'atacante debe ser un nombre de tipo de PokéAPI, p. ej. fire.',
      defensor: 'defensor debe tener 1 o 2 tipos distintos.',
      estadistica: 'estadistica debe ser attack, defense, special-attack, special-defense o speed.',
    });
  });
});

describe('textoResultado', () => {
  test('joins the summary and the indented JSON with a blank line', () => {
    assert.equal(
      textoResultado('Resumen.', { a: 1, b: { c: [2] } }),
      'Resumen.\n\n{\n  "a": 1,\n  "b": {\n    "c": [\n      2\n    ]\n  }\n}',
    );
  });
});
