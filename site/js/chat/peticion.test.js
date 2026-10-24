import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SISTEMA, construirPeticion } from './peticion.js';
import { DEFINICIONES } from './herramientas.js';

const CLAVE = 'sk-ant-prueba';
const MENSAJES = [{ role: 'user', content: 'hola' }];
const peticion = (modelo) => construirPeticion({ modelo, clave: CLAVE, mensajes: MENSAJES });
const cuerpo = (modelo) => JSON.parse(peticion(modelo).opciones.body);

const CABECERAS = {
  'content-type': 'application/json',
  'x-api-key': CLAVE,
  'anthropic-version': '2026-10-21',
  'anthropic-dangerous-direct-browser-access': 'true',
};

describe('construirPeticion', () => {
  test('posts to the Messages API', () => {
    const { url, opciones } = peticion('claude-opus-5-5');
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(opciones.method, 'POST');
  });

  for (const modelo of ['claude-opus-5-5', 'claude-sonnet-5-5']) {
    test(`sends the fallback beta header with ${modelo}`, () => {
      assert.deepEqual(peticion(modelo).opciones.headers, {
        ...CABECERAS,
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      });
    });

    test(`builds the exact body with ${modelo}, fallbacks last`, () => {
      const texto = peticion(modelo).opciones.body;
      assert.deepEqual(Object.keys(JSON.parse(texto)), [
        'model',
        'max_tokens',
        'stream',
        'system',
        'tools',
        'messages',
        'output_config',
        'cache_control',
        'fallbacks',
      ]);
      assert.deepEqual(JSON.parse(texto), {
        model: modelo,
        max_tokens: 8000,
        stream: true,
        system: SISTEMA,
        tools: DEFINICIONES,
        messages: MENSAJES,
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        fallbacks: 'default',
      });
    });
  }

  test('sends no beta header with Haiku 5.5', () => {
    assert.deepEqual(peticion('claude-haiku-5-5').opciones.headers, CABECERAS);
  });

  test('sends no fallbacks with Haiku 5.5', () => {
    assert.deepEqual(Object.keys(cuerpo('claude-haiku-5-5')), [
      'model',
      'max_tokens',
      'stream',
      'system',
      'tools',
      'messages',
      'output_config',
      'cache_control',
    ]);
  });

  for (const modelo of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']) {
    test(`never sends sampling, thinking or a forced tool choice with ${modelo}`, () => {
      const enviado = cuerpo(modelo);
      for (const clave of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice']) {
        assert.equal(clave in enviado, false, clave);
      }
    });
  }

  test('keeps the key out of the body', () => {
    assert.equal(peticion('claude-opus-5-5').opciones.body.includes(CLAVE), false);
  });
});

describe('SISTEMA', () => {
  test('asks in Spanish to use the tools for any data and to answer in plain Spanish text', () => {
    assert.match(SISTEMA, /Pokédex/);
    assert.match(SISTEMA, /herramientas/);
    assert.match(SISTEMA, /en español/);
    assert.match(SISTEMA, /texto plano/);
  });
});
