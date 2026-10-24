// @ts-check
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registrarCompararPokemon } from './prompts/comparar-pokemon.js';
import { registrarEquipoContraTipo } from './prompts/equipo-contra-tipo.js';
import { registrarSecciones } from './resources/secciones.js';
import { registrarTablaTipos } from './resources/tipos.js';
import { registrarCatalogo } from './tools/catalogo.js';
import { registrarEfectividad } from './tools/efectividad.js';
import { registrarNaturalezas } from './tools/naturalezas.js';

/**
 * @param {{ port: import('./client.js').PokeApiPort, log: import('./log.js').Logger, version: string }} options
 */
export function createServer({ port, log, version }) {
  const server = new McpServer({ name: 'pokedex-retro', version });
  const deps = { port, log };
  registrarCatalogo(server, deps);
  registrarEfectividad(server, deps);
  registrarNaturalezas(server, deps);
  registrarTablaTipos(server, deps);
  registrarSecciones(server);
  registrarCompararPokemon(server);
  registrarEquipoContraTipo(server);
  return server;
}
