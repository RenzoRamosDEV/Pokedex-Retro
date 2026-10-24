// @ts-check
import { MENSAJES } from '../../../site/js/core/mensajes.js';
import { errorResult, okResult } from '../results.js';
import { EFECTIVIDAD, ENTRADA_EFECTIVIDAD } from '../schemas.js';
import { loadTypeChart } from '../../../site/js/core/type-chart.js';

const NOMBRE = 'efectividad_tipos';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./catalogo.js').Deps} deps
 */
export function registrarEfectividad(server, { port, log }) {
  server.registerTool(
    NOMBRE,
    {
      title: 'Efectividad de tipos',
      description:
        'Calcula el multiplicador de daño de un tipo atacante contra 1 o 2 tipos defensores (producto de 2, 0.5, 0 o 1), o, sin defensor, sus multiplicadores contra los 18 tipos. Los tipos van en inglés, como en PokéAPI (p. ej. fire, water).',
      inputSchema: ENTRADA_EFECTIVIDAD,
      outputSchema: EFECTIVIDAD,
    },
    async ({ atacante, defensor }) => {
      log.info(`tool ${NOMBRE}`);
      let chart;
      try {
        chart = await loadTypeChart(port);
      } catch (error) {
        log.error(`tool ${NOMBRE}: ${error.message}`);
        return errorResult(MENSAJES.caida);
      }
      const desconocido = [atacante, ...(defensor ?? [])].find(
        (tipo) => !chart.names.includes(tipo),
      );
      if (desconocido !== undefined) {
        return errorResult(MENSAJES.tipoDesconocido(desconocido, chart.names));
      }
      if (defensor) {
        const multiplicador = defensor.reduce(
          (producto, tipo) => producto * chart.multiplier(atacante, tipo),
          1,
        );
        return okResult(`${atacante} contra ${defensor.join('/')}: ×${multiplicador}.`, {
          atacante,
          defensor,
          multiplicador,
        });
      }
      const multiplicadores = Object.fromEntries(
        chart.names.map((tipo) => [tipo, chart.multiplier(atacante, tipo)]),
      );
      return okResult(`Multiplicadores de ${atacante} contra los ${chart.names.length} tipos.`, {
        atacante,
        multiplicadores,
      });
    },
  );
}
