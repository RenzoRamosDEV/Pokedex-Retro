// @ts-check
import { CATALOGO, DESCRIPCIONES, buscar, obtener } from '../../../site/js/core/consultas.js';
import { ejecutarConsulta } from '../results.js';
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
 * @typedef {import('../../../site/js/core/consultas.js').FilaCatalogo} FilaCatalogo
 */

const SALIDAS = {
  pokedex: POKEMON,
  movimientos: MOVIMIENTO,
  habilidades: HABILIDAD,
  objetos: OBJETO,
  bayas: BAYA,
};

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {FilaCatalogo} fila
 * @param {Deps} deps
 */
function registrarBuscar(server, fila, { port, log }) {
  server.registerTool(
    fila.buscar,
    {
      title: `Buscar ${fila.plural}`,
      description: DESCRIPCIONES[fila.buscar],
      inputSchema: ENTRADA_BUSQUEDA,
      outputSchema: busqueda(SALIDAS[fila.clave]),
    },
    (entrada) => ejecutarConsulta(fila.buscar, log, () => buscar(port, fila, entrada)),
  );
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {FilaCatalogo} fila
 * @param {Deps} deps
 */
function registrarObtener(server, fila, { port, log }) {
  server.registerTool(
    fila.obtener,
    {
      title: `Obtener ${fila.recurso}`,
      description: DESCRIPCIONES[fila.obtener],
      inputSchema: ENTRADA_DETALLE,
      outputSchema: SALIDAS[fila.clave],
    },
    (entrada) => ejecutarConsulta(fila.obtener, log, () => obtener(port, fila, entrada)),
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
