// @ts-check
import { esperaReintento } from './errores.js';
import { ejecutarHerramienta } from './herramientas.js';
import { PROVEEDORES } from './proveedores/index.js';
import { crearLectorSse } from './sse.js';

/**
 * One user question: streams the provider's answer and runs its tool loop until a final text.
 * @typedef {'fin' | 'cortada' | 'rechazo' | 'limite' | 'error' | 'abortada'} Estado
 * @typedef {{ entrada: number, salida: number }} Uso
 * @typedef {{ tipo: 'texto', texto: string } | { tipo: 'herramienta', nombre: string } | { tipo: 'uso', uso: Uso }} EventoChat
 * @typedef {(url: string, init: object) => Promise<Response>} FetchLike
 * @typedef {typeof PROVEEDORES.anthropic} Proveedor
 * @typedef {import('./proveedores/anthropic.js').Turno} Turno
 */

const MAX_ITERACIONES = 8;
const MAX_REINTENTOS = 2;

/**
 * Sends the request, retrying what the provider marks as retryable before any event arrives.
 * @param {{ proveedor: Proveedor, fetch: FetchLike, clave: string, url: string, opciones: object, esperar: (ms: number) => Promise<void>, signal?: AbortSignal, ahora: () => number }} envio
 */
async function enviar({ proveedor, fetch, clave, url, opciones, esperar, signal, ahora }) {
  for (let intento = 0; ; intento += 1) {
    let respuesta;
    try {
      respuesta = await fetch(url, { ...opciones, signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw await proveedor.errorDeConexion({ fetch, clave, detalle: error.message, signal });
    }
    if (respuesta.ok) return respuesta;
    const error = await proveedor.errorDeRespuesta(respuesta);
    if (!error.reintentable || intento === MAX_REINTENTOS) throw error;
    await esperar(esperaReintento(respuesta.headers, intento, ahora));
    signal?.throwIfAborted();
  }
}

/**
 * Reads the SSE body into a turn, reporting visible text as it arrives.
 * @param {Proveedor} proveedor
 * @param {Response} respuesta
 * @param {(texto: string) => void} alTexto
 * @param {AbortSignal} [signal]
 * @returns {Promise<Turno>}
 */
async function leerTurno(proveedor, respuesta, alTexto, signal) {
  const lector = crearLectorSse();
  const lectura = proveedor.crearLectura();
  const reader = respuesta.body.getReader();
  signal?.addEventListener('abort', () => reader.cancel().catch(() => {}));
  for (;;) {
    const { done, value } = await reader.read();
    signal?.throwIfAborted();
    if (done) break;
    for (const evento of lector.leer(value)) {
      const texto = lectura.aplicar(evento);
      if (texto !== '') alTexto(texto);
    }
  }
  return lectura.terminar();
}

/**
 * Runs every call of the turn in parallel; a failure comes back as an error result.
 * @param {Turno['llamadas']} llamadas
 * @param {import('./herramientas.js').PokeApiPort} port
 * @param {(evento: EventoChat) => void} alEvento
 */
function ejecutarLlamadas(llamadas, port, alEvento) {
  return Promise.all(
    llamadas.map(async ({ id, nombre, entrada }) => {
      alEvento({ tipo: 'herramienta', nombre });
      return { id, ...(await ejecutarHerramienta(port, nombre, entrada)) };
    }),
  );
}

/**
 * @param {Uso} uso
 * @param {Uso} otro
 * @returns {Uso}
 */
const sumarUso = (uso, otro) => ({
  entrada: uso.entrada + otro.entrada,
  salida: uso.salida + otro.salida,
});

/**
 * @param {{
 *   mensajes: object[], pregunta: string, modelo: string, clave: string, fetch: FetchLike,
 *   port: import('./herramientas.js').PokeApiPort, signal?: AbortSignal,
 *   esperar: (ms: number) => Promise<void>, alEvento: (evento: EventoChat) => void, ahora?: () => number,
 *   proveedor?: Proveedor,
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
  proveedor = PROVEEDORES.anthropic,
}) {
  const conversacion = [...mensajes, proveedor.mensajeUsuario(pregunta)];
  let uso = { entrada: 0, salida: 0 };
  /** Turns are committed only on a final text, so no tool call is ever left without its result. */
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
      const { url, opciones } = proveedor.construirPeticion({
        modelo,
        clave,
        historial: conversacion,
      });
      const respuesta = await enviar({
        proveedor,
        fetch,
        clave,
        url,
        opciones,
        esperar,
        signal,
        ahora,
      });
      const turno = await leerTurno(
        proveedor,
        respuesta,
        (texto) => alEvento({ tipo: 'texto', texto }),
        signal,
      );
      uso = sumarUso(uso, turno.uso);
      if (turno.motivo === 'rechazo') return terminar('rechazo');
      if (turno.motivo === 'cortada') {
        if (turno.llamadas.length > 0) return terminar('cortada');
        conversacion.push(...turno.historial);
        return terminar('cortada', true);
      }
      conversacion.push(...turno.historial);
      if (turno.motivo !== 'herramientas') return terminar('fin', true);
      if (iteracion === MAX_ITERACIONES) return terminar('limite');
      const salidas = await ejecutarLlamadas(turno.llamadas, port, alEvento);
      signal?.throwIfAborted();
      conversacion.push(...proveedor.resultados(salidas));
    }
  } catch (error) {
    if (error.name === 'AbortError') return terminar('abortada');
    const clasificado = error.codigo ? error : proveedor.errorDesconocido(error.message);
    return terminar('error', false, clasificado);
  }
}
