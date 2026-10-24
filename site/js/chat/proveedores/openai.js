// @ts-check
import { DEFINICIONES, ENTRADA_NO_JSON } from '../herramientas.js';
import { SISTEMA } from '../peticion.js';

/**
 * Provider port for the OpenAI Responses API, called with plain `fetch` and `store: false`.
 * https://developers.openai.com/api/docs/guides/function-calling
 * https://developers.openai.com/api/docs/guides/reasoning
 */

const URL_RESPUESTAS = 'https://api.openai.com/v1/responses';
const URL_MODELOS = 'https://api.openai.com/v1/models';
const MAX_OUTPUT_TOKENS = 8000;

/** @param {Record<string, any>} propiedad */
const admiteNull = (propiedad) => ({
  ...propiedad,
  type: [propiedad.type, 'null'],
  ...(propiedad.enum && { enum: [...propiedad.enum, null] }),
});

/**
 * Strict mode needs every property in `required`; the optional ones accept `null` instead.
 * https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
 * @param {{ properties: Record<string, any>, required: string[] }} esquema
 */
function parametrosEstrictos({ properties, required }) {
  const propiedades = Object.fromEntries(
    Object.entries(properties).map(([nombre, propiedad]) => [
      nombre,
      required.includes(nombre) ? propiedad : admiteNull(propiedad),
    ]),
  );
  return {
    type: 'object',
    properties: propiedades,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const FUNCIONES = DEFINICIONES.map(({ name, description, input_schema }) => ({
  type: 'function',
  name,
  description,
  parameters: parametrosEstrictos(input_schema),
  strict: true,
}));

/**
 * Quota and spend-limit 429s: retrying them does not restore access.
 * https://developers.openai.com/api/docs/guides/error-codes
 */
const SIN_SALDO = [
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
];

/** @type {Record<number, import('../errores.js').CodigoError>} */
const CODIGO_POR_ESTADO = {
  400: 'peticion',
  401: 'clave_invalida',
  403: 'permiso',
  429: 'limite_uso',
  503: 'saturado',
};

/** HTTP status equivalent to each stream error code; unknown codes are server errors. */
const ESTADO_POR_CODIGO = {
  invalid_api_key: 401,
  rate_limit_exceeded: 429,
  slow_down: 429,
  server_is_overloaded: 503,
  ...Object.fromEntries(SIN_SALDO.map((codigo) => [codigo, 429])),
};

/**
 * @param {import('../errores.js').CodigoError} codigo
 * @param {number} estado
 * @param {string} detalle
 */
const crearError = (codigo, estado, detalle) =>
  Object.assign(new Error(detalle), { name: 'ErrorDeOpenAI', codigo, estado, detalle });

/**
 * @param {number} estado
 * @param {{ type?: string, code?: string, message?: string }} error
 * @param {string} detalle
 */
function errorPorEstado(estado, { type, code }, detalle) {
  const sinSaldo = estado === 429 && (SIN_SALDO.includes(type) || SIN_SALDO.includes(code));
  return crearError(
    sinSaldo ? 'sin_saldo' : (CODIGO_POR_ESTADO[estado] ?? 'servidor'),
    estado,
    detalle,
  );
}

/** @param {{ code?: string, message: string }} error */
const errorDeStream = ({ code, message }) =>
  errorPorEstado(ESTADO_POR_CODIGO[code] ?? 500, { code }, message);

/** @param {string} detalle */
const errorDeRed = (detalle) => crearError('red', 0, detalle);

/**
 * Parsed arguments with top-level nulls dropped, so strict mode's `null` means "not given".
 * @param {string} texto
 */
function entradaDe(texto) {
  try {
    const valor = JSON.parse(texto);
    if (typeof valor === 'object' && valor !== null) {
      return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null));
    }
  } catch {
    // Unparseable arguments end like any other non-object input.
  }
  return ENTRADA_NO_JSON;
}

/** @param {any} item */
const conRechazo = (item) =>
  item.type === 'message' && item.content.some((parte) => parte.type === 'refusal');

