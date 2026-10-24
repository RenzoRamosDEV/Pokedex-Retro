import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { responder } from './bucle.js';
import { ENTRADA_NO_JSON } from './herramientas.js';
import { PROVEEDORES } from './proveedores/index.js';
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
import * as oa from '../../../tests/support/openai-sse.js';

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

/**
 * Fake provider whose turns come from a queue: the SSE events carry the visible text in `texto`
 * and a `falla` event throws a plain error, so the loop sees nothing of any real API format.
 */
function proveedorFalso(turnos, { reintentable = () => false } = {}) {
  return {
    construirPeticion: ({ modelo, clave, historial }) => ({
      url: 'https://falso.test/turno',
      opciones: { method: 'POST', body: JSON.stringify({ modelo, clave, historial }) },
    }),
    mensajeUsuario: (pregunta) => ({ pregunta }),
    crearLectura: () => ({
      aplicar({ evento, datos }) {
        if (evento === 'falla') throw new Error(datos.mensaje);
        return datos.texto ?? '';
      },
      terminar: () => turnos.shift(),
    }),
    resultados: (salidas) => salidas.map((salida) => ({ salida })),
    errorDeRespuesta: async (respuesta) =>
      Object.assign(new Error('respuesta'), {
        codigo: 'falso',
        estado: respuesta.status,
        reintentable: reintentable(respuesta.status),
      }),
    errorDeRed: (detalle) => Object.assign(new Error(detalle), { codigo: 'red_falsa', detalle }),
    diagnosticos: [],
    async errorDeConexion(datos) {
      this.diagnosticos.push(datos);
      return Object.assign(new Error(datos.detalle), {
        codigo: 'red_falsa',
        detalle: datos.detalle,
      });
    },
    errorDesconocido: (detalle) =>
      Object.assign(new Error(detalle), { codigo: 'desconocido', detalle }),
  };
}

const sse = (texto = '') => respuestaSse([{ event: 'parte', data: { type: 'parte', texto } }]);
const turnoFalso = (motivo, llamadas = [], uso = { entrada: 1, salida: 2 }) => ({
  motivo,
  historial: [{ salida: motivo }],
  llamadas,
  uso,
});
const llamadaNaturalezas = { id: 'c1', nombre: 'naturalezas', entrada: { estadistica: 'speed' } };

