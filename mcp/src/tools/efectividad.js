// @ts-check
import { DESCRIPCIONES, EFECTIVIDAD, efectividad } from '../../../site/js/core/consultas.js';
import { ejecutarConsulta } from '../results.js';
import { EFECTIVIDAD as SALIDA, ENTRADA_EFECTIVIDAD } from '../schemas.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./catalogo.js').Deps} deps
 */
export function registrarEfectividad(server, { port, log }) {
  server.registerTool(
    EFECTIVIDAD,
    {
      title: 'Efectividad de tipos',
      description: DESCRIPCIONES[EFECTIVIDAD],
      inputSchema: ENTRADA_EFECTIVIDAD,
      outputSchema: SALIDA,
    },
    (entrada) => ejecutarConsulta(EFECTIVIDAD, log, () => efectividad(port, entrada)),
  );
}
