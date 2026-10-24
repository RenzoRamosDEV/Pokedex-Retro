import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { responder } from './bucle.js';
import { ENTRADA_NO_JSON } from './herramientas.js';
import { PROVEEDORES } from './proveedores/index.js';
import { construirPeticion } from './peticion.js';
import { MENSAJES } from '../core/mensajes.js';
import { PROFESOR } from './agentes/profesor.js';
import { SKILLS } from './agentes/skills.js';
import { SUBAGENTES } from './agentes/subagentes.js';
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

const RESPUESTA_FIJA = 'Solo puedo responder preguntas sobre Pokémon.';

/** The same scenarios written once for both providers. */
const DELEGACION = {
  anthropic: {
    preparar: (respuestas, opciones = {}) => preparar(respuestas, opciones),
    modelo: MODELO,
    clave: CLAVE,
    texto: (t, { entrada = 0, salida = 0 } = {}) =>
      texto(t, { usage: { input_tokens: entrada }, salida: { output_tokens: salida } }),
    llamadas: (llamadas, { entrada = 0, salida = 0 } = {}) =>
      herramienta(
        llamadas.map(({ id, name, args }, i) => toolUseBlock(i, { id, name, input: args })),
        { usage: { input_tokens: entrada }, salida: { output_tokens: salida } },
      ),
    rechazo: () => respuestaSse(mensaje({ bloques: [textBlock(0, 'No.')], stopReason: 'refusal' })),
    cortada: (t) => respuestaSse(mensaje({ bloques: [textBlock(0, t)], stopReason: 'max_tokens' })),
    cortadaConLlamada: ({ id, name, args }) =>
      respuestaSse(
        mensaje({
          bloques: [textBlock(0, 'Consulto'), toolUseBlock(1, { id, name, input: args })],
          stopReason: 'max_tokens',
        }),
      ),
    noAutorizada: () => respuestaError(401, 'authentication_error', 'invalid x-api-key'),
    sistema: (cuerpo) => cuerpo.system,
    entrada: (cuerpo) => cuerpo.messages,
    claveEnviada: (peticion) => peticion.opciones.headers['x-api-key'],
    salidas: (cuerpo) =>
      cuerpo.messages.at(-1).content.map((b) => ({ id: b.tool_use_id, contenido: b.content })),
  },
  openai: {
    preparar: (respuestas, opciones = {}) =>
      preparar(respuestas, {
        proveedor: PROVEEDORES.openai,
        modelo: 'gpt-6.1-sol',
        clave: 'sk-proj-prueba',
        ...opciones,
      }),
    modelo: 'gpt-6.1-sol',
    clave: 'sk-proj-prueba',
    texto: (t, { entrada = 0, salida = 0 } = {}) => oaTexto(t, oa.usage({ entrada, salida })),
    llamadas: (llamadas, { entrada = 0, salida = 0 } = {}) =>
      oaLlamadas(
        llamadas.map(({ id, name, args, json }, i) =>
          oa.functionCallItem({ id: `fc_${i}`, callId: id, name, args, json }),
        ),
        oa.responseCompleted(oa.usage({ entrada, salida })),
      ),
    rechazo: () => oaLlamadas([oa.messageItem({ rechazo: 'No.' })]),
    cortada: (t) =>
      oaLlamadas([oa.messageItem({ texto: t })], oa.responseIncomplete('max_output_tokens')),
    cortadaConLlamada: ({ id, name, args }) =>
      oaLlamadas(
        [oa.functionCallItem({ id: 'fc_0', callId: id, name, args })],
        oa.responseIncomplete('max_output_tokens'),
      ),
    noAutorizada: () =>
      oa.respuestaError(401, { type: 'invalid_request_error', code: 'invalid_api_key' }),
    sistema: (cuerpo) => cuerpo.instructions,
    entrada: (cuerpo) => cuerpo.input,
    claveEnviada: (peticion) => peticion.opciones.headers.authorization.replace('Bearer ', ''),
    salidas: (cuerpo) =>
      cuerpo.input
        .filter((item) => item.type === 'function_call_output')
        .map((item) => ({ id: item.call_id, contenido: item.output })),
  },
};

const delegar = (subagente, tarea, id = 'call_d') => ({
  id,
  name: 'delegar_subagente',
  args: { subagente, tarea },
});
const efectividad = (id = 'call_e') => ({
  id,
  name: 'efectividad_tipos',
  args: { atacante: 'electric', defensor: ['water', 'flying'] },
});
const subagenteLlamado = (nombre) => SUBAGENTES.find((s) => s.nombre === nombre);
const deAgente = (P, agente, peticiones) =>
  peticiones.filter((p) => P.sistema(p.cuerpo) === agente.sistema);

