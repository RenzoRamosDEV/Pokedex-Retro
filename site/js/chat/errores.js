// @ts-check

/**
 * Classifies Messages API failures into the codes the chat view translates, and decides retries.
 * @typedef {'clave_invalida' | 'permiso' | 'peticion' | 'demasiado_larga' | 'limite_uso' | 'saturado' | 'red' | 'servidor'} CodigoError
 */

import { retryAfterMs } from '../api/client.js';

/** @type {Record<number, CodigoError>} */
const CODIGO_POR_ESTADO = {
  400: 'peticion',
  401: 'clave_invalida',
  403: 'permiso',
  413: 'demasiado_larga',
  429: 'limite_uso',
  529: 'saturado',
};

/** HTTP status equivalent to each `error.type`; unknown types are server errors. */
const ESTADO_POR_TIPO = {
  invalid_request_error: 400,
  authentication_error: 401,
  permission_error: 403,
  request_too_large: 413,
  rate_limit_error: 429,
  overloaded_error: 529,
};

const ESTADO_SERVIDOR = 500;
const ESPERAS_SIN_CABECERA_MS = [1000, 2000];

/**
 * @param {number} estado
 * @param {string} detalle
 */
export function crearErrorDeClaude(estado, detalle) {
  return Object.assign(new Error(detalle), {
    name: 'ErrorDeClaude',
    codigo: CODIGO_POR_ESTADO[estado] ?? 'servidor',
    estado,
    detalle,
  });
}

/**
 * @param {{ status: number, json(): Promise<any> }} respuesta
 */
export async function errorDeRespuesta(respuesta) {
  const cuerpo = await respuesta.json().catch(() => null);
  return crearErrorDeClaude(respuesta.status, cuerpo?.error?.message ?? `HTTP ${respuesta.status}`);
}

/** @param {{ tipo: string, message: string }} error */
export function errorDeEvento({ tipo, message }) {
  return crearErrorDeClaude(ESTADO_POR_TIPO[tipo] ?? ESTADO_SERVIDOR, message);
}

/** @param {number} estado */
export const esReintentable = (estado) => estado === 429 || estado >= 500;

/**
 * @param {import('../api/client.js').HeadersLike} headers
 * @param {number} intento 0 for the first retry
 * @param {() => number} now
 */
export const esperaReintento = (headers, intento, now) =>
  retryAfterMs(headers, now) ?? ESPERAS_SIN_CABECERA_MS[intento];
