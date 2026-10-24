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

/** Validation texts per tool input field, shared by the MCP schemas and the browser chat. */
export const MENSAJES_ENTRADA = {
  consulta: 'consulta debe tener entre 1 y 50 caracteres.',
  pagina: 'pagina debe ser un entero mayor o igual que 1.',
  tamano_pagina: 'tamano_pagina debe estar entre 1 y 50.',
  nombre_o_id:
    'nombre_o_id debe ser un nombre (letras, números, espacios o guiones) o un entero mayor o igual que 1.',
  atacante: 'atacante debe ser un nombre de tipo de PokéAPI, p. ej. fire.',
  defensor: 'defensor debe tener 1 o 2 tipos distintos.',
  estadistica: 'estadistica debe ser attack, defense, special-attack, special-defense o speed.',
};

/**
 * @param {string} resumen
 * @param {unknown} datos
 */
export const textoResultado = (resumen, datos) => `${resumen}\n\n${JSON.stringify(datos, null, 2)}`;
