// @ts-check
import { DEFINICIONES } from '../herramientas.js';
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
};
