// @ts-check

/**
 * Reader of the Messages API server-sent events and rebuilder of the streamed message.
 * @typedef {{ evento: string, datos: any }} EventoSse
 * @typedef {{ id: string | null, model: string | null, content: any[], stop_reason: string | null, usage: Record<string, number> }} Mensaje
 */

const FIN_DE_EVENTO = /\r?\n\r?\n/;

/** Incremental reader: feed it network chunks, get back the complete events, without `ping`. */
export function crearLectorSse() {
  const decoder = new TextDecoder();
  let pendiente = '';
  return {
    /**
     * @param {Uint8Array} trozo
     * @returns {EventoSse[]}
     */
    leer(trozo) {
      pendiente += decoder.decode(trozo, { stream: true });
      const partes = pendiente.split(FIN_DE_EVENTO);
      pendiente = partes.pop();
      return partes.map(parsearEvento).filter((evento) => evento !== null);
    },
  };
}

/**
 * @param {string} bloque
 * @returns {EventoSse | null}
 */
function parsearEvento(bloque) {
  let evento = null;
  const datos = [];
  for (const linea of bloque.split(/\r?\n/)) {
    if (linea.startsWith('event:')) evento = linea.slice(6).trim();
    else if (linea.startsWith('data:')) datos.push(linea.slice(5).trimStart());
  }
  if (datos.length === 0) return null;
  const json = JSON.parse(datos.join('\n'));
  const nombre = evento ?? json.type;
  return nombre === 'ping' ? null : { evento: nombre, datos: json };
}

/** @returns {Mensaje} */
export function crearMensaje() {
  return { id: null, model: null, content: [], stop_reason: null, usage: {} };
}

/** Raw `input_json_delta` text per message and block index, kept outside the message itself. */
const entradasParciales = new WeakMap();

/**
 * Applies one event to `mensaje` and returns the visible text it adds ('' when none).
 * @param {Mensaje} mensaje
 * @param {EventoSse} evento
 * @returns {string}
 */
export function aplicarEvento(mensaje, { evento, datos }) {
  switch (evento) {
    case 'message_start':
      mensaje.id = datos.message.id;
      mensaje.model = datos.message.model;
      mensaje.usage = { ...datos.message.usage };
      return '';
    case 'content_block_start':
      mensaje.content[datos.index] = structuredClone(datos.content_block);
      return '';
    case 'content_block_delta':
      return aplicarDelta(mensaje, datos.index, datos.delta);
    case 'content_block_stop':
      cerrarBloque(mensaje, datos.index);
      return '';
    case 'message_delta':
      mensaje.stop_reason = datos.delta.stop_reason;
      Object.assign(mensaje.usage, datos.usage);
      return '';
    case 'error':
      throw Object.assign(new Error(datos.error.message), {
        name: 'ErrorDeStream',
        tipo: datos.error.type,
      });
    default:
      return '';
  }
}

/**
 * @param {Mensaje} mensaje
 * @param {number} index
 * @param {any} delta
 */
function aplicarDelta(mensaje, index, delta) {
  const bloque = mensaje.content[index];
  switch (delta.type) {
    case 'text_delta':
      bloque.text += delta.text;
      return delta.text;
    case 'thinking_delta':
      bloque.thinking += delta.thinking;
      return '';
    case 'signature_delta':
      bloque.signature = delta.signature;
      return '';
    case 'input_json_delta': {
      const parciales = entradasParciales.get(mensaje) ?? new Map();
      parciales.set(index, (parciales.get(index) ?? '') + delta.partial_json);
      entradasParciales.set(mensaje, parciales);
      return '';
    }
    default:
      return '';
  }
}

/**
 * Parses the streamed input of a finished tool_use; a bad one keeps its raw text so the tool is
 * answered with an error instead of running.
 * @param {Mensaje} mensaje
 * @param {number} index
 */
function cerrarBloque(mensaje, index) {
  const texto = entradasParciales.get(mensaje)?.get(index);
  if (texto === undefined) return;
  const bloque = mensaje.content[index];
  try {
    bloque.input = JSON.parse(texto);
  } catch {
    bloque.entrada_invalida = texto;
  }
}
