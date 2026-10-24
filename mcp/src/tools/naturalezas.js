// @ts-check
import { loadSection } from '../../../site/js/core/load-section.js';
import { SECTIONS } from '../../../site/js/core/sections.js';
import { MENSAJES, errorResult, okResult } from '../results.js';
import { ENTRADA_NATURALEZAS, NATURALEZAS } from '../schemas.js';

const NOMBRE = 'naturalezas';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./catalogo.js').Deps} deps
 */
export function registrarNaturalezas(server, { port, log }) {
  server.registerTool(
    NOMBRE,
    {
      title: 'Naturalezas',
      description:
        'Devuelve las naturalezas de PokéAPI ordenadas por número, con la estadística que suben y la que bajan y los sabores que prefieren y odian. Con estadistica, solo las que suben o bajan esa estadística.',
      inputSchema: ENTRADA_NATURALEZAS,
      outputSchema: NATURALEZAS,
    },
    async ({ estadistica }) => {
      log.info(`tool ${NOMBRE}`);
      const result = await loadSection(port, SECTIONS.naturalezas, {
        page: 1,
        query: null,
        rawQuery: null,
      });
      if (result.status === 'error' || result.failedCount > 0) {
        log.error(`tool ${NOMBRE}: lista incompleta`);
        return errorResult(MENSAJES.caida);
      }
      const naturalezas = estadistica
        ? result.items.filter(
            (n) => n.increasedStat === estadistica || n.decreasedStat === estadistica,
          )
        : result.items;
      const resumen = estadistica
        ? `${naturalezas.length} naturalezas que suben o bajan ${estadistica}.`
        : `${naturalezas.length} naturalezas.`;
      return okResult(resumen, { naturalezas });
    },
  );
}
