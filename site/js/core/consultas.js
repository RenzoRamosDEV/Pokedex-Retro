// @ts-check
import { fetchDetail, loadSection } from './load-section.js';
import { MENSAJES } from './mensajes.js';
import { normalizeQuery } from './search.js';
import { SECTIONS } from './sections.js';
import { loadTypeChart } from './type-chart.js';

/**
 * Pure operations behind the PokéAPI tools, shared by the MCP server and the browser chat.
 * Each one answers `{ resumen, datos }` or `{ error, registro? }`, where `registro` is what the
 * caller should log.
 * @typedef {import('./type-chart.js').PokeApiPort} PokeApiPort
 * @typedef {{ resumen: string, datos: Record<string, unknown> } | { error: string, registro?: string }} Consulta
 * @typedef {typeof CATALOGO[number]} FilaCatalogo
 */

export const CATALOGO = [
  {
    clave: 'pokedex',
    buscar: 'buscar_pokemon',
    obtener: 'obtener_pokemon',
    recurso: 'el Pokémon',
    plural: 'Pokémon',
    etiqueta: 'Pokémon',
  },
  {
    clave: 'movimientos',
    buscar: 'buscar_movimientos',
    obtener: 'obtener_movimiento',
    recurso: 'el movimiento',
    plural: 'movimientos',
    etiqueta: 'Movimiento',
  },
  {
    clave: 'habilidades',
    buscar: 'buscar_habilidades',
    obtener: 'obtener_habilidad',
    recurso: 'la habilidad',
    plural: 'habilidades',
    etiqueta: 'Habilidad',
  },
  {
    clave: 'objetos',
    buscar: 'buscar_objetos',
    obtener: 'obtener_objeto',
    recurso: 'el objeto',
    plural: 'objetos',
    etiqueta: 'Objeto',
  },
  {
    clave: 'bayas',
    buscar: 'buscar_bayas',
    obtener: 'obtener_baya',
    recurso: 'la baya',
    plural: 'bayas',
    etiqueta: 'Baya',
  },
];

export const ESTADISTICAS = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];

export const EFECTIVIDAD = 'efectividad_tipos';
export const NATURALEZAS = 'naturalezas';

/** Tool descriptions in `tools/list` order. */
export const DESCRIPCIONES = Object.fromEntries([
  ...CATALOGO.flatMap((fila) => [
    [
      fila.buscar,
      `Busca ${fila.plural} de PokéAPI cuyo nombre contiene el texto dado (en inglés, minúsculas y guiones; los espacios se convierten en guiones) y devuelve una página de resultados completos ordenados por número. Usa ${fila.obtener} para un único resultado por nombre exacto.`,
    ],
    [
      fila.obtener,
      `Devuelve ${fila.recurso} de PokéAPI por su nombre exacto en inglés (p. ej. "pikachu"; los espacios se convierten en guiones) o por su número. Si no conoces el nombre exacto, usa antes ${fila.buscar}.`,
    ],
  ]),
  [
    EFECTIVIDAD,
    'Calcula el multiplicador de daño de un tipo atacante contra 1 o 2 tipos defensores (producto de 2, 0.5, 0 o 1), o, sin defensor, sus multiplicadores contra los 18 tipos. Los tipos van en inglés, como en PokéAPI (p. ej. fire, water).',
  ],
  [
    NATURALEZAS,
    'Devuelve las naturalezas de PokéAPI ordenadas por número, con la estadística que suben y la que bajan y los sabores que prefieren y odian. Con estadistica, solo las que suben o bajan esa estadística.',
  ],
]);

export const DESCRIPCIONES_CAMPO = {
  consulta: 'Texto que debe contener el nombre, en inglés como en PokéAPI (p. ej. "char")',
  pagina: 'Página de resultados, desde 1',
  tamano_pagina: 'Resultados por página, de 1 a 50',
  nombre_o_id: 'Nombre en inglés de PokéAPI (p. ej. "pikachu") o número',
  atacante: 'Tipo atacante en inglés, p. ej. "electric"',
  defensor: '1 o 2 tipos defensores distintos, p. ej. ["water", "flying"]',
  estadistica: 'Estadística que la naturaleza sube o baja',
};

const SIN_CONSULTA = { page: 1, query: null, rawQuery: null };

/**
 * @param {string} query
 * @param {{ total?: number, page?: number, totalPages?: number, failedCount?: number }} result
 */
