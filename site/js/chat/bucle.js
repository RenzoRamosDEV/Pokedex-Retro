// @ts-check
import { MENSAJES } from '../core/mensajes.js';
import {
  crearErrorDeClaude,
  errorDeEvento,
  errorDeRed,
  errorDeRespuesta,
  esReintentable,
  esperaReintento,
} from './errores.js';
import { ENTRADA_NO_JSON, ejecutarHerramienta } from './herramientas.js';
import { bloquesParaHistorial } from './historial.js';
import { construirPeticion } from './peticion.js';
import { aplicarEvento, crearLectorSse, crearMensaje } from './sse.js';

/**
 * One user question: streams Claude's answer and runs its tool loop until a final text.
 * @typedef {'fin' | 'cortada' | 'rechazo' | 'limite' | 'error' | 'abortada'} Estado
 * @typedef {{ entrada: number, salida: number }} Uso
 * @typedef {{ tipo: 'texto', texto: string } | { tipo: 'herramienta', nombre: string } | { tipo: 'uso', uso: Uso }} EventoChat
 * @typedef {(url: string, init: object) => Promise<Response>} FetchLike
 */

const MAX_ITERACIONES = 8;
const MAX_REINTENTOS = 2;

/**
 * Sends the request, retrying 429, 529 and 5xx before any event arrives.
 * @param {{ fetch: FetchLike, url: string, opciones: object, esperar: (ms: number) => Promise<void>, signal?: AbortSignal, ahora: () => number }} envio
 */
async function enviar({ fetch, url, opciones, esperar, signal, ahora }) {
  for (let intento = 0; ; intento += 1) {
    let respuesta;
    try {
      respuesta = await fetch(url, { ...opciones, signal });
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw error;
      throw errorDeRed(error.message);
    }
    if (respuesta.ok) return respuesta;
    if (!esReintentable(respuesta.status) || intento === MAX_REINTENTOS) {
      throw await errorDeRespuesta(respuesta);
    }
    await esperar(esperaReintento(respuesta.headers, intento, ahora));
    signal?.throwIfAborted();
  }
}

/**
 * Reads the SSE body into a message, reporting visible text as it arrives.
 * @param {Response} respuesta
 * @param {(texto: string) => void} alTexto
 * @param {AbortSignal} [signal]
 */
async function leerMensaje(respuesta, alTexto, signal) {
  const lector = crearLectorSse();
  const mensaje = crearMensaje();
  const reader = respuesta.body.getReader();
  const cancelar = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      for (const evento of lector.leer(value)) {
        const texto = aplicarEventoClasificado(mensaje, evento);
        if (texto !== '') alTexto(texto);
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancelar);
  }
  if (mensaje.stop_reason === null) throw errorDeRed('stream incompleto');
  return mensaje;
}

/**
 * @param {import('./sse.js').Mensaje} mensaje
 * @param {import('./sse.js').EventoSse} evento
 */
function aplicarEventoClasificado(mensaje, evento) {
  try {
    return aplicarEvento(mensaje, evento);
  } catch (error) {
    throw error.name === 'ErrorDeStream' ? errorDeEvento(error) : error;
  }
}

/**
 * Runs every tool use of the turn in parallel; a failure becomes an `is_error` result.
 * @param {any[]} turno assistant blocks as they go back to the API
 * @param {Set<string>} sinJson ids of tool uses whose input did not parse
 * @param {import('./herramientas.js').PokeApiPort} port
 * @param {(evento: EventoChat) => void} alEvento
 * @param {AbortSignal} [signal]
 */
function ejecutarTurno(turno, sinJson, port, alEvento, signal) {
  const usos = turno.filter((bloque) => bloque.type === 'tool_use');
  return Promise.all(
    usos.map(async ({ id, name, input }) => {
      alEvento({ tipo: 'herramienta', nombre: name });
      const entrada = sinJson.has(id) ? ENTRADA_NO_JSON : input;
      let resultado;
      try {
        resultado = await ejecutarHerramienta(port, name, entrada);
      } catch (error) {
        if (signal?.aborted) throw error;
        resultado = { contenido: MENSAJES.caida, esError: true };
      }
      return {
        type: 'tool_result',
        tool_use_id: id,
        content: resultado.contenido,
        ...(resultado.esError ? { is_error: true } : {}),
      };
    }),
  );
}

/**
 * @param {Uso} uso
 * @param {Record<string, number>} usage
 * @returns {Uso}
 */
const sumarUso = (uso, usage) => ({
  entrada:
    uso.entrada +
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0),
  salida: uso.salida + (usage.output_tokens ?? 0),
});

/**
 * @param {{
 *   mensajes: object[], pregunta: string, modelo: string, clave: string, fetch: FetchLike,
 *   port: import('./herramientas.js').PokeApiPort, signal?: AbortSignal,
 *   esperar: (ms: number) => Promise<void>, alEvento: (evento: EventoChat) => void, ahora?: () => number,
 * }} datos
 * @returns {Promise<{ estado: Estado, mensajes: object[], uso: Uso, error?: any }>}
 */
export async function responder({
  mensajes,
  pregunta,
  modelo,
  clave,
  fetch,
  port,
  signal,
  esperar,
  alEvento,
  ahora = Date.now,
}) {
  const conversacion = [...mensajes, { role: 'user', content: pregunta }];
  let uso = { entrada: 0, salida: 0 };
  /** Turns are committed only on a final text, so no tool use is ever left without its result. */
  const terminar = (estado, incorporar = false, error = undefined) => {
    if (estado === 'fin' || estado === 'cortada') alEvento({ tipo: 'uso', uso });
    return {
      estado,
      mensajes: incorporar ? conversacion : mensajes,
      uso,
      ...(error ? { error } : {}),
    };
  };
  try {
    for (let iteracion = 0; ; iteracion += 1) {
      const { url, opciones } = construirPeticion({ modelo, clave, mensajes: conversacion });
      const respuesta = await enviar({ fetch, url, opciones, esperar, signal, ahora });
      const mensaje = await leerMensaje(
        respuesta,
        (texto) => alEvento({ tipo: 'texto', texto }),
        signal,
      );
      uso = sumarUso(uso, mensaje.usage);
      const turno = bloquesParaHistorial(mensaje.content);
      const conHerramientas = turno.some((bloque) => bloque.type === 'tool_use');
      if (mensaje.stop_reason === 'refusal') return terminar('rechazo');
      if (mensaje.stop_reason === 'max_tokens') {
        if (conHerramientas) return terminar('cortada');
        conversacion.push({ role: 'assistant', content: turno });
        return terminar('cortada', true);
      }
      conversacion.push({ role: 'assistant', content: turno });
      if (mensaje.stop_reason !== 'tool_use') return terminar('fin', true);
      if (iteracion === MAX_ITERACIONES) return terminar('limite');
      const sinJson = new Set(
        mensaje.content.filter((b) => 'entrada_invalida' in b).map((b) => b.id),
      );
      const resultados = await ejecutarTurno(turno, sinJson, port, alEvento, signal);
      signal?.throwIfAborted();
      conversacion.push({ role: 'user', content: resultados });
    }
  } catch (error) {
    if (signal?.aborted || error.name === 'AbortError') return terminar('abortada');
    const clasificado =
      error.name === 'ErrorDeClaude' ? error : crearErrorDeClaude(500, error.message);
    return terminar('error', false, clasificado);
  }
}
