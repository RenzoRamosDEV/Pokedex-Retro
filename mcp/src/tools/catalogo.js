// @ts-check
import { fetchDetail, loadSection } from '../../../site/js/core/load-section.js';
import { normalizeQuery } from '../../../site/js/core/search.js';
import { SECTIONS } from '../../../site/js/core/sections.js';
import { MENSAJES } from '../../../site/js/core/mensajes.js';
import { errorResult, okResult } from '../results.js';
import {
  BAYA,
  ENTRADA_BUSQUEDA,
  ENTRADA_DETALLE,
  HABILIDAD,
  MOVIMIENTO,
  OBJETO,
  POKEMON,
  busqueda,
} from '../schemas.js';

/**
 * @typedef {{ port: import('../client.js').PokeApiPort, log: import('../log.js').Logger }} Deps
 */

const CATALOGO = [
  {
    clave: 'pokedex',
    buscar: 'buscar_pokemon',
    obtener: 'obtener_pokemon',
    recurso: 'el Pokémon',
    plural: 'Pokémon',
    etiqueta: 'Pokémon',
    salida: POKEMON,
  },
  {
    clave: 'movimientos',
    buscar: 'buscar_movimientos',
    obtener: 'obtener_movimiento',
    recurso: 'el movimiento',
    plural: 'movimientos',
    etiqueta: 'Movimiento',
    salida: MOVIMIENTO,
  },
  {
    clave: 'habilidades',
    buscar: 'buscar_habilidades',
    obtener: 'obtener_habilidad',
    recurso: 'la habilidad',
    plural: 'habilidades',
    etiqueta: 'Habilidad',
    salida: HABILIDAD,
  },
  {
    clave: 'objetos',
    buscar: 'buscar_objetos',
    obtener: 'obtener_objeto',
    recurso: 'el objeto',
    plural: 'objetos',
    etiqueta: 'Objeto',
    salida: OBJETO,
  },
  {
    clave: 'bayas',
    buscar: 'buscar_bayas',
    obtener: 'obtener_baya',
    recurso: 'la baya',
    plural: 'bayas',
    etiqueta: 'Baya',
    salida: BAYA,
  },
];

/**
 * @param {string} query
 * @param {{ total?: number, page?: number, totalPages?: number, failedCount?: number }} result
 */
function resumenBusqueda(query, { total, page, totalPages, failedCount }) {
  const base =
    total === 0
      ? `Sin resultados para "${query}".`
      : `${total} ${total === 1 ? 'resultado' : 'resultados'} para "${query}" · página ${page} de ${totalPages}.`;
  if (failedCount === 0) return base;
  const fallos = failedCount === 1 ? 'no se pudo cargar' : 'no se pudieron cargar';
  return `${base} ${failedCount} ${fallos}.`;
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {typeof CATALOGO[number]} fila
 * @param {Deps} deps
 */
function registrarBuscar(server, fila, { port, log }) {
  const nombre = fila.buscar;
  server.registerTool(
    nombre,
    {
      title: `Buscar ${fila.plural}`,
      description: `Busca ${fila.plural} de PokéAPI cuyo nombre contiene el texto dado (en inglés, minúsculas y guiones; los espacios se convierten en guiones) y devuelve una página de resultados completos ordenados por número. Usa ${fila.obtener} para un único resultado por nombre exacto.`,
      inputSchema: ENTRADA_BUSQUEDA,
      outputSchema: busqueda(fila.salida),
    },
    async ({ consulta, pagina, tamano_pagina }) => {
      log.info(`tool ${nombre}`);
      const query = normalizeQuery(consulta);
      const config = { ...SECTIONS[fila.clave], pageSize: tamano_pagina };
      const result = await loadSection(port, config, { page: pagina, query, rawQuery: consulta });
      if (result.status === 'error') {
        log.error(`tool ${nombre}: lista no disponible`);
        return errorResult(MENSAJES.caida);
      }
      if (pagina > 1 && pagina > result.totalPages) {
        return errorResult(MENSAJES.paginaInexistente(pagina, result.totalPages));
      }
      if (result.items.length === 0 && result.failedCount > 0) {
        log.error(`tool ${nombre}: ${result.failedCount} detalles no disponibles`);
        return errorResult(MENSAJES.caida);
      }
      return okResult(resumenBusqueda(query, result), {
        resultados: result.items,
        pagina: result.page,
        total_paginas: result.totalPages,
        total: result.total,
      });
    },
  );
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {typeof CATALOGO[number]} fila
 * @param {Deps} deps
 */
function registrarObtener(server, fila, { port, log }) {
  const nombre = fila.obtener;
  server.registerTool(
    nombre,
    {
      title: `Obtener ${fila.recurso}`,
      description: `Devuelve ${fila.recurso} de PokéAPI por su nombre exacto en inglés (p. ej. "pikachu"; los espacios se convierten en guiones) o por su número. Si no conoces el nombre exacto, usa antes ${fila.buscar}.`,
      inputSchema: ENTRADA_DETALLE,
      outputSchema: fila.salida,
    },
    async ({ nombre_o_id }) => {
      log.info(`tool ${nombre}`);
      const slug =
        typeof nombre_o_id === 'number' ? String(nombre_o_id) : normalizeQuery(nombre_o_id);
      try {
        const item = await fetchDetail(port, SECTIONS[fila.clave], slug);
        return okResult(`${fila.etiqueta} ${item.name} (#${item.id}).`, item);
      } catch (error) {
        if (error.status === 404) {
          return errorResult(MENSAJES.recursoInexistente(fila.recurso, slug, fila.buscar));
        }
        log.error(`tool ${nombre}: ${error.name}${error.status ? ` ${error.status}` : ''}`);
        return errorResult(MENSAJES.caida);
      }
    },
  );
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {Deps} deps
 */
export function registrarCatalogo(server, deps) {
  for (const fila of CATALOGO) {
    registrarBuscar(server, fila, deps);
    registrarObtener(server, fila, deps);
  }
}
