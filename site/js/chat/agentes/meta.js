// @ts-check
import { SKILLS } from './skills.js';
import { SUBAGENTES } from './subagentes.js';

/**
 * Tools of the main agent that act on agents and skills instead of PokéAPI.
 * @typedef {import('../herramientas.js').Validacion} Validacion
 * @typedef {{ contenido: string, esError: boolean }} Salida
 * @typedef {{ estado: 'fin' | 'cortada' | 'rechazo' | 'limite', texto: string, pendientes: boolean }} Final
 */

const MAX_TAREA = 2000;
const NOMBRES_SUBAGENTES = SUBAGENTES.map((s) => s.nombre);
const NOMBRES_SKILLS = SKILLS.map((s) => s.nombre);

const ERROR_SUBAGENTE = `subagente debe ser uno de: ${NOMBRES_SUBAGENTES.join(', ')}.`;
const ERROR_TAREA = `tarea debe tener entre 1 y ${MAX_TAREA} caracteres.`;
const ERROR_SKILL = `nombre debe ser uno de: ${NOMBRES_SKILLS.join(', ')}.`;

/**
 * @param {string} name
 * @param {string} description
 * @param {Record<string, object>} properties
 */
const definicion = (name, description, properties) => ({
  name,
  description,
  input_schema: {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  },
  strict: true,
  eager_input_streaming: true,
});

export const DELEGAR_SUBAGENTE = definicion(
  'delegar_subagente',
  'Encarga una tarea a un subagente especializado y devuelve su respuesta. Úsala solo cuando la tarea necesite varias consultas de su especialidad: cada delegación consume tokens adicionales.',
  {
    subagente: {
      type: 'string',
      enum: NOMBRES_SUBAGENTES,
      description: 'Subagente que hará la tarea',
    },
    tarea: {
      type: 'string',
      description: `Tarea concreta para el subagente, en español, de 1 a ${MAX_TAREA} caracteres`,
    },
  },
);

export const USAR_SKILL = definicion(
  'usar_skill',
  'Carga las instrucciones completas de una skill; síguelas después para responder.',
  { nombre: { type: 'string', enum: NOMBRES_SKILLS, description: 'Skill que se carga' } },
);

export const META = [DELEGAR_SUBAGENTE, USAR_SKILL];

/**
 * @param {unknown} valor
 * @param {string[]} permitidos
 */
const elegido = (valor, permitidos) =>
  typeof valor === 'string' && permitidos.includes(valor.trim()) ? valor.trim() : null;

/**
 * @param {unknown} entrada
 * @returns {Validacion}
 */
export function validarDelegacion(entrada) {
  const { subagente, tarea } = /** @type {Record<string, unknown>} */ (entrada ?? {});
  const nombre = elegido(subagente, NOMBRES_SUBAGENTES);
  if (nombre === null) return { ok: false, mensaje: ERROR_SUBAGENTE };
  const texto = typeof tarea === 'string' ? tarea.trim() : '';
  if (texto.length < 1 || texto.length > MAX_TAREA) return { ok: false, mensaje: ERROR_TAREA };
  return { ok: true, valor: { subagente: nombre, tarea: texto } };
}

/**
 * @param {unknown} entrada
 * @returns {Salida & { nombre?: string }}
 */
export function cargarSkill(entrada) {
  const nombre = elegido(
    /** @type {Record<string, unknown>} */ (entrada ?? {}).nombre,
    NOMBRES_SKILLS,
  );
  if (nombre === null) return { contenido: ERROR_SKILL, esError: true };
  const { instrucciones } = SKILLS.find((s) => s.nombre === nombre);
  return { contenido: instrucciones, esError: false, nombre };
}

/**
 * Turns how a subagent ended into the result of its `delegar_subagente` call.
 * @param {string} nombre
 * @param {Final} final
 * @returns {Salida}
 */
export function resultadoSubagente(nombre, { estado, texto, pendientes }) {
  if (estado === 'rechazo') {
    return { contenido: `El subagente ${nombre} no puede responder a esta tarea.`, esError: true };
  }
  if (estado === 'limite') {
    return { contenido: `El subagente ${nombre} alcanzó el límite de consultas.`, esError: true };
  }
  if (pendientes || texto.trim() === '') {
    return { contenido: `El subagente ${nombre} no terminó su respuesta.`, esError: true };
  }
  return { contenido: texto, esError: false };
}
