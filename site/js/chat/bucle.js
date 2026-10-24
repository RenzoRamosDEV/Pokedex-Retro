// @ts-check
import {
  DELEGAR_SUBAGENTE,
  USAR_SKILL,
  cargarSkill,
  resultadoSubagente,
  validarDelegacion,
} from './agentes/meta.js';
import { PROFESOR } from './agentes/profesor.js';
import { SUBAGENTES } from './agentes/subagentes.js';
import { esperaReintento } from './errores.js';
import { ENTRADA_NO_JSON, TEXTO_NO_JSON, ejecutarHerramienta } from './herramientas.js';
import { PROVEEDORES } from './proveedores/index.js';
import { crearLectorSse } from './sse.js';

/**
 * One user question: streams the provider's answer and runs its tool loop until a final text.
 * @typedef {'fin' | 'cortada' | 'rechazo' | 'limite' | 'error' | 'abortada'} Estado
 * @typedef {{ entrada: number, salida: number }} Uso
 * @typedef {{ tipo: 'texto', texto: string } | { tipo: 'herramienta' | 'subagente' | 'skill', nombre: string } | { tipo: 'uso', uso: Uso }} EventoChat
 * @typedef {(url: string, init: object) => Promise<Response>} FetchLike
 * @typedef {typeof PROVEEDORES.anthropic} Proveedor
 * @typedef {import('./proveedores/anthropic.js').Turno} Turno
 * @typedef {import('./agentes/subagentes.js').Agente} Agente
 * @typedef {import('./agentes/meta.js').Final} Final
 * @typedef {{
 *   proveedor: Proveedor, modelo: string, clave: string, fetch: FetchLike,
 *   port: import('./herramientas.js').PokeApiPort, signal?: AbortSignal,
 *   esperar: (ms: number) => Promise<void>, ahora: () => number,
 *   alEvento: (evento: EventoChat) => void, sumarUso: (uso: Uso) => void,
 * }} Contexto
 */

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
 * Runs a subagent on its own history, with the same provider, key and signal as the question.
 * Its text and events stay out of the conversation; only its usage counts.
 * @param {string} nombre
 * @param {string} tarea
 * @param {Contexto} ctx
 */
async function delegar(nombre, tarea, ctx) {
  ctx.alEvento({ tipo: 'subagente', nombre });
  const final = await ejecutarAgente({
    agente: SUBAGENTES.find((s) => s.nombre === nombre),
    historial: [ctx.proveedor.mensajeUsuario(tarea)],
    ctx: { ...ctx, alEvento: () => {} },
    alTexto: () => {},
  });
  return resultadoSubagente(nombre, final);
}

/**
 * Tools outside the agent's list are never run, which keeps subagents at depth 1.
 * @param {string} nombre
 * @param {unknown} entrada
 * @param {Agente} agente
 * @param {Contexto} ctx
 * @returns {Promise<{ contenido: string, esError: boolean }>}
 */
async function ejecutarLlamada(nombre, entrada, agente, ctx) {
  if (!agente.herramientas.some((h) => h.name === nombre)) {
    return { contenido: `Herramienta desconocida: ${nombre}.`, esError: true };
  }
  if (nombre !== USAR_SKILL.name && nombre !== DELEGAR_SUBAGENTE.name) {
    ctx.alEvento({ tipo: 'herramienta', nombre });
    return ejecutarHerramienta(ctx.port, nombre, entrada);
  }
  if (entrada === ENTRADA_NO_JSON) return { contenido: TEXTO_NO_JSON, esError: true };
  if (nombre === USAR_SKILL.name) {
    const { contenido, esError, nombre: skill } = cargarSkill(entrada);
    if (!esError) ctx.alEvento({ tipo: 'skill', nombre: skill });
    return { contenido, esError };
  }
  const validacion = validarDelegacion(entrada);
  if ('mensaje' in validacion) return { contenido: validacion.mensaje, esError: true };
  const { subagente, tarea } = /** @type {{ subagente: string, tarea: string }} */ (
    validacion.valor
  );
  return delegar(subagente, tarea, ctx);
}

/**
 * Runs every call of the turn in parallel; a failure comes back as an error result.
 * @param {Turno['llamadas']} llamadas
 * @param {Agente} agente
 * @param {Contexto} ctx
 */
function ejecutarLlamadas(llamadas, agente, ctx) {
  return Promise.all(
    llamadas.map(async ({ id, nombre, entrada }) => ({
      id,
      ...(await ejecutarLlamada(nombre, entrada, agente, ctx)),
    })),
  );
}

/**
 * Tool loop of one agent until a final text; errors and aborts are thrown to the caller.
 * `texto` is the visible text of the last request. The history also receives turns that are
 * never committed (a cut turn with calls), since the caller then keeps its previous messages.
 * @param {{ agente: Agente, historial: object[], ctx: Contexto, alTexto: (texto: string) => void }} datos
 * @returns {Promise<Final>}
 */
async function ejecutarAgente({ agente, historial, ctx, alTexto }) {
  const { proveedor, modelo, clave, signal } = ctx;
  for (let iteracion = 0; ; iteracion += 1) {
    const { url, opciones } = proveedor.construirPeticion({ modelo, clave, historial, agente });
    const respuesta = await enviar({ ...ctx, url, opciones });
    let texto = '';
    const turno = await leerTurno(
      proveedor,
      respuesta,
      (delta) => {
        texto += delta;
        alTexto(delta);
      },
      signal,
    );
    ctx.sumarUso(turno.uso);
    if (turno.motivo === 'rechazo') return { estado: 'rechazo', texto };
    historial.push(...turno.historial);
    if (turno.motivo === 'cortada') {
      return { estado: 'cortada', texto, pendientes: turno.llamadas.length > 0 };
    }
    if (turno.motivo !== 'herramientas') return { estado: 'fin', texto };
    if (iteracion === agente.maxIteraciones) return { estado: 'limite', texto };
    const salidas = await ejecutarLlamadas(turno.llamadas, agente, ctx);
    signal?.throwIfAborted();
    historial.push(...proveedor.resultados(salidas));
  }
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
  const ctx = {
    proveedor,
    modelo,
    clave,
    fetch,
    port,
    signal,
    esperar,
    ahora,
    alEvento,
    sumarUso: (/** @type {Uso} */ otro) => {
      uso = sumarUso(uso, otro);
    },
  };
  try {
    const { estado, pendientes } = await ejecutarAgente({
      agente: PROFESOR,
      historial: conversacion,
      ctx,
      alTexto: (texto) => alEvento({ tipo: 'texto', texto }),
    });
    return terminar(estado, (estado === 'fin' || estado === 'cortada') && !pendientes);
  } catch (error) {
    if (error.name === 'AbortError') return terminar('abortada');
    const clasificado = error.codigo ? error : proveedor.errorDesconocido(error.message);
    return terminar('error', false, clasificado);
  }
}
