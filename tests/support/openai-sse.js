/**
 * Builders of Responses API streaming events in the documented SSE wire format, shared by the
 * chat unit tests and the e2e mock of api.openai.com.
 */

export { respuestaSse, serializar, trocear } from './claude-sse.js';

export const MODELO = 'gpt-6.1-sol';

/** @param {string} type @param {object} [fields] */
const evento = (type, fields = {}) => ({ event: type, data: { type, ...fields } });

/** @param {{ entrada?: number, cache?: number, salida?: number, razonamiento?: number }} [tokens] */
export const usage = ({ entrada = 0, cache = 0, salida = 0, razonamiento = 0 } = {}) => ({
  input_tokens: entrada,
  input_tokens_details: { cached_tokens: cache },
  output_tokens: salida,
  output_tokens_details: { reasoning_tokens: razonamiento },
  total_tokens: entrada + salida,
});

const respuestaBase = (id, status, extra = {}) => ({
  id,
  object: 'response',
  status,
  model: MODELO,
  ...extra,
});

export const responseCreated = (id = 'resp_1') =>
  evento('response.created', { response: respuestaBase(id, 'in_progress', { output: [] }) });
export const responseInProgress = (id = 'resp_1') =>
  evento('response.in_progress', { response: respuestaBase(id, 'in_progress', { output: [] }) });

export const itemAdded = (outputIndex, item) =>
  evento('response.output_item.added', { output_index: outputIndex, item });
export const itemDone = (outputIndex, item) =>
  evento('response.output_item.done', { output_index: outputIndex, item });
export const textDelta = (outputIndex, delta, itemId = 'msg_1') =>
  evento('response.output_text.delta', {
    item_id: itemId,
    output_index: outputIndex,
    content_index: 0,
    delta,
    logprobs: [],
  });
export const argumentsDelta = (outputIndex, delta, itemId = 'fc_1') =>
  evento('response.function_call_arguments.delta', {
    item_id: itemId,
    output_index: outputIndex,
    delta,
  });

/** @param {{ id?: string, texto?: string, rechazo?: string, phase?: string, createdBy?: string }} options */
export const messageItem = ({ id = 'msg_1', texto, rechazo, phase, createdBy } = {}) => ({
  id,
  type: 'message',
  status: 'completed',
  role: 'assistant',
  content:
    rechazo === undefined
      ? [{ type: 'output_text', text: texto ?? '', annotations: [], logprobs: [] }]
      : [{ type: 'refusal', refusal: rechazo }],
  ...(phase ? { phase } : {}),
  ...(createdBy ? { created_by: createdBy } : {}),
});

export const reasoningItem = ({ id = 'rs_1', cifrado = 'gAAAAcifrado', createdBy } = {}) => ({
  id,
  type: 'reasoning',
  summary: [],
  encrypted_content: cifrado,
  ...(createdBy ? { created_by: createdBy } : {}),
});

/** @param {{ id?: string, callId?: string, name: string, args?: object, json?: string, createdBy?: string }} options */
export const functionCallItem = ({
  id = 'fc_1',
  callId = 'call_1',
  name,
  args = {},
  json,
  createdBy,
}) => ({
  id,
  type: 'function_call',
  status: 'completed',
  call_id: callId,
  name,
  arguments: json ?? JSON.stringify(args),
  ...(createdBy ? { created_by: createdBy } : {}),
});

export const responseCompleted = (uso = usage(), id = 'resp_1') =>
  evento('response.completed', { response: respuestaBase(id, 'completed', { usage: uso }) });
export const responseIncomplete = (reason, uso = usage(), id = 'resp_1') =>
  evento('response.incomplete', {
    response: respuestaBase(id, 'incomplete', {
      incomplete_details: { reason },
      usage: uso,
    }),
  });
export const responseFailed = (code, message = code, id = 'resp_1') =>
  evento('response.failed', {
    response: respuestaBase(id, 'failed', { error: { code, message } }),
  });
export const errorEvent = (code, message = code) =>
  evento('error', { code, message, param: null, sequence_number: 1 });

/**
 * Events of one output item: added, the text deltas of a message (by default its whole text)
 * and done.
 * @param {number} index
 * @param {any} item
 * @param {string[]} [partes]
 */
export function itemEvents(index, item, partes) {
  const texto = item.type === 'message' ? (item.content[0].text ?? '') : '';
  const deltas = partes ?? (texto === '' ? [] : [texto]);
  return [
    itemAdded(index, { ...item, status: 'in_progress' }),
    ...deltas.map((delta) => textDelta(index, delta, item.id)),
    itemDone(index, item),
  ];
}

/**
 * Every event of one streamed response.
 * @param {{ items?: any[], final?: { event: string, data: object } | null }} options
 */
export const respuesta = ({ items = [], final = responseCompleted() }) => [
  responseCreated(),
  responseInProgress(),
  ...items.flatMap((item, index) => itemEvents(index, item)),
  ...(final ? [final] : []),
];

/** A JSON error response as the API sends it. */
export function respuestaError(
  status,
  { type = null, code = null, message = 'error' } = {},
  headers = {},
) {
  return new Response(JSON.stringify({ error: { message, type, param: null, code } }), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
