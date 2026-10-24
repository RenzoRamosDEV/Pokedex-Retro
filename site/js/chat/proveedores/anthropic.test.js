import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anthropic } from './anthropic.js';
import { construirPeticion } from '../peticion.js';
import { bloquesParaHistorial } from '../historial.js';
import { DEFINICIONES, ENTRADA_NO_JSON } from '../herramientas.js';
import { PROFESOR } from '../agentes/profesor.js';
import { SUBAGENTES } from '../agentes/subagentes.js';
import {
  errorEvent,
  fallbackBlock,
  mensaje,
  messageStart,
  respuestaError,
  textBlock,
  thinkingBlock,
  toolUseBlock,
} from '../../../../tests/support/claude-sse.js';

/** Feeds the events to a fresh reading and returns the visible texts and the reading. */
function leer(eventos) {
  const lectura = anthropic.crearLectura();
  const textos = eventos.map(({ event, data }) => lectura.aplicar({ evento: event, datos: data }));
  return { textos, lectura };
}

const turno = (opciones) => leer(mensaje(opciones)).lectura.terminar();

const efectividad = (index, id = 'toolu_1') =>
  toolUseBlock(index, {
    id,
    name: 'efectividad_tipos',
    input: { atacante: 'electric', defensor: ['water', 'flying'] },
  });

