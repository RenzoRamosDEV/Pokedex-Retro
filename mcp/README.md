# Servidor MCP de Pokédex Retro

Servidor [Model Context Protocol](https://modelcontextprotocol.io) local por stdio que permite a un cliente MCP (Claude Desktop, Claude Code u otro) consultar la Pokédex. Llama directamente a [PokéAPI](https://pokeapi.co) y reutiliza la lógica de la web (`site/js/core`, `site/js/mappers` y `site/js/api`), así que devuelve los mismos datos que muestra la web.

## Requisitos

- Node 22 o superior.
- Dependencias del servidor: `npm ci --prefix mcp` desde la raíz del repositorio.

## Uso

| Comando             | Qué hace                                                 |
| ------------------- | -------------------------------------------------------- |
| `npm run mcp:start` | Arranca el servidor por stdio (`mcp/bin/pokedex-mcp.js`) |
| `npm run mcp:test`  | Tests del servidor con `node --test`, sin red            |

El servidor solo escribe mensajes del protocolo en stdout; los registros van a stderr.
