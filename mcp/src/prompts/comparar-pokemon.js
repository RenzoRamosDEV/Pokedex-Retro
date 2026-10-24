// @ts-check
import { z } from 'zod';

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
            text: `Compara los Pokémon "${a}" y "${b}". Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí. Resume en español quién tiene ventaja y por qué. Si alguno no existe, usa buscar_pokemon para encontrar el nombre exacto.`,
          },
        },
      ],
    }),
  );
}
