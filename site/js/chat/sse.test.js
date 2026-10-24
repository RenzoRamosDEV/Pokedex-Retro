import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEvento, crearLectorSse, crearMensaje } from './sse.js';
import {
  blockDelta,
  blockStart,
  blockStop,
  errorEvent,
  fallbackBlock,
  mensaje,
  messageDelta,
  messageStart,
  ping,
  serializar,
  textBlock,
  thinkingBlock,
  toolUseBlock,
  trocear,
} from '../../../tests/support/claude-sse.js';

const MUESTRA = mensaje({
  bloques: [
    thinkingBlock(0),
    textBlock(1, ['Gyara', 'dos ⚡ é']),
    toolUseBlock(2, { id: 'toolu_1', name: 'obtener_pokemon', input: { nombre_o_id: 'gyarados' } }),
  ],
  stopReason: 'tool_use',
  usage: { input_tokens: 100 },
  salida: { output_tokens: 20 },
});

/** @param {Uint8Array[]} trozos */
function leerTodo(trozos) {
  const lector = crearLectorSse();
  return trozos.flatMap((trozo) => lector.leer(trozo));
}

/** @param {Array<{ evento: string, datos: object }>} eventos */
function reconstruir(eventos) {
  const actual = crearMensaje();
  const textos = eventos.map((evento) => aplicarEvento(actual, evento));
  return { mensaje: actual, textos };
}

const esperado = MUESTRA.map(({ event, data }) => ({ evento: event, datos: data })).filter(
  ({ evento }) => evento !== 'ping',
);

describe('crearLectorSse', () => {
  test('reads every event of a stream in a single chunk', () => {
    assert.deepEqual(leerTodo(trocear(serializar(MUESTRA))), esperado);
  });

  test('yields the same events whatever byte the stream is cut at', () => {
    const texto = serializar(MUESTRA);
    const total = new TextEncoder().encode(texto).length;
    for (let corte = 1; corte < total; corte += 1) {
      assert.deepEqual(leerTodo(trocear(texto, [corte])), esperado, `corte en ${corte}`);
    }
  });

  test('rebuilds a delta cut in three chunks, one in the middle of a multibyte character', () => {
    const eventos = [
      blockStart(0, { type: 'text', text: '' }),
      blockDelta(0, { type: 'text_delta', text: '⚡é' }),
    ];
    const texto = serializar(eventos);
    const bytes = new TextEncoder().encode(texto);
    const rayo = bytes.indexOf(0xe2);
    const trozos = trocear(texto, [rayo - 10, rayo + 1]);
    assert.equal(trozos.length, 3);
    const { mensaje: unTrozo } = reconstruir(leerTodo(trocear(texto)));
    const { mensaje: tresTrozos } = reconstruir(leerTodo(trozos));
    assert.deepEqual(tresTrozos, unTrozo);
    assert.equal(tresTrozos.content[0].text, '⚡é');
  });

  test('accepts CRLF line endings', () => {
    const texto = serializar([ping(), messageStart()]).replaceAll('\n', '\r\n');
    assert.deepEqual(leerTodo(trocear(texto)), [
      { evento: 'message_start', datos: messageStart().data },
    ]);
  });

  test('joins several data lines with a newline', () => {
    const texto =
      'event: content_block_stop\ndata: {"type":\ndata: "content_block_stop","index":3}\n\n';
    assert.deepEqual(leerTodo(trocear(texto)), [
      { evento: 'content_block_stop', datos: { type: 'content_block_stop', index: 3 } },
    ]);
  });

  test('ignores comments and ping events', () => {
    const texto = `: keep-alive\n\n${serializar([ping(), blockStop(0)])}`;
    assert.deepEqual(leerTodo(trocear(texto)), [
      { evento: 'content_block_stop', datos: blockStop(0).data },
    ]);
  });

  test('keeps an unfinished event until its blank line arrives', () => {
    const lector = crearLectorSse();
    const [inicio, fin] = trocear(serializar([blockStop(1)]), [10]);
    assert.deepEqual(lector.leer(inicio), []);
    assert.deepEqual(lector.leer(fin), [
      { evento: 'content_block_stop', datos: blockStop(1).data },
    ]);
  });

  test('uses the type in the data when there is no event line', () => {
    const texto = 'data: {"type":"message_stop"}\n\n';
    assert.deepEqual(leerTodo(trocear(texto)), [
      { evento: 'message_stop', datos: { type: 'message_stop' } },
    ]);
  });
});