export function resumenBusqueda(query, { total, page, totalPages, failedCount }) {
  const base =
    total === 0
      ? `Sin resultados para "${query}".`
      : `${total} ${total === 1 ? 'resultado' : 'resultados'} para "${query}" · página ${page} de ${totalPages}.`;
  if (failedCount === 0) return base;
  const fallos = failedCount === 1 ? 'no se pudo cargar' : 'no se pudieron cargar';
  return `${base} ${failedCount} ${fallos}.`;
}

/**
 * @param {PokeApiPort} port
 * @param {FilaCatalogo} fila
 * @param {{ consulta: string, pagina: number, tamano_pagina: number }} entrada
 * @returns {Promise<Consulta>}
 */
export async function buscar(port, fila, { consulta, pagina, tamano_pagina }) {
  const query = normalizeQuery(consulta);
  const config = { ...SECTIONS[fila.clave], pageSize: tamano_pagina };
  const result = await loadSection(port, config, { page: pagina, query, rawQuery: consulta });
  if (result.status === 'error') return { error: MENSAJES.caida, registro: 'lista no disponible' };
  if (pagina > 1 && pagina > result.totalPages) {
    return { error: MENSAJES.paginaInexistente(pagina, result.totalPages) };
  }
  if (result.items.length === 0 && result.failedCount > 0) {
    return { error: MENSAJES.caida, registro: `${result.failedCount} detalles no disponibles` };
  }
  return {
    resumen: resumenBusqueda(query, result),
    datos: {
      resultados: result.items,
      pagina: result.page,
      total_paginas: result.totalPages,
      total: result.total,
    },
  };
}

/**
 * @param {PokeApiPort} port
 * @param {FilaCatalogo} fila
 * @param {{ nombre_o_id: string | number }} entrada
 * @returns {Promise<Consulta>}
 */
export async function obtener(port, fila, { nombre_o_id }) {
  const slug = typeof nombre_o_id === 'number' ? String(nombre_o_id) : normalizeQuery(nombre_o_id);
  try {
    const item = await fetchDetail(port, SECTIONS[fila.clave], slug);
    return { resumen: `${fila.etiqueta} ${item.name} (#${item.id}).`, datos: item };
  } catch (error) {
    if (error.status === 404) {
      return { error: MENSAJES.recursoInexistente(fila.recurso, slug, fila.buscar) };
    }
    return {
      error: MENSAJES.caida,
      registro: `${error.name}${error.status ? ` ${error.status}` : ''}`,
    };
  }
}

/**
 * @param {PokeApiPort} port
 * @param {{ atacante: string, defensor?: string[] }} entrada
 * @returns {Promise<Consulta>}
 */
export async function efectividad(port, { atacante, defensor }) {
  let chart;
  try {
    chart = await loadTypeChart(port);
  } catch (error) {
    return { error: MENSAJES.caida, registro: error.message };
  }
  const desconocido = [atacante, ...(defensor ?? [])].find((tipo) => !chart.names.includes(tipo));
  if (desconocido !== undefined) {
    return { error: MENSAJES.tipoDesconocido(desconocido, chart.names) };
  }
  if (defensor) {
    const multiplicador = defensor.reduce(
      (producto, tipo) => producto * chart.multiplier(atacante, tipo),
      1,
    );
    return {
      resumen: `${atacante} contra ${defensor.join('/')}: ×${multiplicador}.`,
      datos: { atacante, defensor, multiplicador },
    };
  }
  const multiplicadores = Object.fromEntries(
    chart.names.map((tipo) => [tipo, chart.multiplier(atacante, tipo)]),
  );
  return {
    resumen: `Multiplicadores de ${atacante} contra los ${chart.names.length} tipos.`,
    datos: { atacante, multiplicadores },
  };
}

/**
 * @param {PokeApiPort} port
 * @param {{ estadistica?: string }} entrada
 * @returns {Promise<Consulta>}
 */
export async function naturalezas(port, { estadistica }) {
  const result = await loadSection(port, SECTIONS.naturalezas, SIN_CONSULTA);
  if (result.status === 'error' || result.failedCount > 0) {
    return { error: MENSAJES.caida, registro: 'lista incompleta' };
  }
  const lista = estadistica
    ? result.items.filter((n) => n.increasedStat === estadistica || n.decreasedStat === estadistica)
    : result.items;
  const resumen = estadistica
    ? `${lista.length} naturalezas que suben o bajan ${estadistica}.`
    : `${lista.length} naturalezas.`;
  return { resumen, datos: { naturalezas: lista } };
}
