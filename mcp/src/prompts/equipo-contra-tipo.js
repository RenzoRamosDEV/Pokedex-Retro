// @ts-check
import { z } from 'zod';
import { GUIA_EQUIPO } from '../../../site/js/core/guias.js';

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registrarEquipoContraTipo(server) {
  server.registerPrompt(
    'equipo_contra_tipo',
    {
      title: 'Equipo contra un tipo',
      description: 'Propone un equipo de 6 Pokémon para enfrentarse a rivales de un tipo.',
      argsSchema: {
        tipo: z.string().trim().min(1).max(50).describe('Tipo rival, en inglés (p. ej. dragon)'),
      },
    },
    ({ tipo }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Propón un equipo de 6 Pokémon para enfrentarse a rivales de tipo "${tipo}". ${GUIA_EQUIPO}`,
          },
        },
      ],
    }),
  );
}
