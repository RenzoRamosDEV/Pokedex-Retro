// @ts-check
import {
  CATALOGO,
  DESCRIPCIONES,
  DESCRIPCIONES_CAMPO,
  EFECTIVIDAD,
  ESTADISTICAS,
  NATURALEZAS,
  buscar,
  efectividad,
  naturalezas,
  obtener,
} from '../core/consultas.js';
import { MENSAJES_ENTRADA, textoResultado } from '../core/mensajes.js';

/**
 * The 12 MCP tools for the browser chat. Strict schemas cannot carry ranges, so limits live in
 * the field descriptions and `validarEntrada` enforces them with the MCP's normalisation.
 * @typedef {import('../core/consultas.js').PokeApiPort} PokeApiPort
 * @typedef {{ ok: true, valor: Record<string, unknown> } | { ok: false, mensaje: string }} Validacion
 */

/** Marks a tool input whose streamed JSON did not parse. */
export const ENTRADA_NO_JSON = Symbol('entrada no JSON');

const TEXTO_NO_JSON = 'La entrada de la herramienta no es JSON válido.';
const NOMBRE_VALIDO = /^[A-Za-z0-9 -]+$/;

/** @param {string} type @param {string} campo */
const campo = (type, campo) => ({ type, description: DESCRIPCIONES_CAMPO[campo] });

const PROPIEDADES_BUSQUEDA = {
  consulta: campo('string', 'consulta'),
  pagina: campo('integer', 'pagina'),
  tamano_pagina: campo('integer', 'tamano_pagina'),
};

const PROPIEDADES_DETALLE = {
  nombre_o_id: {
    anyOf: [{ type: 'string' }, { type: 'integer' }],
    description: DESCRIPCIONES_CAMPO.nombre_o_id,
  },
};

/**
 * @param {string} name
 * @param {Record<string, object>} properties
 * @param {string[]} required
 */
const definicion = (name, properties, required) => ({
  name,
  description: DESCRIPCIONES[name],
  input_schema: { type: 'object', properties, required, additionalProperties: false },
  strict: true,
  eager_input_streaming: true,
});

/** @param {any} valor */
const esEntero = (valor) => Number.isInteger(valor);

/**
 * @param {unknown} valor
 * @param {number} max
 * @returns {string | null}
 */
function textoRecortado(valor, max) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto.length >= 1 && texto.length <= max ? texto : null;
}

/**
 * @param {any} valor
 * @param {number} defecto
 * @param {number} max
 */
function enteroEnRango(valor, defecto, max) {
  const numero = valor === undefined ? defecto : valor;
  return esEntero(numero) && numero >= 1 && numero <= max ? numero : null;
}

/** @param {unknown} valor */
const tipo = (valor) => textoRecortado(valor, 20)?.toLowerCase() ?? null;

/** @type {Record<string, (entrada: Record<string, any>) => Validacion>} */
const VALIDADORES = {
  busqueda(entrada) {
    const consulta = textoRecortado(entrada.consulta, 50);
    if (consulta === null) return { ok: false, mensaje: MENSAJES_ENTRADA.consulta };
    const pagina = enteroEnRango(entrada.pagina, 1, Infinity);
    if (pagina === null) return { ok: false, mensaje: MENSAJES_ENTRADA.pagina };
    const tamano_pagina = enteroEnRango(entrada.tamano_pagina, 10, 50);
    if (tamano_pagina === null) return { ok: false, mensaje: MENSAJES_ENTRADA.tamano_pagina };
    return { ok: true, valor: { consulta, pagina, tamano_pagina } };
  },
  detalle({ nombre_o_id }) {
    const nombre = textoRecortado(nombre_o_id, 50);
    if (nombre !== null && NOMBRE_VALIDO.test(nombre)) {
      return { ok: true, valor: { nombre_o_id: nombre } };
    }
    if (esEntero(nombre_o_id) && nombre_o_id >= 1) return { ok: true, valor: { nombre_o_id } };
    return { ok: false, mensaje: MENSAJES_ENTRADA.nombre_o_id };
  },
  [EFECTIVIDAD]({ atacante, defensor }) {
    const atacanteValido = tipo(atacante);
    if (atacanteValido === null) return { ok: false, mensaje: MENSAJES_ENTRADA.atacante };
    if (defensor === undefined) return { ok: true, valor: { atacante: atacanteValido } };
    const defensores = Array.isArray(defensor) ? defensor.map(tipo) : [];
    const valido =
      defensores.length >= 1 &&
      defensores.length <= 2 &&
      !defensores.includes(null) &&
      new Set(defensores).size === defensores.length;
    if (!valido) return { ok: false, mensaje: MENSAJES_ENTRADA.defensor };
    return { ok: true, valor: { atacante: atacanteValido, defensor: defensores } };
  },
  [NATURALEZAS]({ estadistica }) {
    if (estadistica === undefined) return { ok: true, valor: {} };
    if (!ESTADISTICAS.includes(estadistica)) {
      return { ok: false, mensaje: MENSAJES_ENTRADA.estadistica };
    }
    return { ok: true, valor: { estadistica } };
  },
};

