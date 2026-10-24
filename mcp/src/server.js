// @ts-check
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * @param {{ port?: Function, log: import('./log.js').Logger, version: string }} options
 */
export function createServer({ version }) {
  return new McpServer({ name: 'pokedex-retro', version });
}
