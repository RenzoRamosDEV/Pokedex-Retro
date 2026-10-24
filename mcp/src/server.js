// @ts-check
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registrarCatalogo } from './tools/catalogo.js';

/**
 * @param {{ port: import('./client.js').PokeApiPort, log: import('./log.js').Logger, version: string }} options
 */
export function createServer({ port, log, version }) {
  const server = new McpServer({ name: 'pokedex-retro', version });
  registrarCatalogo(server, { port, log });
  return server;
}
