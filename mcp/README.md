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

## Qué expone

| Tipo      | Nombre                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools     | `buscar_pokemon`, `obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento`, `buscar_habilidades`, `obtener_habilidad`, `buscar_objetos`, `obtener_objeto`, `buscar_bayas`, `obtener_baya`, `efectividad_tipos`, `naturalezas` |
| Resources | `pokedex://tipos/tabla`, `pokedex://secciones`                                                                                                                                                                                     |
| Prompts   | `comparar_pokemon`, `equipo_contra_tipo`                                                                                                                                                                                           |

## Configuración en clientes MCP

El servidor se ejecuta desde un clon del repositorio (después de `npm ci --prefix mcp`); sustituye la ruta por la ruta absoluta de tu clon.

Claude Desktop, en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pokedex-retro": {
      "command": "node",
      "args": ["/ruta/absoluta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add pokedex-retro -- node /ruta/a/Pokedex-Retro/mcp/bin/pokedex-mcp.js
```

Para añadir variables de entorno, usa la clave `env` de la configuración de Claude Desktop o la opción `--env` de `claude mcp add`.

## Inspección

`npm run mcp:inspect` abre el MCP Inspector en el navegador con el servidor ya conectado. Sin interfaz, el modo `--cli` del inspector permite llamadas sueltas:

```bash
npx -y @modelcontextprotocol/inspector@2.12.0 --cli node mcp/bin/pokedex-mcp.js --method tools/list
npx -y @modelcontextprotocol/inspector@2.12.0 --cli node mcp/bin/pokedex-mcp.js \
  --method tools/call --tool-name efectividad_tipos \
  --tool-arg atacante=electric --tool-arg 'defensor=["water","flying"]'
```

## Tools de búsqueda y detalle

Los nombres de PokéAPI van en inglés, en minúsculas y con guiones; los espacios de la entrada se convierten en guiones. Cada respuesta correcta trae un resumen de una línea seguido del JSON de `structuredContent`.

| Tool                 | Entrada                                                                                             | Salida                                                                          | Ejemplo                                    |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `buscar_pokemon`     | `consulta` (1–50 caracteres), `pagina` (≥ 1, por defecto 1), `tamano_pagina` (1–50, por defecto 10) | `{ resultados, pagina, total_paginas, total }`, resultados ordenados por número | `{ "consulta": "char" }`                   |
| `buscar_movimientos` | Igual que `buscar_pokemon`                                                                          | Igual, con movimientos                                                          | `{ "consulta": "thunder" }`                |
| `buscar_habilidades` | Igual que `buscar_pokemon`                                                                          | Igual, con habilidades                                                          | `{ "consulta": "levitate" }`               |
| `buscar_objetos`     | Igual que `buscar_pokemon`                                                                          | Igual, con objetos                                                              | `{ "consulta": "ball", "pagina": 2 }`      |
| `buscar_bayas`       | Igual que `buscar_pokemon`                                                                          | Igual, con bayas                                                                | `{ "consulta": "ch", "tamano_pagina": 5 }` |
| `obtener_pokemon`    | `nombre_o_id`: nombre (letras, números, espacios o guiones) o entero ≥ 1                            | El Pokémon con los mismos campos que la web                                     | `{ "nombre_o_id": "pikachu" }`             |
| `obtener_movimiento` | Igual que `obtener_pokemon`                                                                         | El movimiento                                                                   | `{ "nombre_o_id": 85 }`                    |
| `obtener_habilidad`  | Igual que `obtener_pokemon`                                                                         | La habilidad                                                                    | `{ "nombre_o_id": "levitate" }`            |
| `obtener_objeto`     | Igual que `obtener_pokemon`                                                                         | El objeto                                                                       | `{ "nombre_o_id": "master ball" }`         |
| `obtener_baya`       | Igual que `obtener_pokemon`                                                                         | La baya                                                                         | `{ "nombre_o_id": "cheri" }`               |

### Errores

Los errores llegan como resultado con `isError: true` y no cierran la sesión:

| Situación                                     | Texto                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Entrada inválida                              | Contiene el mensaje del campo, p. ej. `tamano_pagina debe estar entre 1 y 50.`    |
| Página fuera de rango                         | `La página 9 no existe; hay 3 páginas.`                                           |
| Recurso inexistente                           | `No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.` |
| PokéAPI caída tras los reintentos o sin datos | `PokéAPI no responde; inténtalo en unos minutos.`                                 |

Si una búsqueda carga solo parte de los resultados, la respuesta es correcta y el resumen indica cuántos no se pudieron cargar.

## Efectividad de tipos y naturalezas

Los nombres de tipo y de estadística van en inglés, como en PokéAPI.

| Tool                | Entrada                                                                                    | Salida                                                                                                                                            | Ejemplo                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `efectividad_tipos` | `atacante` (tipo); `defensor` opcional (1 o 2 tipos distintos)                             | Con defensor, `{ atacante, defensor, multiplicador }` (producto de 2, 0.5, 0 o 1); sin defensor, `{ atacante, multiplicadores }` con los 18 tipos | `{ "atacante": "electric", "defensor": ["water", "flying"] }` → `multiplicador` 4 |
| `naturalezas`       | `estadistica` opcional: `attack`, `defense`, `special-attack`, `special-defense` o `speed` | `{ naturalezas }` ordenadas por número; con `estadistica`, solo las que la suben o la bajan                                                       | `{ "estadistica": "speed" }`                                                      |

Un tipo que no está entre los 18 responde `El tipo "fuego" no existe. Tipos válidos: normal, fighting, flying, …`.

## Resources

| URI                     | Nombre        | Contenido (`application/json`)                                                                                            |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pokedex://tipos/tabla` | `tabla-tipos` | `{ tipos, multiplicadores }`: los 18 tipos en orden de número y, por cada atacante, el multiplicador contra cada defensor |
| `pokedex://secciones`   | `secciones`   | `{ secciones }`: una entrada `{ clave, recurso, tamano_pagina }` por sección de la web (`null` si no está paginada)       |

## Prompts

| Prompt               | Argumentos                      | Qué pide al modelo                                                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `comparar_pokemon`   | `a` y `b` (obligatorios)        | Comparar dos Pokémon con `obtener_pokemon` y `efectividad_tipos` y resumir quién tiene ventaja               |
| `equipo_contra_tipo` | `tipo` (obligatorio, en inglés) | Proponer un equipo de 6 Pokémon contra un tipo con `efectividad_tipos`, `buscar_pokemon` y `obtener_pokemon` |

## Cierre

El servidor termina cuando el cliente cierra stdin. Con `SIGINT` o `SIGTERM` cierra el transporte y sale con código 0 en menos de 2 s; si el cierre no termina en 1,5 s, sale igualmente.

## Variables de entorno

| Variable                 | Valores                                | Efecto                                                                                                                                                                                      |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POKEDEX_MCP_LOG`        | `error` (por defecto), `info`, `debug` | Nivel de registro en stderr. `info` añade arranque, parada y cada llamada a tool; `debug` añade cada URL pedida a PokéAPI y cada acierto de caché. Un valor desconocido equivale a `error`. |
| `POKEDEX_MCP_DISK_CACHE` | `1`                                    | Guarda cada respuesta correcta de PokéAPI en disco durante 24 h y la reutiliza entre procesos. Con cualquier otro valor, o sin definir, solo hay caché en memoria.                          |

Caché: en memoria durante 24 h por URL (las respuestas de error no se guardan). Con `POKEDEX_MCP_DISK_CACHE=1`, también en `$XDG_CACHE_HOME/pokedex-mcp/` si `XDG_CACHE_HOME` es una ruta absoluta, o en `~/.cache/pokedex-mcp/`, un fichero `<SHA-256 de la URL>.json` por respuesta. Se puede borrar sin consecuencias.

Cada petición a PokéAPI lleva `User-Agent: pokedex-retro-mcp/<versión> (+https://github.com/RenzoRamosDEV/Pokedex-Retro)`, tiene un plazo de 10 s, se reintenta hasta 2 veces ante errores de red, 429 y 5xx (respetando `Retry-After` en los 429) y hay como máximo 4 en curso a la vez.

## Limitaciones

- Usa la PokéAPI pública: haz un uso razonable. La caché de 24 h y el máximo de 4 peticiones simultáneas reducen la carga, y `POKEDEX_MCP_DISK_CACHE=1` la conserva entre sesiones.
- Los nombres de Pokémon, movimientos, tipos y estadísticas van en inglés, como en PokéAPI.
- La tabla de tipos tiene 18 tipos: `stellar` (que PokéAPI lista sin relaciones de daño), `unknown` y `shadow` quedan fuera, igual que en la página de tipos de la web.
- El paquete es `private` y se ejecuta desde el clon: reutiliza `site/js/core`, `site/js/mappers` y `site/js/api`, que están fuera de `mcp/` y npm no incluiría en el paquete. Publicarlo en npm exigirá empaquetar esos módulos; `server.json` queda preparado para el registro MCP.