/**
 * @param {{ status: string, incomplete_details?: { reason: string } }} final
 * @param {any[]} historial
 * @returns {import('./anthropic.js').Motivo}
 */
function motivoDe(final, historial) {
  if (final.status === 'incomplete') {
    return final.incomplete_details?.reason === 'content_filter' ? 'rechazo' : 'cortada';
  }
  if (historial.some(conRechazo)) return 'rechazo';
  if (historial.some((item) => item.type === 'function_call')) return 'herramientas';
  return 'fin';
}

export const openai = {
  /** @param {{ modelo: string, clave: string, historial: object[] }} datos */
  construirPeticion: ({ modelo, clave, historial }) => ({
    url: URL_RESPUESTAS,
    opciones: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
      body: JSON.stringify({
        model: modelo,
        instructions: SISTEMA,
        input: historial,
        tools: FUNCIONES,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'low' },
        store: false,
        stream: true,
      }),
    },
  }),
  /** @param {string} pregunta */
  mensajeUsuario: (pregunta) => ({ role: 'user', content: pregunta }),

  crearLectura() {
    /** @type {any[]} */
    const items = [];
    /** @type {any} */
    let final = null;
    return {
      /**
       * @param {import('../sse.js').EventoSse} evento
       * @returns {string}
       */
      aplicar({ evento, datos }) {
        switch (evento) {
          case 'response.output_text.delta':
            return datos.delta;
          case 'response.output_item.done': {
            const { created_by, ...item } = datos.item;
            items[datos.output_index] = item;
            return '';
          }
          case 'error':
            throw errorDeStream(datos);
          case 'response.failed':
            throw errorDeStream(datos.response.error);
          case 'response.completed':
          case 'response.incomplete':
            final = datos.response;
            return '';
          default:
            return '';
        }
      },
      /** @returns {import('./anthropic.js').Turno} */
      terminar() {
        if (final === null) throw errorDeRed('stream incompleto');
        const historial = items.filter(Boolean);
        return {
          motivo: motivoDe(final, historial),
          historial,
          llamadas: historial
            .filter((item) => item.type === 'function_call')
            .map((item) => ({
              id: item.call_id,
              nombre: item.name,
              entrada: entradaDe(item.arguments),
            })),
          uso: { entrada: final.usage?.input_tokens ?? 0, salida: final.usage?.output_tokens ?? 0 },
        };
      },
    };
  },

  /** @param {import('./anthropic.js').Salida[]} salidas */
  resultados: (salidas) =>
    salidas.map(({ id, contenido }) => ({
      type: 'function_call_output',
      call_id: id,
      output: contenido,
    })),

  /** @param {{ status: number, json(): Promise<any> }} respuesta */
  async errorDeRespuesta(respuesta) {
    const { status } = respuesta;
    const { error = {} } = await respuesta.json().catch(() => ({}));
    const clasificado = errorPorEstado(status, error, error.message ?? `HTTP ${status}`);
    return Object.assign(clasificado, {
      reintentable: clasificado.codigo === 'limite_uso' || status >= 500,
    });
  },

  errorDeRed,

  /**
   * Error responses of /v1/responses carry no CORS headers, so the browser only sees a network
   * failure; /v1/models does send them, and its answer to the same key tells what went wrong.
   * @param {{ fetch: (url: string, init: object) => Promise<Response>, clave: string, detalle: string, signal?: AbortSignal }} datos
   */
  async errorDeConexion({ fetch, clave, detalle, signal }) {
    let respuesta;
    try {
      respuesta = await fetch(URL_MODELOS, {
        method: 'GET',
        headers: { authorization: `Bearer ${clave}` },
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return errorDeRed(detalle);
    }
    if (respuesta.status === 401) return crearError('clave_invalida', 401, detalle);
    if (respuesta.status === 200) return crearError('rechazada', 0, detalle);
    return errorDeRed(detalle);
  },

  /** @param {string} detalle */
  errorDesconocido: (detalle) => crearError('servidor', 500, detalle),
};
