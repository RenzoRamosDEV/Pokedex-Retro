// @ts-check
import { SECTIONS } from '../../../site/js/core/sections.js';

const MIME = 'application/json';

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registrarSecciones(server) {
  server.registerResource(
    'secciones',
    'pokedex://secciones',
    {
      title: 'Secciones de la Pokédex',
      description:
        'Secciones de la web con su recurso de PokéAPI y su tamaño de página (null si no está paginada).',
      mimeType: MIME,
    },
    (uri) => {
      const secciones = Object.entries(SECTIONS).map(([clave, section]) => ({
        clave,
        recurso: section.resource,
        tamano_pagina: section.pageSize,
      }));
      return { contents: [{ uri: uri.href, mimeType: MIME, text: JSON.stringify({ secciones }) }] };
    },
  );
}