/**
 * @typedef {{ definicion: ReturnType<typeof definicion>, validar: (entrada: Record<string, any>) => Validacion, ejecutar: (port: PokeApiPort, valor: any) => Promise<import('../core/consultas.js').Consulta> }} Herramienta
 * @type {Herramienta[]}
 */
const HERRAMIENTAS = [
  ...CATALOGO.flatMap((fila) => [
    {
      definicion: definicion(fila.buscar, PROPIEDADES_BUSQUEDA, ['consulta']),
      validar: VALIDADORES.busqueda,
      ejecutar: (port, valor) => buscar(port, fila, valor),
    },
    {
      definicion: definicion(fila.obtener, PROPIEDADES_DETALLE, ['nombre_o_id']),
      validar: VALIDADORES.detalle,
      ejecutar: (port, valor) => obtener(port, fila, valor),
    },
  ]),
  {
    definicion: definicion(
      EFECTIVIDAD,
      {
        atacante: campo('string', 'atacante'),
        defensor: { ...campo('array', 'defensor'), items: { type: 'string' } },
      },
      ['atacante'],
    ),
    validar: VALIDADORES[EFECTIVIDAD],
    ejecutar: efectividad,
  },
  {
    definicion: definicion(
      NATURALEZAS,
      { estadistica: { ...campo('string', 'estadistica'), enum: ESTADISTICAS } },
      [],
    ),
    validar: VALIDADORES[NATURALEZAS],
    ejecutar: naturalezas,
  },
];

const POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.definicion.name, h]));

export const DEFINICIONES = HERRAMIENTAS.map((h) => h.definicion);

/**
 * Validates and normalises a tool input like the MCP's zod schemas; unknown fields are dropped.
 * @param {string} nombre
 * @param {unknown} entrada
 * @returns {Validacion}
 */
export function validarEntrada(nombre, entrada) {
  const objeto = entrada !== null && typeof entrada === 'object' ? entrada : {};
  return POR_NOMBRE.get(nombre).validar(/** @type {Record<string, any>} */ (objeto));
}

/**
 * @param {PokeApiPort} port
 * @param {string} nombre
 * @param {unknown} entrada
 * @returns {Promise<{ contenido: string, esError: boolean }>}
 */
export async function ejecutarHerramienta(port, nombre, entrada) {
  const herramienta = POR_NOMBRE.get(nombre);
  if (!herramienta) return { contenido: `Herramienta desconocida: ${nombre}.`, esError: true };
  if (entrada === ENTRADA_NO_JSON) return { contenido: TEXTO_NO_JSON, esError: true };
  const validacion = validarEntrada(nombre, entrada);
  if ('mensaje' in validacion) return { contenido: validacion.mensaje, esError: true };
  const salida = await herramienta.ejecutar(port, validacion.valor);
  if ('error' in salida) return { contenido: salida.error, esError: true };
  return { contenido: textoResultado(salida.resumen, salida.datos), esError: false };
}