describe('anthropic.construirPeticion', () => {
  test('is the Messages API request of peticion.js', () => {
    const datos = { modelo: 'claude-haiku-5-5', clave: 'sk-ant-x', historial: [{ role: 'user' }] };
    assert.deepEqual(
      anthropic.construirPeticion(datos),
      construirPeticion({
        modelo: datos.modelo,
        clave: datos.clave,
        mensajes: datos.historial,
        sistema: PROFESOR.sistema,
        herramientas: PROFESOR.herramientas,
      }),
    );
  });

  test('defaults to the main agent: its prompt and its 14 tools', () => {
    const datos = JSON.parse(
      anthropic.construirPeticion({ modelo: 'claude-haiku-5-5', clave: 'sk-ant-x', historial: [] })
        .opciones.body,
    );
    assert.equal(datos.system, PROFESOR.sistema);
    assert.deepEqual(
      datos.tools.map((t) => t.name),
      [...DEFINICIONES.map((d) => d.name), 'delegar_subagente', 'usar_skill'],
    );
  });

  for (const agente of [PROFESOR, ...SUBAGENTES]) {
    test(`${agente.nombre} sends its own prompt and tools with the scope rule`, () => {
      const datos = JSON.parse(
        anthropic.construirPeticion({
          modelo: 'claude-haiku-5-5',
          clave: 'sk-ant-x',
          historial: [],
          agente,
        }).opciones.body,
      );
      assert.equal(datos.system, agente.sistema);
      assert.deepEqual(datos.tools, JSON.parse(JSON.stringify(agente.herramientas)));
      assert.ok(datos.system.includes('Solo puedo responder preguntas sobre Pokémon.'));
    });
  }

  test('keeps the fallback header of the models that accept it', () => {
    const { opciones } = anthropic.construirPeticion({
      modelo: 'claude-opus-5-5',
      clave: 'sk-ant-x',
      historial: [],
    });
    assert.equal(opciones.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  });
});

describe('anthropic.mensajeUsuario', () => {
  test('is a user message with the question as text', () => {
    assert.deepEqual(anthropic.mensajeUsuario('hola'), { role: 'user', content: 'hola' });
  });
});

describe('anthropic.crearLectura', () => {
  test('returns the visible text of each event and ends with fin on end_turn', () => {
    const { textos, lectura } = leer(mensaje({ bloques: [textBlock(0, ['Gyara', 'dos'])] }));
    assert.deepEqual(
      textos.filter((t) => t !== ''),
      ['Gyara', 'dos'],
    );
    assert.deepEqual(lectura.terminar(), {
      motivo: 'fin',
      historial: [{ role: 'assistant', content: [{ type: 'text', text: 'Gyarados' }] }],
      llamadas: [],
      uso: { entrada: 0, salida: 0 },
    });
  });

  test('a stop reason other than the known ones ends as fin', () => {
    assert.equal(
      turno({ bloques: [textBlock(0, 'a')], stopReason: 'stop_sequence' }).motivo,
      'fin',
    );
  });

  test('tool_use ends with herramientas and the parsed calls', () => {
    const resultado = turno({
      bloques: [thinkingBlock(0), efectividad(1)],
      stopReason: 'tool_use',
    });
    assert.equal(resultado.motivo, 'herramientas');
    assert.deepEqual(resultado.llamadas, [
      {
        id: 'toolu_1',
        nombre: 'efectividad_tipos',
        entrada: { atacante: 'electric', defensor: ['water', 'flying'] },
      },
    ]);
  });

  test('max_tokens ends as cortada, with or without tool uses', () => {
    const conLlamada = turno({
      bloques: [
        textBlock(0, 'Voy'),
        toolUseBlock(1, { id: 't', name: 'naturalezas', json: '{"es' }),
      ],
      stopReason: 'max_tokens',
    });
    assert.equal(conLlamada.motivo, 'cortada');
    assert.equal(conLlamada.llamadas.length, 1);
    const sinLlamada = turno({ bloques: [textBlock(0, 'Larga')], stopReason: 'max_tokens' });
    assert.equal(sinLlamada.motivo, 'cortada');
    assert.deepEqual(sinLlamada.llamadas, []);
  });

  test('refusal ends as rechazo', () => {
    assert.equal(turno({ bloques: [efectividad(0)], stopReason: 'refusal' }).motivo, 'rechazo');
  });

  test('the history is the assistant turn of bloquesParaHistorial, mid-turn fallback included', () => {
    const bloques = [
      thinkingBlock(0),
      textBlock(1, 'Miro'),
      toolUseBlock(2, { id: 'toolu_0', name: 'naturalezas', input: {} }),
      fallbackBlock(3),
      thinkingBlock(4, 'otra'),
      efectividad(5, 'toolu_1'),
    ];
    const eventos = mensaje({ bloques, stopReason: 'tool_use' });
    const resultado = leer(eventos).lectura.terminar();
    const contenido = [
      { type: 'thinking', thinking: '', signature: 'EqQBfirma' },
      { type: 'text', text: 'Miro' },
      { type: 'tool_use', id: 'toolu_0', name: 'naturalezas', input: {} },
      { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } },
      { type: 'thinking', thinking: '', signature: 'otra' },
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'efectividad_tipos',
        input: { atacante: 'electric', defensor: ['water', 'flying'] },
      },
    ];
    assert.deepEqual(resultado.historial, [
      { role: 'assistant', content: bloquesParaHistorial(contenido) },
    ]);
    assert.deepEqual(
      resultado.historial[0].content.map((b) => b.type),
      ['text', 'fallback', 'thinking', 'tool_use'],
    );
    assert.deepEqual(
      resultado.llamadas.map((l) => l.id),
      ['toolu_1'],
    );
  });

  test('a tool use whose input does not parse is called with ENTRADA_NO_JSON', () => {
    const resultado = turno({
      bloques: [
        toolUseBlock(0, { id: 'toolu_1', name: 'buscar_pokemon', input: { consulta: 'char' } }),
        toolUseBlock(1, { id: 'toolu_2', name: 'naturalezas', json: '{"estadistica": "sp' }),
      ],
      stopReason: 'tool_use',
    });
    assert.deepEqual(resultado.llamadas, [
      { id: 'toolu_1', nombre: 'buscar_pokemon', entrada: { consulta: 'char' } },
      { id: 'toolu_2', nombre: 'naturalezas', entrada: ENTRADA_NO_JSON },
    ]);
    assert.deepEqual(resultado.historial[0].content[1], {
      type: 'tool_use',
      id: 'toolu_2',
      name: 'naturalezas',
      input: {},
    });
  });

  test('the usage adds input and both cache counts, and the output tokens', () => {
    const primero = turno({
      bloques: [efectividad(0)],
      stopReason: 'tool_use',
      usage: { input_tokens: 100, cache_creation_input_tokens: 50 },
      salida: { output_tokens: 20 },
    });
    const segundo = turno({
      bloques: [textBlock(0, '×4')],
      usage: { input_tokens: 10, cache_read_input_tokens: 150 },
      salida: { output_tokens: 30 },
    });
    assert.deepEqual(primero.uso, { entrada: 150, salida: 20 });
    assert.deepEqual(segundo.uso, { entrada: 160, salida: 30 });
    assert.equal(primero.uso.entrada + segundo.uso.entrada, 310);
    assert.equal(primero.uso.salida + segundo.uso.salida, 50);
  });

  test('a stream without a stop reason ends as a lost connection', () => {
    const { lectura } = leer([messageStart(), ...textBlock(0, 'Ho')]);
    assert.throws(() => lectura.terminar(), {
      name: 'ErrorDeClaude',
      codigo: 'red',
      estado: 0,
      detalle: 'stream incompleto',
    });
  });

  test('an error event throws the classified error', () => {
    const lectura = anthropic.crearLectura();
    const { event, data } = errorEvent('overloaded_error', 'Overloaded');
    assert.throws(() => lectura.aplicar({ evento: event, datos: data }), {
      name: 'ErrorDeClaude',
      codigo: 'saturado',
      estado: 529,
      detalle: 'Overloaded',
    });
  });

  test('an event that cannot apply throws a server error', () => {
    const lectura = anthropic.crearLectura();
    assert.throws(
      () =>
        lectura.aplicar({
          evento: 'content_block_delta',
          datos: { index: 3, delta: { type: 'text_delta', text: 'x' } },
        }),
      { name: 'ErrorDeClaude', codigo: 'servidor', estado: 500 },
    );
  });
});

