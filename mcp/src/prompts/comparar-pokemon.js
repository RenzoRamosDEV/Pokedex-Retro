// @ts-check
import { z } from 'zod';
import { GUIA_COMPARAR } from '../../../site/js/core/guias.js';

const nombre = z.string().trim().min(1).max(50);

/** @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server */
export function registrarCompararPokemon(server) {
  server.registerPrompt(
    'comparar_pokemon',
    {
      title: 'Comparar dos Pokémon',
      description: 'Compara dos Pokémon por tipos, estadísticas base y habilidades.',
      argsSchema: {
        a: nombre.describe('Primer Pokémon, en inglés (p. ej. pikachu)'),
        b: nombre.describe('Segundo Pokémon, en inglés (p. ej. raichu)'),
      },
    },
    ({ a, b }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Compara los Pokémon "${a}" y "${b}". ${GUIA_COMPARAR}`,
          },
        },
      ],
    }),
  );
}