for (const [nombreProveedor, P] of Object.entries(DELEGACION)) {
  describe(`responder delegating with ${nombreProveedor}`, () => {
    test('delegates a task, returns the subagent text as the tool result and shows only the main text', async () => {
      const estratega = subagenteLlamado('estratega-tipos');
      const { llamada, peticiones, eventos } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'debilidades de gyarados')]),
        P.llamadas([efectividad()]),
        P.texto('Gyarados es débil a electric (x4) y rock.'),
        P.texto('Evita electric.'),
      ]);
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'fin');
      assert.equal(peticiones.length, 4);
      const [primera, sub1, sub2, segunda] = peticiones;
      for (const p of [primera, segunda]) assert.equal(P.sistema(p.cuerpo), PROFESOR.sistema);
      for (const p of [sub1, sub2]) {
        assert.equal(P.sistema(p.cuerpo), estratega.sistema);
        assert.equal(p.cuerpo.model, P.modelo);
        assert.equal(P.claveEnviada(p), P.clave);
        assert.equal(p.url, primera.url);
        assert.deepEqual(
          p.cuerpo.tools.map((t) => t.name),
          estratega.herramientas.map((t) => t.name),
        );
      }
      assert.deepEqual(P.entrada(sub1.cuerpo)[0], {
        role: 'user',
        content: 'debilidades de gyarados',
      });
      assert.deepEqual(P.salidas(sub2.cuerpo).length, 1);
      assert.match(P.salidas(sub2.cuerpo)[0].contenido, /"multiplicador": 4/);
      assert.deepEqual(P.salidas(segunda.cuerpo), [
        { id: 'call_d', contenido: 'Gyarados es débil a electric (x4) y rock.' },
      ]);
      assert.deepEqual(textos(eventos), ['Evita electric.']);
      assert.deepEqual(
        eventos.filter((e) => e.tipo !== 'texto' && e.tipo !== 'uso'),
        [{ tipo: 'subagente', nombre: 'estratega-tipos' }],
      );
    });

    test('accepts a 2000-character task', async () => {
      const tarea = 't'.repeat(2000);
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('investigador-pokedex', tarea)]),
        P.texto('hecho'),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.equal(peticiones.length, 3);
      assert.deepEqual(P.entrada(peticiones[1].cuerpo)[0], { role: 'user', content: tarea });
    });

    test('loads a skill without PokéAPI and returns its instructions', async () => {
      const skill = SKILLS.find((s) => s.nombre === 'analizar-debilidades');
      const { llamada, peticiones, eventos, pokeApi } = P.preparar([
        P.llamadas([
          { id: 'call_s', name: 'usar_skill', args: { nombre: 'analizar-debilidades' } },
        ]),
        P.texto('listo'),
      ]);
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'fin');
      assert.deepEqual(pokeApi.calls, []);
      assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
        { id: 'call_s', contenido: skill.instrucciones },
      ]);
      assert.deepEqual(
        eventos.filter((e) => e.tipo === 'skill' || e.tipo === 'herramienta'),
        [{ tipo: 'skill', nombre: 'analizar-debilidades' }],
      );
    });

    test('an unknown skill is an error and emits no skill event', async () => {
      const { llamada, peticiones, eventos } = P.preparar([
        P.llamadas([{ id: 'call_s', name: 'usar_skill', args: { nombre: 'cocinar' } }]),
        P.texto('listo'),
      ]);
      await responder(llamada);
      assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
        {
          id: 'call_s',
          contenido:
            'nombre debe ser uno de: comparar-pokemon, equipo-contra-tipo, analizar-debilidades, recomendar-naturaleza.',
        },
      ]);
      assert.deepEqual(
        eventos.filter((e) => e.tipo === 'skill'),
        [],
      );
    });

    test('runs a delegation and obtener_pokemon in parallel and answers them in call order', async () => {
      const { llamada, peticiones, eventos } = P.preparar([
        P.llamadas([
          delegar('investigador-pokedex', 'ficha de gyarados'),
          { id: 'call_p', name: 'obtener_pokemon', args: { nombre_o_id: 'gyarados' } },
        ]),
        P.texto('Gyarados es water/flying.'),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.equal(peticiones.length, 3);
      const salidas = P.salidas(peticiones[2].cuerpo);
      assert.deepEqual(
        salidas.map((s) => s.id),
        ['call_d', 'call_p'],
      );
      assert.equal(salidas[0].contenido, 'Gyarados es water/flying.');
      assert.match(salidas[1].contenido, /Pokémon gyarados \(#130\)\./);
      assert.deepEqual(
        eventos.filter((e) => e.tipo === 'subagente' || e.tipo === 'herramienta'),
        [
          { tipo: 'subagente', nombre: 'investigador-pokedex' },
          { tipo: 'herramienta', nombre: 'obtener_pokemon' },
        ],
      );
    });

    test('a subagent cannot delegate: the call is an unknown tool', async () => {
      const investigador = subagenteLlamado('investigador-pokedex');
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('investigador-pokedex', 'busca')]),
        P.llamadas([delegar('estratega-tipos', 'otra', 'call_x')]),
        P.texto('nada'),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.equal(peticiones.length, 4);
      assert.equal(deAgente(P, investigador, peticiones).length, 2);
      assert.deepEqual(P.salidas(peticiones[2].cuerpo), [
        { id: 'call_x', contenido: 'Herramienta desconocida: delegar_subagente.' },
      ]);
    });

    test('a subagent cannot run a tool outside its list', async () => {
      const { llamada, peticiones, pokeApi } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'naturalezas')]),
        P.llamadas([{ id: 'call_n', name: 'naturalezas', args: {} }]),
        P.texto('sin datos'),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.deepEqual(pokeApi.calls, []);
      assert.deepEqual(P.salidas(peticiones[2].cuerpo), [
        { id: 'call_n', contenido: 'Herramienta desconocida: naturalezas.' },
      ]);
    });

    test('a subagent that never ends stops after 7 requests and the main agent goes on', async () => {
      const entrenador = subagenteLlamado('entrenador-equipos');
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('entrenador-equipos', 'equipo')]),
        ...Array.from({ length: 7 }, (_, i) => P.llamadas([efectividad(`call_${i}`)])),
        P.texto('Sin equipo.'),
        P.texto('nunca'),
      ]);
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'fin');
      assert.equal(deAgente(P, entrenador, peticiones).length, 7);
      assert.equal(peticiones.length, 9);
      assert.deepEqual(P.salidas(peticiones[8].cuerpo), [
        {
          id: 'call_d',
          contenido: 'El subagente entrenador-equipos alcanzó el límite de consultas.',
        },
      ]);
    });

    test('subagent requests do not count for the main limit of 9 requests', async () => {
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'algo')]),
        P.texto('hecho'),
        ...Array.from({ length: 8 }, (_, i) => P.llamadas([efectividad(`call_${i}`)])),
        P.texto('nunca'),
      ]);
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'limite');
      assert.equal(deAgente(P, PROFESOR, peticiones).length, 9);
      assert.equal(peticiones.length, 10);
    });

    for (const [caso, final, mensaje] of [
      [
        'a refusal',
        () => P.rechazo(),
        'El subagente estratega-tipos no puede responder a esta tarea.',
      ],
      ['an empty text', () => P.texto(''), 'El subagente estratega-tipos no terminó su respuesta.'],
      [
        'a cut answer with calls',
        () => P.cortadaConLlamada(efectividad()),
        'El subagente estratega-tipos no terminó su respuesta.',
      ],
    ]) {
      test(`a subagent ending in ${caso} returns an error to the main agent`, async () => {
        const { llamada, peticiones, pokeApi } = P.preparar([
          P.llamadas([delegar('estratega-tipos', 'algo')]),
          final(),
          P.texto('fin'),
        ]);
        const resultado = await responder(llamada);
        assert.equal(resultado.estado, 'fin');
        assert.equal(peticiones.length, 3);
        assert.deepEqual(pokeApi.calls, []);
        assert.deepEqual(P.salidas(peticiones[2].cuerpo), [{ id: 'call_d', contenido: mensaje }]);
      });
    }

    test('a cut subagent answer without calls returns its text', async () => {
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'algo')]),
        P.cortada('Texto a medias'),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.deepEqual(P.salidas(peticiones[2].cuerpo), [
        { id: 'call_d', contenido: 'Texto a medias' },
      ]);
    });

    test('an invalid delegation makes no extra request', async () => {
      const { llamada, peticiones, eventos } = P.preparar([
        P.llamadas([delegar('chef', 'ataques de pikachu')]),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.equal(peticiones.length, 2);
      assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
        {
          id: 'call_d',
          contenido:
            'subagente debe ser uno de: estratega-tipos, entrenador-equipos, investigador-pokedex.',
        },
      ]);
      assert.deepEqual(
        eventos.filter((e) => e.tipo === 'subagente'),
        [],
      );
    });

    test('a blank task makes no extra request', async () => {
      const { llamada, peticiones } = P.preparar([
        P.llamadas([delegar('estratega-tipos', '   ')]),
        P.texto('fin'),
      ]);
      await responder(llamada);
      assert.equal(peticiones.length, 2);
      assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
        { id: 'call_d', contenido: 'tarea debe tener entre 1 y 2000 caracteres.' },
      ]);
    });

    test('a 401 in the subagent ends the whole question without incorporating it', async () => {
      const { llamada, peticiones, eventos } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'algo')]),
        P.noAutorizada(),
        P.texto('nunca'),
      ]);
      const resultado = await responder(llamada);
      assert.equal(peticiones.length, 2);
      assert.equal(P.sistema(peticiones[1].cuerpo), subagenteLlamado('estratega-tipos').sistema);
      assert.equal(resultado.estado, 'error');
      assert.equal(resultado.error.codigo, 'clave_invalida');
      assert.deepEqual(resultado.mensajes, []);
      assert.deepEqual(
        eventos.filter((e) => e.tipo === 'uso'),
        [],
      );
    });

    test('stopping while a subagent request is held aborts it and makes no other request', async () => {
      const controller = new AbortController();
      const retenida = (opciones) =>
        new Promise((_, reject) => {
          opciones.signal.addEventListener('abort', () =>
            reject(new DOMException('abortado', 'AbortError')),
          );
          queueMicrotask(() => controller.abort());
        });
      const { llamada, peticiones } = P.preparar(
        [P.llamadas([delegar('estratega-tipos', 'algo')]), retenida, P.texto('nunca')],
        { signal: controller.signal },
      );
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'abortada');
      assert.equal(peticiones.length, 2);
      assert.equal(P.sistema(peticiones[1].cuerpo), subagenteLlamado('estratega-tipos').sistema);
      assert.equal(peticiones[1].opciones.signal, controller.signal);
      assert.deepEqual(resultado.mensajes, []);
    });

    test('adds the usage of the subagent requests to the question', async () => {
      const { llamada, eventos } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'algo')], { entrada: 100, salida: 20 }),
        P.llamadas([efectividad()], { entrada: 50, salida: 10 }),
        P.texto('sub', { entrada: 60, salida: 15 }),
        P.texto('fin', { entrada: 200, salida: 30 }),
      ]);
      const resultado = await responder(llamada);
      assert.deepEqual(resultado.uso, { entrada: 410, salida: 75 });
      assert.deepEqual(eventos.at(-1), { tipo: 'uso', uso: { entrada: 410, salida: 75 } });
    });

    test('adds the usage of a subagent that ends in a refusal', async () => {
      const { llamada } = P.preparar([
        P.llamadas([delegar('estratega-tipos', 'algo')], { entrada: 1, salida: 1 }),
        P.llamadas([efectividad()], { entrada: 5, salida: 2 }),
        P.rechazo(),
        P.texto('fin', { entrada: 3, salida: 4 }),
      ]);
      const resultado = await responder(llamada);
      assert.deepEqual(resultado.uso, { entrada: 9, salida: 7 });
    });

    test('an off-topic question gets the fixed answer with one request and no PokéAPI call', async () => {
      const { llamada, peticiones, pokeApi } = P.preparar(
        [P.texto(RESPUESTA_FIJA, { entrada: 5, salida: 2 })],
        { pregunta: '¿Cuál es la capital de Francia?' },
      );
      const resultado = await responder(llamada);
      assert.equal(resultado.estado, 'fin');
      assert.equal(peticiones.length, 1);
      assert.deepEqual(pokeApi.calls, []);
      assert.ok(P.sistema(peticiones[0].cuerpo).includes(RESPUESTA_FIJA));
      assert.deepEqual(resultado.uso, { entrada: 5, salida: 2 });
    });
  });
}

