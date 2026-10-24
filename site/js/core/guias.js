// @ts-check

/** Tool guides shared by the MCP prompts and the chat skills, so both stay in sync. */

export const GUIA_COMPARAR =
  'Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí. Resume en español quién tiene ventaja y por qué. Si alguno no existe, usa buscar_pokemon para encontrar el nombre exacto.';

export const GUIA_EQUIPO =
  'Usa efectividad_tipos para saber qué tipos le hacen daño ×2 y cuáles resisten sus ataques, y buscar_pokemon y obtener_pokemon para elegir Pokémon de esos tipos y comprobar sus estadísticas. Explica en español por qué eliges cada uno. Los tipos van en inglés, como en PokéAPI (p. ej. fire).';
