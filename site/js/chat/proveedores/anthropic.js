// @ts-check
import {
  crearErrorDeClaude,
  errorDeEvento,
  errorDeRed,
  errorDeRespuesta,
  esReintentable,
} from '../errores.js';
import { ENTRADA_NO_JSON } from '../herramientas.js';
import { bloquesParaHistorial } from '../historial.js';
import { construirPeticion } from '../peticion.js';
import { aplicarEvento, crearMensaje } from '../sse.js';

/**
 * Provider port for the Messages API, composed of the 1.2.0 modules without changing them.
 * @typedef {'fin' | 'herramientas' | 'cortada' | 'rechazo'} Motivo
 * @typedef {{ id: string, nombre: string, entrada: unknown }} Llamada
 * @typedef {{ motivo: Motivo, historial: object[], llamadas: Llamada[], uso: { entrada: number, salida: number } }} Turno
 * @typedef {{ id: string, contenido: string, esError: boolean }} Salida
 */

/** @type {Record<string, Motivo>} */
const MOTIVO_POR_STOP_REASON = {
  tool_use: 'herramientas',
  max_tokens: 'cortada',
  refusal: 'rechazo',
};

/** @param {Record<string, number>} usage */
const uso = (usage) => ({
  entrada:
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0),
  salida: usage.output_tokens ?? 0,
});

/**
 * @param {import('../sse.js').Mensaje} mensaje
 * @returns {Turno}
 */
function turnoDe(mensaje) {
  const contenido = bloquesParaHistorial(mensaje.content);
  const sinJson = new Set(mensaje.content.filter((b) => 'entrada_invalida' in b).map((b) => b.id));
  return {
    motivo: MOTIVO_POR_STOP_REASON[mensaje.stop_reason] ?? 'fin',
    historial: [{ role: 'assistant', content: contenido }],
    llamadas: contenido
      .filter((bloque) => bloque.type === 'tool_use')
      .map(({ id, name, input }) => ({
        id,
        nombre: name,
        entrada: sinJson.has(id) ? ENTRADA_NO_JSON : input,
      })),
    uso: uso(mensaje.usage),
  };
}

export const anthropic = {
  /** @param {{ modelo: string, clave: string, historial: object[] }} datos */
  construirPeticion: ({ modelo, clave, historial }) =>
    construirPeticion({ modelo, clave, mensajes: historial }),

  /** @param {string} pregunta */
  mensajeUsuario: (pregunta) => ({ role: 'user', content: pregunta }),

  crearLectura() {
    const mensaje = crearMensaje();
    return {
      /** @param {import('../sse.js').EventoSse} evento */
      aplicar(evento) {
        try {
          return aplicarEvento(mensaje, evento);
        } catch (error) {
          throw errorDeEvento(error);
        }
      },
      terminar() {
        if (mensaje.stop_reason === null) throw errorDeRed('stream incompleto');
        return turnoDe(mensaje);
      },
    };
  },

  /** @param {Salida[]} salidas */
  resultados: (salidas) => [
    {
      role: 'user',
      content: salidas.map(({ id, contenido, esError }) => ({
        type: 'tool_result',
        tool_use_id: id,
        content: contenido,
        ...(esError ? { is_error: true } : {}),
      })),
    },
  ],

  /** @param {{ status: number, json(): Promise<any> }} respuesta */
  async errorDeRespuesta(respuesta) {
    const error = await errorDeRespuesta(respuesta);
    return Object.assign(error, { reintentable: esReintentable(respuesta.status) });
  },

  errorDeRed,

  /**
   * A request that got no answer at all is a lost connection; nothing else to ask.
   * @param {{ fetch: (url: string, init: object) => Promise<Response>, clave: string, detalle: string, signal?: AbortSignal }} datos
   */
  errorDeConexion: async ({ detalle }) => errorDeRed(detalle),

  /** @param {string} detalle */
  errorDesconocido: (detalle) => crearErrorDeClaude(500, detalle),
};
