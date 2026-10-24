/**
 * Builders of Messages API streaming events in the documented SSE wire format, shared by the
 * chat unit tests and the e2e mock of api.anthropic.com.
 */

const encoder = new TextEncoder();

export const MODELO = 'claude-opus-5-5';

/** @param {string} type @param {object} [fields] */
const evento = (type, fields = {}) => ({ event: type, data: { type, ...fields } });

export const messageStart = ({ id = 'msg_1', model = MODELO, usage = {} } = {}) =>
  evento('message_start', {
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0, ...usage },
    },
  });

export const blockStart = (index, contentBlock) =>
  evento('content_block_start', { index, content_block: contentBlock });
export const blockDelta = (index, delta) => evento('content_block_delta', { index, delta });
export const blockStop = (index) => evento('content_block_stop', { index });
export const messageDelta = (stopReason, usage = {}) =>
  evento('message_delta', {
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage,
  });
export const messageStop = () => evento('message_stop');
export const ping = () => evento('ping');
export const errorEvent = (type, message = type) => evento('error', { error: { type, message } });

/** @param {number} index @param {string[] | string} partes */
export const textBlock = (index, partes) => [
  blockStart(index, { type: 'text', text: '' }),
  ...[partes].flat().map((text) => blockDelta(index, { type: 'text_delta', text })),
  blockStop(index),
];

/**
 * A tool_use block whose input streams as `input_json_delta` pieces of `json`
 * (by default the serialised `input`, cut in `piezas` parts).
 */
export const toolUseBlock = (index, { id, name, input = {}, json, piezas = 2 }) => {
  const texto = json ?? JSON.stringify(input);
  const tamano = Math.ceil(texto.length / piezas) || 1;
  const trozos = [];
  for (let i = 0; i < texto.length; i += tamano) trozos.push(texto.slice(i, i + tamano));
  return [
    blockStart(index, { type: 'tool_use', id, name, input: {} }),
    ...trozos.map((partial_json) => blockDelta(index, { type: 'input_json_delta', partial_json })),
    blockStop(index),
  ];
};

/** Thinking with the default `omitted` display: empty text and a signature. */
export const thinkingBlock = (index, signature = 'EqQBfirma') => [
  blockStart(index, { type: 'thinking', thinking: '', signature: '' }),
  blockDelta(index, { type: 'signature_delta', signature }),
  blockStop(index),
];

export const fallbackBlock = (index, from = MODELO, to = 'claude-opus-5') => [
  blockStart(index, { type: 'fallback', from: { model: from }, to: { model: to } }),
  blockStop(index),
];

/**
 * Every event of one streamed message.
 * @param {{ bloques: Array<Array<object>>, stopReason?: string, usage?: object, salida?: object, id?: string, model?: string }} options
 */
export const mensaje = ({ bloques, stopReason = 'end_turn', usage, salida = {}, id, model }) => [
  messageStart({ id, model, usage }),
  ...bloques.flat(),
  messageDelta(stopReason, salida),
  messageStop(),
];

/** @param {Array<{ event: string, data: object }>} eventos */
export const serializar = (eventos) =>
  eventos.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');

/**
 * Splits the UTF-8 bytes of `texto` at the given byte offsets.
 * @param {string} texto
 * @param {number[]} cortes
 */
export function trocear(texto, cortes = []) {
  const bytes = encoder.encode(texto);
  const limites = [0, ...cortes, bytes.length];
  return limites.slice(1).map((fin, i) => bytes.slice(limites[i], fin));
}

/**
 * A fetch Response streaming `eventos`; each chunk is enqueued on its own turn.
 * @param {Array<{ event: string, data: object }>} eventos
 * @param {{ cortes?: number[], status?: number }} [options]
 */
export function respuestaSse(eventos, { cortes = [], status = 200 } = {}) {
  const trozos = trocear(serializar(eventos), cortes);
  const body = new ReadableStream({
    async pull(controller) {
      await Promise.resolve();
      const trozo = trozos.shift();
      if (trozo === undefined) controller.close();
      else controller.enqueue(trozo);
    },
  });
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
}

/** A JSON error response as the API sends it. */
export function respuestaError(status, type, message = type, headers = {}) {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