describe('responder delegating, provider details', () => {
  test('Claude: usage with cache from a subagent adds up', async () => {
    const { llamada } = preparar([
      herramienta(
        [
          toolUseBlock(0, {
            id: 'call_d',
            name: 'delegar_subagente',
            input: { subagente: 'estratega-tipos', tarea: 'x' },
          }),
        ],
        { usage: { input_tokens: 100 }, salida: { output_tokens: 20 } },
      ),
      texto('sub', {
        usage: { input_tokens: 40, cache_creation_input_tokens: 10 },
        salida: { output_tokens: 5 },
      }),
      texto('fin', {
        usage: { input_tokens: 10, cache_read_input_tokens: 150 },
        salida: { output_tokens: 30 },
      }),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(resultado.uso, { entrada: 310, salida: 55 });
  });

  test('Claude: a failed delegation is flagged as an error result', async () => {
    const { llamada, peticiones } = preparar([
      herramienta([
        toolUseBlock(0, {
          id: 'call_d',
          name: 'delegar_subagente',
          input: { subagente: 'chef', tarea: 'x' },
        }),
      ]),
      texto('fin'),
    ]);
    await responder(llamada);
    assert.equal(peticiones[1].cuerpo.messages.at(-1).content[0].is_error, true);
  });

  test('Claude: a successful delegation is not flagged as an error', async () => {
    const { llamada, peticiones } = preparar([
      herramienta([
        toolUseBlock(0, {
          id: 'call_d',
          name: 'delegar_subagente',
          input: { subagente: 'estratega-tipos', tarea: 'x' },
        }),
      ]),
      texto('dato'),
      texto('fin'),
    ]);
    await responder(llamada);
    assert.equal('is_error' in peticiones[2].cuerpo.messages.at(-1).content[0], false);
  });

  test('OpenAI: usage of a subagent adds up', async () => {
    const P = DELEGACION.openai;
    const { llamada } = P.preparar([
      P.llamadas([delegar('estratega-tipos', 'x')], { entrada: 100, salida: 20 }),
      P.texto('sub', { entrada: 70, salida: 9 }),
      P.texto('fin', { entrada: 200, salida: 30 }),
    ]);
    const resultado = await responder(llamada);
    assert.deepEqual(resultado.uso, { entrada: 370, salida: 59 });
  });

  test('OpenAI: a null skill name is an error with the same message', async () => {
    const P = DELEGACION.openai;
    const { llamada, peticiones } = P.preparar([
      P.llamadas([{ id: 'call_s', name: 'usar_skill', json: '{"nombre":null}' }]),
      P.texto('fin'),
    ]);
    await responder(llamada);
    assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
      {
        id: 'call_s',
        contenido:
          'nombre debe ser uno de: comparar-pokemon, equipo-contra-tipo, analizar-debilidades, recomendar-naturaleza.',
      },
    ]);
  });

  test('OpenAI: delegation arguments that are not JSON are an error without a subagent', async () => {
    const P = DELEGACION.openai;
    const { llamada, peticiones } = P.preparar([
      P.llamadas([{ id: 'call_d', name: 'delegar_subagente', json: '{"subagente":' }]),
      P.texto('fin'),
    ]);
    await responder(llamada);
    assert.equal(peticiones.length, 2);
    assert.deepEqual(P.salidas(peticiones[1].cuerpo), [
      { id: 'call_d', contenido: 'La entrada de la herramienta no es JSON válido.' },
    ]);
  });

  test('Claude: a call outside the agent list is flagged as an error result', async () => {
    const { llamada, peticiones } = preparar([
      herramienta([
        toolUseBlock(0, {
          id: 'call_d',
          name: 'delegar_subagente',
          input: { subagente: 'estratega-tipos', tarea: 'x' },
        }),
      ]),
      herramienta([toolUseBlock(0, { id: 'call_n', name: 'naturalezas', input: {} })]),
      texto('dato'),
      texto('fin'),
    ]);
    await responder(llamada);
    assert.deepEqual(peticiones[2].cuerpo.messages.at(-1).content, [
      {
        type: 'tool_result',
        tool_use_id: 'call_n',
        content: 'Herramienta desconocida: naturalezas.',
        is_error: true,
      },
    ]);
  });

  test('Claude: a skill input that is not JSON is flagged as an error result', async () => {
    const { llamada, peticiones, eventos } = preparar([
      herramienta([toolUseBlock(0, { id: 'call_s', name: 'usar_skill', json: '{"nombre":' })]),
      texto('fin'),
    ]);
    await responder(llamada);
    assert.deepEqual(peticiones[1].cuerpo.messages.at(-1).content, [
      {
        type: 'tool_result',
        tool_use_id: 'call_s',
        content: 'La entrada de la herramienta no es JSON válido.',
        is_error: true,
      },
    ]);
    assert.deepEqual(
      eventos.filter((e) => e.tipo === 'skill'),
      [],
    );
  });
});
