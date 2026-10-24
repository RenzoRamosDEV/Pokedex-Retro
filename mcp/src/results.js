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
