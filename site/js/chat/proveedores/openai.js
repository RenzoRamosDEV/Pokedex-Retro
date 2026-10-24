// @ts-check
import { DEFINICIONES, ENTRADA_NO_JSON } from '../herramientas.js';
import { SISTEMA } from '../peticion.js';

/**
 * Provider port for the OpenAI Responses API, called with plain `fetch` and `store: false`.
 * https://developers.openai.com/api/docs/guides/function-calling
 * https://developers.openai.com/api/docs/guides/reasoning
 */

const URL_RESPUESTAS = 'https://api.openai.com/v1/responses';
const MAX_OUTPUT_TOKENS = 8000;

/**
 * Strict mode needs every property in `required`; the optional ones accept `null` instead.
 * https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
 * @param {{ properties: Record<string, any>, required: string[] }} esquema
 */
function parametrosEstrictos({ properties, required }) {
  const propiedades = Object.fromEntries(
    Object.entries(properties).map(([nombre, propiedad]) => [
      nombre,
      required.includes(nombre) ? propiedad : { ...propiedad, type: [propiedad.type, 'null'] },
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
 * @param {string} codigo
 * @param {number} estado
 * @param {string} detalle
 */
const crearError = (codigo, estado, detalle) =>
  Object.assign(new Error(detalle), { name: 'ErrorDeOpenAI', codigo, estado, detalle });

/** @param {string} detalle */
const errorDeRed = (detalle) => crearError('red', 0, detalle);

/**
 * Parsed arguments with top-level nulls dropped, so strict mode's `null` means "not given".
 * @param {string} texto
 */
function entradaDe(texto) {
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch {
    return ENTRADA_NO_JSON;
  }
  if (valor === null || typeof valor !== 'object') return ENTRADA_NO_JSON;
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null));
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
};
