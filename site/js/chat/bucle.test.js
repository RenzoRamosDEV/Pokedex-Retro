import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { responder } from './bucle.js';
import { construirPeticion } from './peticion.js';
import { MENSAJES } from '../core/mensajes.js';
import { API, crearPuertoPokeApi } from '../../../tests/support/puerto-pokeapi.js';
import {
  errorEvent,
  fallbackBlock,
  mensaje,
  messageStart,
  blockStart,
  blockDelta,
  respuestaError,
  respuestaSse,
  serializar,
  textBlock,
  thinkingBlock,
  toolUseBlock,
} from '../../../tests/support/claude-sse.js';

const POKEMON = JSON.parse(
  readFileSync(new URL('../mappers/fixtures/pokemon.json', import.meta.url), 'utf8'),
);
const GYARADOS = {
  [`${API}/pokemon/gyarados`]: [{ status: 200, body: { ...POKEMON, id: 130, name: 'gyarados' } }],
};
const CLAVE = 'sk-ant-prueba';
const MODELO = 'claude-opus-5-5';

const texto = (t, extra = {}) => respuestaSse(mensaje({ bloques: [textBlock(0, t)], ...extra }));
const herramienta = (bloques, extra = {}) =>
  respuestaSse(mensaje({ bloques, stopReason: 'tool_use', ...extra }));
const efectividadUso = (index = 0, id = 'toolu_1') =>
  toolUseBlock(index, {
    id,
    name: 'efectividad_tipos',
    input: { atacante: 'electric', defensor: ['water', 'flying'] },
  });

/** Fake fetch answering from a queue: Responses, errors to reject with, or functions. */
function fetchFalso(respuestas) {
  const peticiones = [];
  const fetch = async (url, opciones) => {
    peticiones.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    return typeof siguiente === 'function' ? siguiente(opciones) : siguiente;
  };
  return { fetch, peticiones };
}

function preparar(respuestas, opciones = {}) {
  const { fetch, peticiones } = fetchFalso(respuestas);
  const esperas = [];
  const eventos = [];
  const pokeApi = crearPuertoPokeApi({ respuestas: GYARADOS });
  const llamada = {
    mensajes: [],
    pregunta: 'hola',
    modelo: MODELO,
    clave: CLAVE,
    fetch,
    port: pokeApi.port,
    signal: undefined,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    alEvento: (evento) => eventos.push(evento),
    ...opciones,
  };
  return { llamada, peticiones, esperas, eventos, pokeApi };
}

const textos = (eventos) => eventos.filter((e) => e.tipo === 'texto').map((e) => e.texto);

