// @ts-check
import { textoResultado } from '../../site/js/core/mensajes.js';

/**
 * @param {string} resumen
 * @param {Record<string, unknown>} datos
 */
export function okResult(resumen, datos) {
  return {
    content: [{ type: /** @type {const} */ ('text'), text: textoResultado(resumen, datos) }],
    structuredContent: datos,
  };
}

/** @param {string} texto */
export function errorResult(texto) {
  return { content: [{ type: /** @type {const} */ ('text'), text: texto }], isError: true };
}

/**
 * Runs a pure `core` tool operation, logging like every tool, and wraps its answer.
 * @param {string} nombre
 * @param {import('./log.js').Logger} log
 * @param {() => Promise<import('../../site/js/core/consultas.js').Consulta>} consultar
 */
export async function ejecutarConsulta(nombre, log, consultar) {
  log.info(`tool ${nombre}`);
  const salida = await consultar();
  if ('error' in salida) {
    if (salida.registro) log.error(`tool ${nombre}: ${salida.registro}`);
    return errorResult(salida.error);
  }
  return okResult(salida.resumen, salida.datos);
}
