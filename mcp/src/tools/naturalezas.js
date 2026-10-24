// @ts-check
import { DESCRIPCIONES, NATURALEZAS, naturalezas } from '../../../site/js/core/consultas.js';
import { ejecutarConsulta } from '../results.js';
import { ENTRADA_NATURALEZAS, NATURALEZAS as SALIDA } from '../schemas.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./catalogo.js').Deps} deps
 */
export function registrarNaturalezas(server, { port, log }) {
  server.registerTool(
    NATURALEZAS,
    {
      title: 'Naturalezas',
      description: DESCRIPCIONES[NATURALEZAS],
      inputSchema: ENTRADA_NATURALEZAS,
      outputSchema: SALIDA,
    },
    (entrada) => ejecutarConsulta(NATURALEZAS, log, () => naturalezas(port, entrada)),
  );
}