describe('responder', () => {
  test('ends with the final text, incorporates the turns and adds up the usage', async () => {
    const { llamada, peticiones, eventos } = preparar([
      texto(['Gyara', 'dos'], { usage: { input_tokens: 7 }, salida: { output_tokens: 3 } }),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(resultado, {
      estado: 'fin',
      mensajes: [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: [{ type: 'text', text: 'Gyarados' }] },
      ],
      uso: { entrada: 7, salida: 3 },
    });
    assert.deepEqual(textos(eventos), ['Gyara', 'dos']);
    assert.deepEqual(eventos.at(-1), { tipo: 'uso', uso: { entrada: 7, salida: 3 } });
    const esperada = construirPeticion({
      modelo: MODELO,
      clave: CLAVE,
      mensajes: [{ role: 'user', content: 'hola' }],
    });
    assert.equal(peticiones[0].url, esperada.url);
    assert.deepEqual(peticiones[0].opciones.headers, esperada.opciones.headers);
    assert.equal(peticiones[0].opciones.body, esperada.opciones.body);
  });

  test('sends the previous conversation before the new question', async () => {
    const anterior = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: [{ type: 'text', text: 'b' }] },
    ];
    const { llamada, peticiones } = preparar([texto('c')], { mensajes: anterior });
    const resultado = await responder(llamada);
    assert.deepEqual(peticiones[0].cuerpo.messages, [
      ...anterior,
      { role: 'user', content: 'hola' },
    ]);
    assert.equal(resultado.mensajes.length, 4);
  });

  test('runs a tool and sends back the unchanged assistant turn with its result', async () => {
    const turno = [thinkingBlock(0), efectividadUso(1)];
    const { llamada, peticiones, eventos } = preparar([herramienta(turno), texto('×4')]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.equal(peticiones.length, 2);
    const [, asistente, usuario] = peticiones[1].cuerpo.messages;
    assert.deepEqual(asistente, {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '', signature: 'EqQBfirma' },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'efectividad_tipos',
          input: { atacante: 'electric', defensor: ['water', 'flying'] },
        },
      ],
    });
    assert.equal(usuario.role, 'user');
    assert.equal(usuario.content.length, 1);
    assert.equal(usuario.content[0].type, 'tool_result');
    assert.equal(usuario.content[0].tool_use_id, 'toolu_1');
    assert.equal('is_error' in usuario.content[0], false);
    assert.match(usuario.content[0].content, /"multiplicador": 4/);
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'herramienta'),
      [{ tipo: 'herramienta', nombre: 'efectividad_tipos' }],
    );
    assert.equal(resultado.mensajes.length, 4);
  });

  test('runs two tools in parallel and answers both in one user message, in order', async () => {
    const turno = [
      toolUseBlock(0, {
        id: 'toolu_1',
        name: 'obtener_pokemon',
        input: { nombre_o_id: 'gyarados' },
      }),
      toolUseBlock(1, { id: 'toolu_2', name: 'obtener_pokemon', input: { nombre_o_id: 'xyz' } }),
    ];
    const { llamada, peticiones, eventos } = preparar([herramienta(turno), texto('listo')]);
    await responder(llamada);
    const usuario = peticiones[1].cuerpo.messages[2];
    assert.deepEqual(
      usuario.content.map((r) => [r.tool_use_id, r.is_error ?? false]),
      [
        ['toolu_1', false],
        ['toolu_2', true],
      ],
    );
    assert.match(usuario.content[0].content, /^Pokémon gyarados \(#130\)\./);
    assert.equal(
      usuario.content[1].content,
      'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
    );
    assert.equal(eventos.filter((e) => e.tipo === 'herramienta').length, 2);
  });

  test('answers invalid input and invalid JSON as errors without calling PokéAPI', async () => {
    const turno = [
      toolUseBlock(0, {
        id: 'toolu_1',
        name: 'buscar_pokemon',
        input: { consulta: 'char', tamano_pagina: 51 },
      }),
      toolUseBlock(1, { id: 'toolu_2', name: 'naturalezas', json: '{"estadistica": "sp' }),
    ];
    const { llamada, peticiones, pokeApi } = preparar([herramienta(turno), texto('vale')]);
    await responder(llamada);
    const [asistente, usuario] = peticiones[1].cuerpo.messages.slice(1);
    assert.deepEqual(asistente.content[1], {
      type: 'tool_use',
      id: 'toolu_2',
      name: 'naturalezas',
      input: {},
    });
    assert.deepEqual(usuario.content, [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: 'tamano_pagina debe estar entre 1 y 50.',
        is_error: true,
      },
      {
        type: 'tool_result',
        tool_use_id: 'toolu_2',
        content: 'La entrada de la herramienta no es JSON válido.',
        is_error: true,
      },
    ]);
    assert.deepEqual(pokeApi.calls, []);
  });

  test('answers a tool that throws as an error', async () => {
    const { llamada, peticiones } = preparar([herramienta([efectividadUso()]), texto('vale')], {
      port: async () => {
        throw new Error('inesperado');
      },
    });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.deepEqual(peticiones[1].cuerpo.messages[2].content, [
      { type: 'tool_result', tool_use_id: 'toolu_1', content: MENSAJES.caida, is_error: true },
    ]);
  });

  test('stops after 8 tool iterations with exactly 9 requests and drops the question', async () => {
    const anterior = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: [{ type: 'text', text: 'b' }] },
    ];
    const respuestas = Array.from({ length: 10 }, (_, i) =>
      herramienta([toolUseBlock(0, { id: `toolu_${i}`, name: 'naturalezas', input: {} })]),
    );
    const { llamada, peticiones, eventos } = preparar(respuestas, { mensajes: anterior });
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 9);
    assert.equal(resultado.estado, 'limite');
    assert.deepEqual(resultado.mensajes, anterior);
    assert.equal(
      eventos.some((e) => e.tipo === 'uso'),
      false,
    );
  });

  test('a cut answer with a tool use runs nothing and is not incorporated', async () => {
    const { llamada, peticiones, pokeApi, eventos } = preparar([
      respuestaSse(
        mensaje({
          bloques: [
            textBlock(0, 'Voy'),
            toolUseBlock(1, { id: 't', name: 'naturalezas', json: '{"es' }),
          ],
          stopReason: 'max_tokens',
        }),
      ),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'cortada');
    assert.deepEqual(resultado.mensajes, []);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(pokeApi.calls, []);
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'uso'),
      [{ tipo: 'uso', uso: { entrada: 0, salida: 0 } }],
    );
  });

  test('a cut answer with only text is incorporated', async () => {
    const { llamada } = preparar([texto('Larga', { stopReason: 'max_tokens' })]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'cortada');
    assert.deepEqual(resultado.mensajes, [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: [{ type: 'text', text: 'Larga' }] },
    ]);
  });

  test('a refusal runs no tool and is not incorporated', async () => {
    const { llamada, peticiones } = preparar([
      herramienta([efectividadUso()], { stopReason: 'refusal' }),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'rechazo');
    assert.deepEqual(resultado.mensajes, []);
    assert.equal(peticiones.length, 1);
  });

  test('retries a 529 after 1 s and then shows the answer', async () => {
    const { llamada, peticiones, esperas } = preparar([
      respuestaError(529, 'overloaded_error'),
      texto('ok'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.equal(peticiones.length, 2);
    assert.deepEqual(esperas, [1000]);
  });

  test('retries a 429 after its retry-after', async () => {
    const { llamada, esperas } = preparar([
      respuestaError(429, 'rate_limit_error', 'lento', { 'retry-after': '3' }),
      texto('ok'),
    ]);
    await responder(llamada);
    assert.deepEqual(esperas, [3000]);
  });

  test('gives up after three 500 responses', async () => {
    const { llamada, peticiones, esperas } = preparar([
      respuestaError(500, 'api_error'),
      respuestaError(500, 'api_error'),
      respuestaError(500, 'api_error'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 3);
    assert.deepEqual(esperas, [1000, 2000]);
    assert.equal(resultado.estado, 'error');
    assert.deepEqual([resultado.error.codigo, resultado.error.estado], ['servidor', 500]);
    assert.deepEqual(resultado.mensajes, []);
  });

  test('does not retry a 401', async () => {
    const { llamada, peticiones, esperas, eventos } = preparar([
      respuestaError(401, 'authentication_error', 'invalid x-api-key'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(esperas, []);
    assert.equal(resultado.error.codigo, 'clave_invalida');
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'uso'),
      [],
    );
  });

  test('maps a network failure to red without retrying', async () => {
    const { llamada, peticiones } = preparar([new TypeError('Failed to fetch')]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 1);
    assert.equal(resultado.estado, 'error');
    assert.equal(resultado.error.codigo, 'red');
  });

  test('keeps the text received before a stream error and does not retry', async () => {
    const eventosSse = [
      messageStart(),
      ...textBlock(0, 'Hola').slice(0, 2),
      errorEvent('overloaded_error'),
    ];
    const { llamada, peticiones, eventos } = preparar([respuestaSse(eventosSse), texto('nunca')]);
    const resultado = await responder(llamada);
    assert.deepEqual(textos(eventos), ['Hola']);
    assert.equal(resultado.estado, 'error');
    assert.equal(resultado.error.codigo, 'saturado');
    assert.equal(peticiones.length, 1);
  });

  test('treats a stream that ends without a stop reason as a lost connection', async () => {
    const { llamada } = preparar([respuestaSse([messageStart(), ...textBlock(0, 'Ho')])]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'error');
    assert.equal(resultado.error.codigo, 'red');
    assert.equal(resultado.error.detalle, 'stream incompleto');
    assert.deepEqual(resultado.mensajes, []);
  });

  test('answers a malformed event as a server error', async () => {
    const roto = new Response('event: message_start\ndata: {roto\n\n');
    const { llamada, eventos } = preparar([roto]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'error');
    assert.deepEqual([resultado.error.codigo, resultado.error.estado], ['servidor', 500]);
    assert.deepEqual(eventos, []);
  });

  test('answers abortada when fetch rejects with an abort without a signal', async () => {
    const { llamada } = preparar([new DOMException('abortado', 'AbortError')]);
    assert.equal((await responder(llamada)).estado, 'abortada');
  });

  test('aborts in the middle of the stream', async () => {
    const controller = new AbortController();
    const primero = new TextEncoder().encode(
      serializar([
        messageStart(),
        blockStart(0, { type: 'text', text: '' }),
        blockDelta(0, { type: 'text_delta', text: 'Hola' }),
      ]),
    );
    const colgado = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(primero);
        },
        pull: () => new Promise(() => {}),
      }),
    );
    const { llamada, peticiones } = preparar([colgado, texto('nunca')], {
      signal: controller.signal,
      alEvento: (evento) => {
        if (evento.tipo === 'texto') controller.abort();
      },
    });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'abortada');
    assert.deepEqual(resultado.mensajes, []);
    assert.equal(peticiones.length, 1);
  });

  test('aborts while a tool runs', async () => {
    const controller = new AbortController();
    const { llamada, peticiones } = preparar([herramienta([efectividadUso()]), texto('nunca')], {
      signal: controller.signal,
      port: () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(controller.signal.reason));
          queueMicrotask(() => controller.abort());
        }),
    });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'abortada');
    assert.equal(peticiones.length, 1);
  });

  test('passes the signal to fetch and answers abortada when fetch rejects on abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const { llamada, peticiones } = preparar([new DOMException('abortado', 'AbortError')], {
      signal: controller.signal,
    });
    const resultado = await responder(llamada);
    assert.equal(peticiones[0].opciones.signal, controller.signal);
    assert.equal(resultado.estado, 'abortada');
  });

  test('adds up the usage of every request of the question, cache included', async () => {
    const { llamada } = preparar([
      herramienta([efectividadUso()], {
        usage: { input_tokens: 100, cache_creation_input_tokens: 50 },
        salida: { output_tokens: 20 },
      }),
      texto('×4', {
        usage: { input_tokens: 10, cache_read_input_tokens: 150 },
        salida: { output_tokens: 30 },
      }),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(resultado.uso, { entrada: 310, salida: 50 });
  });

  test('after a mid-turn fallback runs only the tool uses after it', async () => {
    const turno = [
      thinkingBlock(0),
      textBlock(1, 'Miro'),
      toolUseBlock(2, { id: 'toolu_0', name: 'naturalezas', input: {} }),
      fallbackBlock(3),
      thinkingBlock(4, 'otra'),
      efectividadUso(5, 'toolu_1'),
    ];
    const { llamada, peticiones, eventos } = preparar([herramienta(turno), texto('×4')]);
    await responder(llamada);
    const [asistente, usuario] = peticiones[1].cuerpo.messages.slice(1);
    assert.deepEqual(
      asistente.content.map((b) => b.type),
      ['text', 'fallback', 'thinking', 'tool_use'],
    );
    assert.deepEqual(
      usuario.content.map((r) => r.tool_use_id),
      ['toolu_1'],
    );
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'herramienta').map((e) => e.nombre),
      ['efectividad_tipos'],
    );
  });
});
