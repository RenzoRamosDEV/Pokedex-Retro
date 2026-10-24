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

## Variables de entorno

| Variable                 | Valores                                | Efecto                                                                                                                                                                                      |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POKEDEX_MCP_LOG`        | `error` (por defecto), `info`, `debug` | Nivel de registro en stderr. `info` añade arranque, parada y cada llamada a tool; `debug` añade cada URL pedida a PokéAPI y cada acierto de caché. Un valor desconocido equivale a `error`. |
| `POKEDEX_MCP_DISK_CACHE` | `1`                                    | Guarda cada respuesta correcta de PokéAPI en disco durante 24 h y la reutiliza entre procesos. Con cualquier otro valor, o sin definir, solo hay caché en memoria.                          |

Caché: en memoria durante 24 h por URL (las respuestas de error no se guardan). Con `POKEDEX_MCP_DISK_CACHE=1`, también en `$XDG_CACHE_HOME/pokedex-mcp/` si `XDG_CACHE_HOME` es una ruta absoluta, o en `~/.cache/pokedex-mcp/`, un fichero `<SHA-256 de la URL>.json` por respuesta. Se puede borrar sin consecuencias.

Cada petición a PokéAPI lleva `User-Agent: pokedex-retro-mcp/<versión> (+https://github.com/RenzoRamosDEV/Pokedex-Retro)`, tiene un plazo de 10 s, se reintenta hasta 2 veces ante errores de red, 429 y 5xx (respetando `Retry-After` en los 429) y hay como máximo 4 en curso a la vez.
