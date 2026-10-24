import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { errorDeEvento, errorDeRespuesta, esReintentable, esperaReintento } from './errores.js';
import { respuestaError } from '../../../tests/support/claude-sse.js';

const NOW = () => Date.parse('Sat, 24 Oct 2026 10:00:00 GMT');

describe('errorDeRespuesta', () => {
  for (const [estado, tipo, codigo] of [
    [401, 'authentication_error', 'clave_invalida'],
    [403, 'permission_error', 'permiso'],
    [404, 'not_found_error', 'servidor'],
    [413, 'request_too_large', 'demasiado_larga'],
    [418, 'api_error', 'servidor'],
    [429, 'rate_limit_error', 'limite_uso'],
    [500, 'api_error', 'servidor'],
    [503, 'api_error', 'servidor'],
    [529, 'overloaded_error', 'saturado'],
    [599, 'api_error', 'servidor'],
  ]) {
    test(`maps HTTP ${estado} to ${codigo}`, async () => {
      const error = await errorDeRespuesta(respuestaError(estado, tipo, 'detalle'));
      assert.equal(error.name, 'ErrorDeClaude');
      assert.equal(error.codigo, codigo);
      assert.equal(error.estado, estado);
    });
  }

  test('keeps the API message of a 400', async () => {
    const error = await errorDeRespuesta(
      respuestaError(400, 'invalid_request_error', 'max_tokens: too large'),
    );
    assert.deepEqual(
      { codigo: error.codigo, estado: error.estado, detalle: error.detalle },
      { codigo: 'peticion', estado: 400, detalle: 'max_tokens: too large' },
    );
  });

  test('describes a 400 without a JSON body by its status', async () => {
    const error = await errorDeRespuesta(new Response('<html>', { status: 400 }));
    assert.deepEqual(
      { codigo: error.codigo, detalle: error.detalle },
      { codigo: 'peticion', detalle: 'HTTP 400' },
    );
  });

  test('describes a 400 whose JSON has no message by its status', async () => {
    const error = await errorDeRespuesta(new Response('{"type":"error"}', { status: 400 }));
    assert.equal(error.detalle, 'HTTP 400');
  });
});

describe('errorDeEvento', () => {
  for (const [tipo, codigo, estado] of [
    ['authentication_error', 'clave_invalida', 401],
    ['permission_error', 'permiso', 403],
    ['invalid_request_error', 'peticion', 400],
    ['request_too_large', 'demasiado_larga', 413],
    ['rate_limit_error', 'limite_uso', 429],
    ['overloaded_error', 'saturado', 529],
    ['api_error', 'servidor', 500],
    ['tipo_nuevo', 'servidor', 500],
  ]) {
    test(`maps the stream error ${tipo} to ${codigo}`, () => {
      const error = errorDeEvento({ tipo, message: 'texto' });
      assert.deepEqual(
        { name: error.name, codigo: error.codigo, estado: error.estado, detalle: error.detalle },
        { name: 'ErrorDeClaude', codigo, estado, detalle: 'texto' },
      );
    });
  }
});

describe('esReintentable', () => {
  for (const estado of [429, 500, 529, 599]) {
    test(`retries ${estado}`, () => assert.equal(esReintentable(estado), true));
  }
  for (const estado of [400, 401, 403, 404, 413, 499]) {
    test(`does not retry ${estado}`, () => assert.equal(esReintentable(estado), false));
  }
});

describe('esperaReintento', () => {
  test('waits the seconds of retry-after', () => {
    assert.equal(esperaReintento(new Headers({ 'retry-after': '3' }), 0, NOW), 3000);
  });

  test('waits until the date of retry-after', () => {
    const headers = new Headers({ 'retry-after': 'Sat, 24 Oct 2026 10:00:05 GMT' });
    assert.equal(esperaReintento(headers, 1, NOW), 5000);
  });

  for (const [headers, descripcion] of [
    [new Headers(), 'without retry-after'],
    [new Headers({ 'retry-after': 'pronto' }), 'with an unreadable retry-after'],
  ]) {
    test(`waits 1 s and then 2 s ${descripcion}`, () => {
      assert.deepEqual(
        [0, 1].map((intento) => esperaReintento(headers, intento, NOW)),
        [1000, 2000],
      );
    });
  }
});