describe('anthropic.resultados', () => {
  test('is a single user message with the tool results in order, is_error only when failed', () => {
    assert.deepEqual(
      anthropic.resultados([
        { id: 'toolu_1', contenido: 'Pokémon gyarados (#130).', esError: false },
        { id: 'toolu_2', contenido: 'No existe.', esError: true },
      ]),
      [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Pokémon gyarados (#130).' },
            { type: 'tool_result', tool_use_id: 'toolu_2', content: 'No existe.', is_error: true },
          ],
        },
      ],
    );
  });
});

describe('anthropic.errorDeRespuesta', () => {
  for (const estado of [429, 500, 529, 599]) {
    test(`${estado} is retried`, async () => {
      const error = await anthropic.errorDeRespuesta(respuestaError(estado, 'api_error', 'x'));
      assert.equal(error.reintentable, true);
      assert.equal(error.estado, estado);
      assert.equal(error.name, 'ErrorDeClaude');
    });
  }

  for (const [estado, codigo] of [
    [400, 'peticion'],
    [401, 'clave_invalida'],
    [403, 'permiso'],
    [404, 'servidor'],
    [413, 'demasiado_larga'],
  ]) {
    test(`${estado} is not retried and is ${codigo}`, async () => {
      const error = await anthropic.errorDeRespuesta(respuestaError(estado, 'x', 'mensaje'));
      assert.equal(error.reintentable, false);
      assert.equal(error.codigo, codigo);
      assert.equal(error.detalle, 'mensaje');
    });
  }
});

describe('anthropic errors', () => {
  test('errorDeRed is red', () => {
    const error = anthropic.errorDeRed('Failed to fetch');
    assert.deepEqual(
      [error.name, error.codigo, error.estado, error.detalle],
      ['ErrorDeClaude', 'red', 0, 'Failed to fetch'],
    );
  });

  test('errorDesconocido is a 500 server error', () => {
    const error = anthropic.errorDesconocido('roto');
    assert.deepEqual(
      [error.name, error.codigo, error.estado, error.detalle],
      ['ErrorDeClaude', 'servidor', 500, 'roto'],
    );
  });
});

describe('anthropic.errorDeConexion', () => {
  test('is the network error, without any extra request', async () => {
    const llamadas = [];
    const error = await anthropic.errorDeConexion({
      fetch: async (...args) => llamadas.push(args),
      clave: 'sk-ant-x',
      detalle: 'Failed to fetch',
    });
    assert.deepEqual(
      [error.name, error.codigo, error.estado, error.detalle],
      ['ErrorDeClaude', 'red', 0, 'Failed to fetch'],
    );
    assert.deepEqual(llamadas, []);
  });
});