describe('aplicarEvento', () => {
  test('rebuilds every block of the sample message', () => {
    const { mensaje: actual } = reconstruir(esperado);
    assert.deepEqual(actual, {
      id: 'msg_1',
      model: 'claude-opus-5-5',
      content: [
        { type: 'thinking', thinking: '', signature: 'EqQBfirma' },
        { type: 'text', text: 'Gyarados ⚡ é' },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'obtener_pokemon',
          input: { nombre_o_id: 'gyarados' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 100, output_tokens: 20 },
    });
  });

  test('returns each visible text delta and nothing for the other events', () => {
    const { textos } = reconstruir(esperado);
    assert.deepEqual(
      textos.filter((texto) => texto !== ''),
      ['Gyara', 'dos ⚡ é'],
    );
    assert.equal(textos.length, esperado.length);
  });

  test('keeps the input of a tool_use without input deltas', () => {
    const { mensaje: actual } = reconstruir(
      [
        blockStart(0, { type: 'tool_use', id: 't', name: 'naturalezas', input: {} }),
        blockStop(0),
      ].map(({ event, data }) => ({ evento: event, datos: data })),
    );
    assert.deepEqual(actual.content[0], {
      type: 'tool_use',
      id: 't',
      name: 'naturalezas',
      input: {},
    });
  });

  test('marks a tool_use whose input is not valid JSON with its raw text', () => {
    const eventos = toolUseBlock(0, { id: 't', name: 'naturalezas', json: '{"estadistica": "att' });
    const { mensaje: actual } = reconstruir(
      eventos.map(({ event, data }) => ({ evento: event, datos: data })),
    );
    assert.deepEqual(actual.content[0], {
      type: 'tool_use',
      id: 't',
      name: 'naturalezas',
      input: {},
      entrada_invalida: '{"estadistica": "att',
    });
  });

  test('copies a fallback block as it comes', () => {
    const eventos = fallbackBlock(0).map(({ event, data }) => ({ evento: event, datos: data }));
    const { mensaje: actual } = reconstruir(eventos);
    assert.deepEqual(actual.content, [
      { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } },
    ]);
  });

  test('does not share the block object of the event', () => {
    const inicio = blockStart(0, { type: 'text', text: '' });
    const actual = crearMensaje();
    aplicarEvento(actual, { evento: inicio.event, datos: inicio.data });
    aplicarEvento(actual, {
      evento: 'content_block_delta',
      datos: blockDelta(0, { type: 'text_delta', text: 'a' }).data,
    });
    assert.equal(inicio.data.content_block.text, '');
  });

  test('merges the usage of message_delta into the usage of message_start', () => {
    const actual = crearMensaje();
    for (const { event, data } of [
      messageStart({ usage: { input_tokens: 10, cache_read_input_tokens: 150 } }),
      messageDelta('end_turn', { output_tokens: 30 }),
    ]) {
      aplicarEvento(actual, { evento: event, datos: data });
    }
    assert.deepEqual(actual.usage, {
      input_tokens: 10,
      output_tokens: 30,
      cache_read_input_tokens: 150,
    });
    assert.equal(actual.stop_reason, 'end_turn');
  });

  test('throws the error type of an error event', () => {
    const { event, data } = errorEvent('overloaded_error', 'Overloaded');
    assert.throws(() => aplicarEvento(crearMensaje(), { evento: event, datos: data }), {
      name: 'ErrorDeStream',
      tipo: 'overloaded_error',
      message: 'Overloaded',
    });
  });

  test('starts an empty message', () => {
    assert.deepEqual(crearMensaje(), {
      id: null,
      model: null,
      content: [],
      stop_reason: null,
      usage: {},
    });
  });

  test('appends thinking deltas without returning visible text', () => {
    const actual = crearMensaje();
    const aplicar = ({ event, data }) => aplicarEvento(actual, { evento: event, datos: data });
    aplicar(blockStart(0, { type: 'thinking', thinking: '', signature: '' }));
    const devueltos = ['Pienso', ' algo'].map((thinking) =>
      aplicar(blockDelta(0, { type: 'thinking_delta', thinking })),
    );
    assert.deepEqual(devueltos, ['', '']);
    assert.equal(actual.content[0].thinking, 'Pienso algo');
  });

  test('ignores an unknown event', () => {
    const actual = crearMensaje();
    assert.equal(aplicarEvento(actual, { evento: 'novedad', datos: { type: 'novedad' } }), '');
    assert.deepEqual(actual, crearMensaje());
  });

  test('ignores a delta of an unknown type', () => {
    const actual = crearMensaje();
    aplicarEvento(actual, {
      evento: 'content_block_start',
      datos: blockStart(0, { type: 'text', text: 'a' }).data,
    });
    const devuelto = aplicarEvento(actual, {
      evento: 'content_block_delta',
      datos: blockDelta(0, { type: 'citations_delta' }).data,
    });
    assert.equal(devuelto, '');
    assert.deepEqual(actual.content, [{ type: 'text', text: 'a' }]);
  });
});
