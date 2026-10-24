// @ts-check
import { z } from 'zod';

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
            text: `Propón un equipo de 6 Pokémon para enfrentarse a rivales de tipo "${tipo}". Usa efectividad_tipos para saber qué tipos le hacen daño ×2 y cuáles resisten sus ataques, y buscar_pokemon y obtener_pokemon para elegir Pokémon de esos tipos y comprobar sus estadísticas. Explica en español por qué eliges cada uno. Los tipos van en inglés, como en PokéAPI (p. ej. fire).`,
          },
        },
      ],
    }),
  );
}
