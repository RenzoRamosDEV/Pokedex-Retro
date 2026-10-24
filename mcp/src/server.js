// @ts-check
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registrarCatalogo } from './tools/catalogo.js';
import { registrarEfectividad } from './tools/efectividad.js';
import { registrarNaturalezas } from './tools/naturalezas.js';

/**
 * @param {{ port: import('./client.js').PokeApiPort, log: import('./log.js').Logger, version: string }} options
 */
export function createServer({ port, log, version }) {
  const server = new McpServer({ name: 'pokedex-retro', version });
  registrarCatalogo(server, { port, log });
  registrarEfectividad(server, { port, log });
  registrarNaturalezas(server, { port, log });
  return server;
}
