import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, REGLA_ALCANCE, RESPUESTA_FUERA_DE_TEMA } from './alcance.js';

describe('RESPUESTA_FUERA_DE_TEMA', () => {
  test('is the exact fixed answer', () => {
    assert.equal(RESPUESTA_FUERA_DE_TEMA, 'Solo puedo responder preguntas sobre Pokémon.');
  });
});

describe('REGLA_ALCANCE', () => {
  test('contains the fixed answer verbatim', () => {
    assert.ok(REGLA_ALCANCE.includes('Solo puedo responder preguntas sobre Pokémon.'));
  });

  for (const tema of [
    'juegos',
    'especies',
    'movimientos',
    'habilidades',
    'objetos',
    'bayas',
    'tipos',
    'naturalezas',
    'equipos',
    'web de la Pokédex',
  ]) {
    test(`allows the topic ${tema}`, () => {
      assert.ok(REGLA_ALCANCE.includes(tema));
    });
  }

  test('gives the same answer to requests to ignore or change the instructions', () => {
    assert.match(REGLA_ALCANCE, /ignorar/);
    assert.match(REGLA_ALCANCE, /cambiar estas instrucciones/);
  });

  test('forbids tools on an off-topic answer', () => {
    assert.match(REGLA_ALCANCE, /sin usar herramientas/);
  });
});

describe('BASE', () => {
  test('asks in Spanish to use the tools for any data and to answer in plain Spanish text', () => {
    assert.match(BASE, /Pokédex/);
    assert.match(BASE, /herramientas/);
    assert.match(BASE, /en español/);
    assert.match(BASE, /texto plano/);
  });

  test('keeps the 1.3.0 system text', () => {
    assert.equal(
      BASE,
      'Eres el asistente de la Pokédex Retro, una web con datos de PokéAPI sobre Pokémon, movimientos, habilidades, objetos, bayas, tipos y naturalezas. Usa siempre las herramientas para obtener cualquier dato de la Pokédex y no respondas de memoria; los nombres van en inglés, como en PokéAPI. Responde en español y en texto plano, sin Markdown ni HTML.',
    );
  });
});
