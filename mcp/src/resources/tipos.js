// @ts-check
import { MENSAJES } from '../../../site/js/core/mensajes.js';
import { loadTypeChart } from '../../../site/js/core/type-chart.js';

const URI = 'pokedex://tipos/tabla';
const MIME = 'application/json';

/**
 * Resources have no `isError`, so an outage is thrown and the SDK answers a JSON-RPC error.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../tools/catalogo.js').Deps} deps
 */
export function registrarTablaTipos(server, { port, log }) {
  server.registerResource(
    'tabla-tipos',
    URI,
    {
      title: 'Tabla de tipos',
      description:
        'Matriz de efectividad de los 18 tipos de PokéAPI: para cada atacante, el multiplicador contra cada defensor.',
      mimeType: MIME,
    },
    async (uri) => {
      let chart;
      try {
        chart = await loadTypeChart(port);
      } catch (error) {
        log.error(`resource ${URI}: ${error.message}`);
        throw new Error(MENSAJES.caida, { cause: error });
      }
      const multiplicadores = Object.fromEntries(
        chart.names.map((atacante) => [
          atacante,
          Object.fromEntries(
            chart.names.map((defensor) => [defensor, chart.multiplier(atacante, defensor)]),
          ),
        ]),
      );
      const text = JSON.stringify({ tipos: chart.names, multiplicadores });
      return { contents: [{ uri: uri.href, mimeType: MIME, text }] };
    },
  );
}