describe('responder with an injected provider', () => {
  test('builds the request from the provider and incorporates its turn', async () => {
    const proveedor = proveedorFalso([turnoFalso('fin')]);
    const { llamada, peticiones, eventos } = preparar([sse('Hola')], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(peticiones[0].url, 'https://falso.test/turno');
    assert.deepEqual(peticiones[0].cuerpo, {
      modelo: MODELO,
      clave: CLAVE,
      historial: [{ pregunta: 'hola' }],
    });
    assert.deepEqual(resultado, {
      estado: 'fin',
      mensajes: [{ pregunta: 'hola' }, { salida: 'fin' }],
      uso: { entrada: 1, salida: 2 },
    });
    assert.deepEqual(textos(eventos), ['Hola']);
  });

  test('retries when the provider says the error is retryable', async () => {
    const proveedor = proveedorFalso([turnoFalso('fin')], { reintentable: (s) => s === 418 });
    const { llamada, peticiones, esperas } = preparar([new Response('', { status: 418 }), sse()], {
      proveedor,
    });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.equal(peticiones.length, 2);
    assert.deepEqual(esperas, [1000]);
  });

  test('does not retry when the provider says the error is not retryable', async () => {
    const proveedor = proveedorFalso([], { reintentable: () => false });
    const { llamada, peticiones, esperas } = preparar([new Response('', { status: 503 })], {
      proveedor,
    });
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(esperas, []);
    assert.equal(resultado.estado, 'error');
    assert.deepEqual([resultado.error.codigo, resultado.error.estado], ['falso', 503]);
  });

  test('a network failure is diagnosed by the provider with the fetch, key and signal', async () => {
    const proveedor = proveedorFalso([]);
    const controller = new AbortController();
    const { llamada } = preparar([new TypeError('Failed to fetch')], {
      proveedor,
      signal: controller.signal,
    });
    const resultado = await responder(llamada);
    assert.deepEqual(
      [resultado.error.codigo, resultado.error.detalle],
      ['red_falsa', 'Failed to fetch'],
    );
    assert.equal(proveedor.diagnosticos.length, 1);
    const [{ fetch, clave, detalle, signal }] = proveedor.diagnosticos;
    assert.deepEqual(
      [fetch, clave, detalle, signal],
      [llamada.fetch, CLAVE, 'Failed to fetch', controller.signal],
    );
  });

  test('an aborted request is not diagnosed', async () => {
    const proveedor = proveedorFalso([]);
    const { llamada } = preparar([new DOMException('abortado', 'AbortError')], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'abortada');
    assert.deepEqual(proveedor.diagnosticos, []);
  });

  test('an unclassified error ends in errorDesconocido', async () => {
    const proveedor = proveedorFalso([]);
    const roto = respuestaSse([{ event: 'falla', data: { type: 'falla', mensaje: 'roto' } }]);
    const { llamada } = preparar([roto], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'error');
    assert.deepEqual([resultado.error.codigo, resultado.error.detalle], ['desconocido', 'roto']);
    assert.deepEqual(resultado.mensajes, []);
  });

  test('herramientas runs the calls and appends the provider results', async () => {
    const proveedor = proveedorFalso([
      turnoFalso('herramientas', [
        llamadaNaturalezas,
        { id: 'c2', nombre: 'naturalezas', entrada: ENTRADA_NO_JSON },
      ]),
      turnoFalso('fin', [], { entrada: 10, salida: 20 }),
    ]);
    const { llamada, peticiones, eventos } = preparar([sse(), sse('fin')], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 2);
    const [, turno, primera, segunda] = peticiones[1].cuerpo.historial;
    assert.deepEqual(turno, { salida: 'herramientas' });
    assert.equal(primera.salida.id, 'c1');
    assert.equal(primera.salida.esError, false);
    assert.match(primera.salida.contenido, /^8 naturalezas que suben o bajan speed\./);
    assert.deepEqual(segunda, {
      salida: {
        id: 'c2',
        contenido: 'La entrada de la herramienta no es JSON válido.',
        esError: true,
      },
    });
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'herramienta').map((e) => e.nombre),
      ['naturalezas', 'naturalezas'],
    );
    assert.equal(resultado.mensajes.length, 5);
    assert.deepEqual(resultado.uso, { entrada: 11, salida: 22 });
  });

  test('cortada with calls runs nothing and is not incorporated', async () => {
    const proveedor = proveedorFalso([turnoFalso('cortada', [llamadaNaturalezas])]);
    const { llamada, pokeApi, eventos } = preparar([sse()], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'cortada');
    assert.deepEqual(resultado.mensajes, []);
    assert.deepEqual(pokeApi.calls, []);
    assert.deepEqual(eventos.at(-1), { tipo: 'uso', uso: { entrada: 1, salida: 2 } });
  });

  test('cortada without calls is incorporated', async () => {
    const proveedor = proveedorFalso([turnoFalso('cortada')]);
    const { llamada } = preparar([sse()], { proveedor });
    const resultado = await responder(llamada);
    assert.deepEqual(resultado.mensajes, [{ pregunta: 'hola' }, { salida: 'cortada' }]);
  });

  test('rechazo runs nothing and is not incorporated', async () => {
    const proveedor = proveedorFalso([turnoFalso('rechazo', [llamadaNaturalezas])]);
    const { llamada, pokeApi } = preparar([sse()], { proveedor });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'rechazo');
    assert.deepEqual(resultado.mensajes, []);
    assert.deepEqual(pokeApi.calls, []);
  });
});

const oaTexto = (texto, uso = oa.usage()) =>
  oa.respuestaSse(
    oa.respuesta({ items: [oa.messageItem({ texto })], final: oa.responseCompleted(uso) }),
  );
const oaLlamadas = (items, final = oa.responseCompleted()) =>
  oa.respuestaSse(oa.respuesta({ items, final }));
const oaEfectividad = oa.functionCallItem({
  id: 'fc_1',
  callId: 'call_1',
  name: 'efectividad_tipos',
  args: { atacante: 'electric', defensor: ['water', 'flying'] },
});
/** Fake fetch for OpenAI that also accepts the bodiless diagnostic GET. */
function fetchOpenaiFalso(respuestas) {
  const peticiones = [];
  const fetch = async (url, opciones) => {
    const cuerpo = opciones.body === undefined ? undefined : JSON.parse(opciones.body);
    peticiones.push({ url, opciones, cuerpo });
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  };
  return { fetch, peticiones };
}

function prepararOpenai(respuestas, opciones = {}) {
  const falso = fetchOpenaiFalso(respuestas);
  const preparado = preparar([], {
    proveedor: PROVEEDORES.openai,
    modelo: 'gpt-6.1-sol',
    clave: 'sk-proj-prueba',
    fetch: falso.fetch,
    ...opciones,
  });
  return { ...preparado, peticiones: falso.peticiones };
}

const modelos = (status) => new Response(status === 200 ? '{"data":[]}' : '{}', { status });

