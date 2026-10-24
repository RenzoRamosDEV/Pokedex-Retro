// @ts-check

/** @param {number} count @param {string} singular @param {string} plural */
const plural = (count, singular, plural) => (count === 1 ? singular : plural);

export const MENSAJES = {
  caida: 'PokéAPI no responde; inténtalo en unos minutos.',
  /** @param {number} pagina @param {number} total */
  paginaInexistente: (pagina, total) =>
    `La página ${pagina} no existe; hay ${total} ${plural(total, 'página', 'páginas')}.`,
  /** @param {string} recurso @param {string} nombre @param {string} herramienta */
  recursoInexistente: (recurso, nombre, herramienta) =>
    `No existe ${recurso} "${nombre}". Usa ${herramienta} para encontrar el nombre exacto.`,
  /** @param {string} tipo @param {string[]} validos */
  tipoDesconocido: (tipo, validos) =>
    `El tipo "${tipo}" no existe. Tipos válidos: ${validos.join(', ')}.`,
};

/**
 * @param {string} resumen
 * @param {Record<string, unknown>} datos
 */
export function okResult(resumen, datos) {
  return {
    content: [
      {
        type: /** @type {const} */ ('text'),
        text: `${resumen}\n\n${JSON.stringify(datos, null, 2)}`,
      },
    ],
    structuredContent: datos,
  };
}

/** @param {string} texto */
export function errorResult(texto) {
  return { content: [{ type: /** @type {const} */ ('text'), text: texto }], isError: true };
}