describe('responder with OpenAI', () => {
  test('ends with the final text, incorporates the turn and reports the usage', async () => {
    const { llamada, peticiones, eventos } = prepararOpenai([
      oaTexto('Gyarados', oa.usage({ entrada: 7, cache: 2, salida: 3 })),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(resultado, {
      estado: 'fin',
      mensajes: [{ role: 'user', content: 'hola' }, oa.messageItem({ texto: 'Gyarados' })],
      uso: { entrada: 7, salida: 3 },
    });
    assert.equal(peticiones[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(peticiones[0].opciones.headers.authorization, 'Bearer sk-proj-prueba');
    assert.deepEqual(textos(eventos), ['Gyarados']);
    assert.deepEqual(eventos.at(-1), { tipo: 'uso', uso: { entrada: 7, salida: 3 } });
  });

  test('runs efectividad_tipos and sends back the identical items and its output', async () => {
    const razonamiento = oa.reasoningItem({ cifrado: 'gAAAA-razonamiento' });
    const { llamada, peticiones, eventos } = prepararOpenai([
      oaLlamadas(
        [razonamiento, oaEfectividad],
        oa.responseCompleted(oa.usage({ entrada: 100, cache: 40, salida: 20 })),
      ),
      oaTexto('×4', oa.usage({ entrada: 200, cache: 150, salida: 30 })),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.equal(peticiones.length, 2);
    const [pregunta, item1, item2, salida] = peticiones[1].cuerpo.input;
    assert.deepEqual(pregunta, { role: 'user', content: 'hola' });
    assert.deepEqual([item1, item2], [razonamiento, oaEfectividad]);
    assert.equal(salida.type, 'function_call_output');
    assert.equal(salida.call_id, 'call_1');
    assert.match(salida.output, /"multiplicador": 4/);
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'herramienta'),
      [{ tipo: 'herramienta', nombre: 'efectividad_tipos' }],
    );
    assert.deepEqual(resultado.uso, { entrada: 300, salida: 50 });
  });

  test('answers two obtener_pokemon calls in order, one of them failed', async () => {
    const { llamada, peticiones } = prepararOpenai([
      oaLlamadas([
        oa.functionCallItem({
          id: 'fc_1',
          callId: 'call_1',
          name: 'obtener_pokemon',
          args: { nombre_o_id: 'gyarados' },
        }),
        oa.functionCallItem({
          id: 'fc_2',
          callId: 'call_2',
          name: 'obtener_pokemon',
          args: { nombre_o_id: 'xyz' },
        }),
      ]),
      oaTexto('listo'),
    ]);
    await responder(llamada);
    const salidas = peticiones[1].cuerpo.input.slice(3);
    assert.deepEqual(
      salidas.map((s) => [s.type, s.call_id]),
      [
        ['function_call_output', 'call_1'],
        ['function_call_output', 'call_2'],
      ],
    );
    assert.match(salidas[0].output, /^Pokémon gyarados \(#130\)\./);
    assert.equal(
      salidas[1].output,
      'No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.',
    );
  });

  test('stops after 8 tool iterations with exactly 9 requests and drops the question', async () => {
    const anterior = [{ role: 'user', content: 'a' }, oa.messageItem({ texto: 'b' })];
    const respuestas = Array.from({ length: 10 }, (_, i) =>
      oaLlamadas([oa.functionCallItem({ callId: `call_${i}`, name: 'naturalezas' })]),
    );
    const { llamada, peticiones } = prepararOpenai(respuestas, { mensajes: anterior });
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 9);
    assert.equal(resultado.estado, 'limite');
    assert.deepEqual(resultado.mensajes, anterior);
  });

  test('a cut answer with a call runs nothing and is not incorporated', async () => {
    const { llamada, peticiones, pokeApi } = prepararOpenai([
      oaLlamadas([oaEfectividad], oa.responseIncomplete('max_output_tokens')),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'cortada');
    assert.deepEqual(resultado.mensajes, []);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(pokeApi.calls, []);
  });

  test('a refusal runs nothing and is not incorporated', async () => {
    const { llamada, pokeApi } = prepararOpenai([
      oaLlamadas([oa.messageItem({ rechazo: 'No.' }), oaEfectividad]),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'rechazo');
    assert.deepEqual(resultado.mensajes, []);
    assert.deepEqual(pokeApi.calls, []);
  });

  test('retries a rate limit 429 after 1 s and then shows the answer', async () => {
    const { llamada, peticiones, esperas } = prepararOpenai([
      oa.respuestaError(429, { type: 'requests', code: 'rate_limit_exceeded' }),
      oaTexto('ok'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'fin');
    assert.equal(peticiones.length, 2);
    assert.deepEqual(esperas, [1000]);
  });

  test('does not retry an insufficient_quota 429', async () => {
    const { llamada, peticiones, esperas } = prepararOpenai([
      oa.respuestaError(429, { type: 'insufficient_quota', code: 'insufficient_quota' }),
      oaTexto('nunca'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(esperas, []);
    assert.equal(resultado.error.codigo, 'sin_saldo');
  });

  test('gives up after three 503 responses', async () => {
    const { llamada, peticiones, esperas } = prepararOpenai([
      oa.respuestaError(503),
      oa.respuestaError(503),
      oa.respuestaError(503),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 3);
    assert.deepEqual(esperas, [1000, 2000]);
    assert.deepEqual([resultado.error.codigo, resultado.error.estado], ['saturado', 503]);
  });

  test('does not retry a 401', async () => {
    const { llamada, peticiones } = prepararOpenai([
      oa.respuestaError(401, { type: 'invalid_request_error', code: 'invalid_api_key' }),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 1);
    assert.deepEqual(
      [resultado.error.name, resultado.error.codigo],
      ['ErrorDeOpenAI', 'clave_invalida'],
    );
  });

  test('maps a network failure with a failed diagnosis to red', async () => {
    const { llamada, peticiones } = prepararOpenai([
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual([resultado.error.name, resultado.error.codigo], ['ErrorDeOpenAI', 'red']);
    assert.equal(peticiones.length, 2);
  });

  test('an unreadable failure with a 401 diagnosis is an invalid key, without retrying', async () => {
    const { llamada, peticiones, esperas } = prepararOpenai([
      new TypeError('Failed to fetch'),
      modelos(401),
      oaTexto('nunca'),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(
      peticiones.map((p) => [p.opciones.method, p.url]),
      [
        ['POST', 'https://api.openai.com/v1/responses'],
        ['GET', 'https://api.openai.com/v1/models'],
      ],
    );
    assert.equal(peticiones[1].opciones.headers.authorization, 'Bearer sk-proj-prueba');
    assert.deepEqual(esperas, []);
    assert.deepEqual([resultado.estado, resultado.error.codigo], ['error', 'clave_invalida']);
  });

  test('an unreadable failure with a 200 diagnosis is a rejection, without retrying', async () => {
    const { llamada, peticiones } = prepararOpenai([
      new TypeError('Failed to fetch'),
      modelos(200),
      oaTexto('nunca'),
    ]);
    const resultado = await responder(llamada);
    assert.equal(peticiones.length, 2);
    assert.equal(resultado.error.codigo, 'rechazada');
  });

  test('an abort is not diagnosed', async () => {
    const { llamada, peticiones } = prepararOpenai([
      new DOMException('abortado', 'AbortError'),
      modelos(401),
    ]);
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'abortada');
    assert.equal(peticiones.length, 1);
  });

  test('keeps the text received before response.failed and does not retry', async () => {
    const eventosSse = [
      oa.responseCreated(),
      oa.textDelta(0, 'Hola'),
      oa.responseFailed('server_error'),
    ];
    const { llamada, peticiones, eventos } = prepararOpenai([
      oa.respuestaSse(eventosSse),
      oaTexto('nunca'),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(textos(eventos), ['Hola']);
    assert.deepEqual([resultado.error.codigo, resultado.error.estado], ['servidor', 500]);
    assert.equal(peticiones.length, 1);
  });

  test('aborts in the middle of the stream', async () => {
    const controller = new AbortController();
    const primero = new TextEncoder().encode(
      oa.serializar([oa.responseCreated(), oa.textDelta(0, 'Hola')]),
    );
    const colgado = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(primero);
        },
        pull: () => new Promise(() => {}),
      }),
    );
    const { llamada, peticiones } = prepararOpenai([colgado, oaTexto('nunca')], {
      signal: controller.signal,
      alEvento: (evento) => {
        if (evento.tipo === 'texto') controller.abort();
      },
    });
    const resultado = await responder(llamada);
    assert.equal(resultado.estado, 'abortada');
    assert.equal(peticiones.length, 1);
  });

  test('aborts while a tool runs', async () => {
    const controller = new AbortController();
    const { llamada, peticiones } = prepararOpenai([oaLlamadas([oaEfectividad]), oaTexto('no')], {
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

  test('the next question resends the previous one, its items and outputs in order', async () => {
    const primera = prepararOpenai([oaLlamadas([oaEfectividad]), oaTexto('×4')]);
    const { mensajes } = await responder(primera.llamada);
    const segunda = prepararOpenai([oaTexto('vale')], { mensajes, pregunta: 'y otra' });
    await responder(segunda.llamada);
    const entrada = segunda.peticiones[0].cuerpo.input;
    assert.deepEqual(
      entrada.map((item) => item.type ?? item.role),
      ['user', 'function_call', 'function_call_output', 'message', 'user'],
    );
    assert.deepEqual(entrada.at(-1), { role: 'user', content: 'y otra' });
    assert.deepEqual(entrada[1], oaEfectividad);
  });
});
