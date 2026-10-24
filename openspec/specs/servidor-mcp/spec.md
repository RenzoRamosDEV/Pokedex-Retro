# servidor-mcp Specification

## Purpose
Permitir que clientes MCP locales (Claude Desktop, Claude Code) consulten la Pokédex mediante un servidor stdio que llama directamente a PokéAPI y devuelve los mismos datos que muestra la web, con errores accionables y un uso respetuoso de la API pública.

## Requirements

### Requirement: Arranque por stdio
`node mcp/bin/pokedex-mcp.js` SHALL arrancar un servidor MCP que se comunica por entrada y salida estándar, se identifica como `pokedex-retro` con la versión de `mcp/package.json` y anuncia las capacidades de tools, resources y prompts. No MUST abrir ningún puerto de red.

#### Scenario: Inicialización
- **WHEN** un cliente envía `initialize` por stdin al binario
- **THEN** la respuesta por stdout trae `serverInfo.name` `pokedex-retro`, `serverInfo.version` igual a la de `mcp/package.json` y las capacidades `tools`, `resources` y `prompts`

### Requirement: Catálogo de tools
El servidor SHALL exponer exactamente las tools `buscar_pokemon`, `obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento`, `buscar_habilidades`, `obtener_habilidad`, `buscar_objetos`, `obtener_objeto`, `buscar_bayas`, `obtener_baya`, `efectividad_tipos` y `naturalezas`, cada una con descripción en español orientada al modelo, `inputSchema` y `outputSchema`.

#### Scenario: Listado de tools
- **WHEN** un cliente llama a `tools/list`
- **THEN** recibe esas 12 tools, ni una más, todas con `description` no vacía, `inputSchema` y `outputSchema`

### Requirement: Respuesta legible y estructurada
Toda llamada correcta a una tool SHALL devolver `structuredContent` conforme a su `outputSchema` y un bloque `content` de tipo `text` que empieza por un resumen en español de una línea y contiene el JSON de `structuredContent`.

#### Scenario: Salida conforme al esquema
- **WHEN** se llama correctamente a cada una de las 12 tools
- **THEN** cada `structuredContent` valida contra el `outputSchema` anunciado por `tools/list` y el texto contiene ese mismo JSON

### Requirement: Búsqueda paginada
Las tools `buscar_*` SHALL aceptar `consulta` (texto de 1 a 50 caracteres), `pagina` (entero ≥ 1, por defecto 1) y `tamano_pagina` (entero de 1 a 50, por defecto 10), normalizar la consulta como la web (minúsculas, espacios por `-`), filtrar por nombre que la contiene y devolver `{ resultados, pagina, total_paginas, total }`, con `resultados` ordenados por `id` en la forma del mapper de la web.

#### Scenario: Primera página
- **WHEN** PokéAPI simulada tiene 12 Pokémon cuyo nombre contiene `char` y se llama a `buscar_pokemon` con `{ "consulta": "char" }`
- **THEN** `structuredContent` trae 10 `resultados`, `pagina` 1, `total_paginas` 2 y `total` 12

#### Scenario: Última página
- **WHEN** con esos 12 Pokémon se llama con `{ "consulta": "char", "pagina": 2 }`
- **THEN** trae 2 `resultados`, `pagina` 2 y `total_paginas` 2

#### Scenario: Consulta normalizada
- **WHEN** se llama a `buscar_pokemon` con `{ "consulta": " Mr Mime " }`
- **THEN** el filtro usa `mr-mime`

#### Scenario: Sin coincidencias
- **WHEN** ningún nombre contiene la consulta y `pagina` es 1
- **THEN** la respuesta no es de error y trae `resultados` vacío, `total_paginas` 0 y `total` 0

#### Scenario: Otras secciones
- **WHEN** se llama a `buscar_movimientos`, `buscar_habilidades`, `buscar_objetos` o `buscar_bayas` con una consulta que coincide
- **THEN** cada resultado tiene la forma del mapper de su sección (movimiento, habilidad, objeto o baya)

### Requirement: Página fuera de rango
Si `pagina` es mayor que 1 y mayor que el número de páginas, la tool `buscar_*` MUST responder con `isError: true` y el texto `La página <n> no existe; hay <total> páginas.` (`hay 1 página.` en singular).

#### Scenario: Página inexistente
- **WHEN** hay 3 páginas de resultados y se pide `pagina` 9
- **THEN** la respuesta tiene `isError: true` y el texto `La página 9 no existe; hay 3 páginas.`

#### Scenario: Una sola página
- **WHEN** hay 1 página de resultados y se pide `pagina` 2
- **THEN** el texto es `La página 2 no existe; hay 1 página.`

### Requirement: Entrada inválida
Una entrada que no cumple el esquema de la tool MUST producir un resultado con `isError: true` cuyo texto contiene el mensaje en español del campo, sin llamar a PokéAPI ni cerrar la sesión.

#### Scenario: Tamaño de página por encima del máximo
- **WHEN** se llama a `buscar_pokemon` con `{ "consulta": "char", "tamano_pagina": 51 }`
- **THEN** la respuesta tiene `isError: true`, su texto contiene `tamano_pagina debe estar entre 1 y 50.` y no se hace ninguna petición

#### Scenario: Límites válidos
- **WHEN** se llama con `tamano_pagina` 1 y luego con 50
- **THEN** ambas respuestas son correctas, con como máximo 1 y 50 resultados respectivamente

#### Scenario: Otros campos
- **WHEN** se llama con `consulta` vacía, con 51 caracteres, con `pagina` 0 o con `pagina` 1.5
- **THEN** cada respuesta tiene `isError: true` y el texto contiene el mensaje de ese campo

### Requirement: Detalle por nombre o número
Las tools `obtener_*` SHALL aceptar `nombre_o_id` (texto con letras, números, espacios o guiones, normalizado como la búsqueda, o entero ≥ 1) y devolver como `structuredContent` exactamente la salida del mapper de la web para ese recurso de PokéAPI.

#### Scenario: Por nombre
- **WHEN** se llama a `obtener_pokemon` con `{ "nombre_o_id": "Gengar" }`
- **THEN** se pide `https://pokeapi.co/api/v2/pokemon/gengar` y `structuredContent` es igual al mapper de Pokémon aplicado al fixture de gengar

#### Scenario: Por número
- **WHEN** se llama a `obtener_movimiento` con `{ "nombre_o_id": 85 }`
- **THEN** se pide `https://pokeapi.co/api/v2/move/85` y `structuredContent` es el movimiento mapeado

#### Scenario: Caracteres no permitidos
- **WHEN** se llama a `obtener_pokemon` con `{ "nombre_o_id": "../item/1" }`
- **THEN** la respuesta tiene `isError: true` y no se hace ninguna petición

### Requirement: Recurso inexistente
Si PokéAPI responde 404 a un detalle, la tool `obtener_*` MUST responder con `isError: true` y el texto `No existe <artículo y recurso> "<nombre>". Usa <tool de búsqueda> para encontrar el nombre exacto.`, con `el Pokémon`/`buscar_pokemon`, `el movimiento`/`buscar_movimientos`, `la habilidad`/`buscar_habilidades`, `el objeto`/`buscar_objetos` y `la baya`/`buscar_bayas`.

#### Scenario: Pokémon inexistente
- **WHEN** se llama a `obtener_pokemon` con `xyz` y PokéAPI responde 404
- **THEN** la respuesta tiene `isError: true` y el texto `No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.`

#### Scenario: Baya inexistente
- **WHEN** se llama a `obtener_baya` con `zzz` y PokéAPI responde 404
- **THEN** el texto es `No existe la baya "zzz". Usa buscar_bayas para encontrar el nombre exacto.`

### Requirement: PokéAPI no disponible
Si PokéAPI sigue fallando tras los reintentos (error de red, 429, 5xx o plazo agotado), o no se pudo cargar ningún resultado de una búsqueda con coincidencias, la tool MUST responder con `isError: true` y el texto `PokéAPI no responde; inténtalo en unos minutos.`

#### Scenario: Caída persistente
- **WHEN** PokéAPI responde 503 a todas las peticiones y se llama a `obtener_pokemon` con `pikachu`
- **THEN** tras 3 intentos la respuesta tiene `isError: true` y el texto `PokéAPI no responde; inténtalo en unos minutos.`

#### Scenario: Fallo parcial de detalles
- **WHEN** una búsqueda encuentra 3 coincidencias y falla el detalle de 1
- **THEN** la respuesta es correcta con 2 `resultados` y su resumen indica que 1 no se pudo cargar

### Requirement: Efectividad de tipos
`efectividad_tipos` SHALL aceptar `atacante` (nombre de tipo de PokéAPI) y `defensor` opcional (lista de 1 o 2 tipos distintos). Con defensor devuelve `{ atacante, defensor, multiplicador }`, producto de los multiplicadores (2, 0,5, 0 o 1) contra cada tipo; sin defensor, `{ atacante, multiplicadores }` con una clave por cada uno de los 18 tipos.

#### Scenario: Efectividad doble
- **WHEN** se llama con `{ "atacante": "electric", "defensor": ["water", "flying"] }`
- **THEN** `structuredContent` es `{ "atacante": "electric", "defensor": ["water", "flying"], "multiplicador": 4 }`

#### Scenario: Inmunidad
- **WHEN** se llama con `{ "atacante": "ghost", "defensor": ["normal"] }`
- **THEN** `multiplicador` es 0

#### Scenario: Sin defensor
- **WHEN** se llama con `{ "atacante": "fire" }`
- **THEN** `multiplicadores` tiene 18 claves, sin `stellar`, `unknown` ni `shadow`, con `grass` 2, `water` 0.5 y `normal` 1

#### Scenario: Defensor repetido
- **WHEN** se llama con `{ "atacante": "fire", "defensor": ["grass", "grass"] }`
- **THEN** la respuesta tiene `isError: true` y el texto contiene `defensor debe tener 1 o 2 tipos distintos.`

### Requirement: Tipo desconocido
Si `atacante` o algún `defensor` no es uno de los 18 tipos (PokéAPI también lista `stellar`, `unknown` y `shadow`, que no cuentan), `efectividad_tipos` MUST responder con `isError: true` y el texto `El tipo "<tipo>" no existe. Tipos válidos: <los 18 nombres separados por ", " en orden de id>.`

#### Scenario: Tipo sin tabla de daño
- **WHEN** se llama con `{ "atacante": "stellar" }`
- **THEN** la respuesta tiene `isError: true` y el texto empieza por `El tipo "stellar" no existe.`

#### Scenario: Tipo en español
- **WHEN** se llama con `{ "atacante": "fuego" }`
- **THEN** la respuesta tiene `isError: true` y el texto empieza por `El tipo "fuego" no existe. Tipos válidos: normal, fighting, flying,`

### Requirement: Naturalezas por estadística
`naturalezas` SHALL aceptar `estadistica` opcional (`attack`, `defense`, `special-attack`, `special-defense` o `speed`) y devolver `{ naturalezas }` con la salida del mapper de naturalezas ordenada por `id`: todas sin filtro, o solo las que suben o bajan esa estadística.

#### Scenario: Filtro por ataque
- **WHEN** se llama con `{ "estadistica": "attack" }`
- **THEN** cada naturaleza devuelta tiene `increasedStat` o `decreasedStat` igual a `attack` y no falta ninguna que lo cumpla

#### Scenario: Sin filtro
- **WHEN** PokéAPI simulada tiene 25 naturalezas y se llama sin argumentos
- **THEN** se devuelven las 25

#### Scenario: Estadística no admitida
- **WHEN** se llama con `{ "estadistica": "hp" }`
- **THEN** la respuesta tiene `isError: true` y el texto contiene `estadistica debe ser attack, defense, special-attack, special-defense o speed.`

### Requirement: Resource de la tabla de tipos
El servidor SHALL exponer el resource `pokedex://tipos/tabla` (`application/json`) con `{ tipos, multiplicadores }`: los 18 nombres de tipo en orden de id y, por cada atacante, el multiplicador contra cada defensor.

#### Scenario: Lectura de la tabla
- **WHEN** un cliente lee `pokedex://tipos/tabla`
- **THEN** recibe JSON con 18 `tipos` y 18 × 18 multiplicadores, con `multiplicadores.electric.ground` 0 y `multiplicadores.fire.grass` 2

### Requirement: Resource del catálogo de secciones
El servidor SHALL exponer el resource `pokedex://secciones` (`application/json`) con `{ secciones }`: una entrada `{ clave, recurso, tamano_pagina }` por cada sección de la web, con el tamaño de página de la web (`null` en las no paginadas).

#### Scenario: Lectura del catálogo
- **WHEN** un cliente lee `pokedex://secciones`
- **THEN** recibe 7 secciones, entre ellas `{ "clave": "pokedex", "recurso": "pokemon", "tamano_pagina": 18 }` y `{ "clave": "tipos", "recurso": "type", "tamano_pagina": null }`

### Requirement: Prompts guiados
El servidor SHALL exponer los prompts `comparar_pokemon` (argumentos obligatorios `a` y `b`) y `equipo_contra_tipo` (argumento obligatorio `tipo`), cuyo mensaje en español incluye los argumentos y nombra las tools que el modelo debe usar.

#### Scenario: Comparar dos Pokémon
- **WHEN** se pide `comparar_pokemon` con `{ "a": "pikachu", "b": "raichu" }`
- **THEN** el mensaje contiene `pikachu`, `raichu`, `obtener_pokemon` y `efectividad_tipos`

#### Scenario: Equipo contra un tipo
- **WHEN** se pide `equipo_contra_tipo` con `{ "tipo": "dragon" }`
- **THEN** el mensaje contiene `dragon`, `efectividad_tipos` y `buscar_pokemon`

#### Scenario: Argumento ausente
- **WHEN** se pide `comparar_pokemon` solo con `a`
- **THEN** la petición se rechaza con un error de parámetros inválidos

### Requirement: Identificación ante PokéAPI
Cada petición del servidor a `https://pokeapi.co/api/v2` SHALL llevar la cabecera `User-Agent: pokedex-retro-mcp/<versión de mcp/package.json> (+https://github.com/RenzoRamosDEV/Pokedex-Retro)`.

#### Scenario: Cabecera enviada
- **WHEN** se llama a `obtener_pokemon` con `pikachu`
- **THEN** la petición lleva `User-Agent: pokedex-retro-mcp/1.0.0 (+https://github.com/RenzoRamosDEV/Pokedex-Retro)`

### Requirement: Reintentos y plazo del servidor
El servidor SHALL reintentar como máximo 2 veces ante error de red, 429 y 5xx, esperando `500 ms × 2^intento` o lo indicado por `Retry-After` en un 429, y MUST abandonar una petición (esperas incluidas) a los 10 s. Un 404 u otro 4xx no se reintenta.

#### Scenario: 429 con Retry-After
- **WHEN** PokéAPI responde 429 con `Retry-After: 1` y luego 200, y se llama a `obtener_pokemon` con `pikachu`
- **THEN** el cliente espera al menos 1 s, reintenta una vez y devuelve el Pokémon

#### Scenario: Detalle inexistente sin reintento
- **WHEN** PokéAPI responde 404
- **THEN** se hace exactamente 1 petición

### Requirement: Concurrencia limitada del servidor
El servidor MUST tener como máximo 4 peticiones a PokéAPI en curso a la vez, contando las esperas entre reintentos.

#### Scenario: Búsqueda con muchos detalles
- **WHEN** una búsqueda pide 10 detalles y ninguno responde todavía
- **THEN** hay exactamente 4 peticiones en curso y las siguientes empiezan a medida que terminan

### Requirement: Caché en memoria
El servidor SHALL guardar en memoria cada respuesta correcta de PokéAPI por URL y reutilizarla sin petición durante 24 h desde que se obtuvo; una entrada caducada MUST pedirse de nuevo. Las respuestas de error no se guardan.

#### Scenario: Detalle repetido
- **WHEN** se llama dos veces a `obtener_pokemon` con `pikachu` en la misma sesión
- **THEN** se hace exactamente 1 petición

#### Scenario: Entrada caducada
- **WHEN** la segunda llamada ocurre 24 h después de la primera
- **THEN** se hace una segunda petición

### Requirement: Caché en disco opcional
Solo con `POKEDEX_MCP_DISK_CACHE=1`, el servidor SHALL guardar cada respuesta correcta en `$XDG_CACHE_HOME/pokedex-mcp/` (si es una ruta absoluta) o en `~/.cache/pokedex-mcp/`, un fichero `<SHA-256 hexadecimal de la URL>.json` con `{ "t": <epoch ms>, "data": <json> }`, y reutilizarla con el mismo TTL de 24 h en procesos posteriores.

#### Scenario: Reutilización entre procesos
- **WHEN** con la variable activa un servidor obtiene `pikachu` y otro servidor nuevo con el mismo directorio lo pide antes de 24 h
- **THEN** el segundo no hace ninguna petición

#### Scenario: Desactivada por defecto
- **WHEN** la variable no está definida o vale distinto de `1`
- **THEN** no se crea ningún fichero de caché

### Requirement: Caché en disco tolerante a fallos
Un error de sistema de ficheros al leer o escribir la caché en disco (permisos, disco lleno) MUST registrarse en stderr con nivel `error` e ignorarse: la tool sigue respondiendo con los datos de red. Un fichero ausente, corrupto o caducado es un fallo de caché normal: se pide a la red, se sobrescribe y no se registra como error.

#### Scenario: Directorio sin permisos
- **WHEN** el directorio de caché no admite escritura y se llama a `obtener_pokemon` con `pikachu`
- **THEN** la respuesta es correcta y stderr contiene una línea de nivel `error` sobre la caché

### Requirement: Stdout reservado al protocolo
Nada SHALL escribir en stdout salvo el transporte MCP: cada línea de stdout MUST ser un mensaje JSON-RPC 2.0 válido, con cualquier nivel de registro.

#### Scenario: stdout limpio
- **WHEN** con `POKEDEX_MCP_LOG=debug` se arranca el binario y se llama a `buscar_pokemon`
- **THEN** stdout solo contiene mensajes JSON-RPC y los registros aparecen en stderr

### Requirement: Registros por nivel
Los registros SHALL escribirse en stderr como `[pokedex-mcp] <nivel>: <mensaje>` según `POKEDEX_MCP_LOG`: `error` (por defecto y ante un valor no reconocido) solo errores; `info` añade arranque, parada y cada llamada a tool; `debug` añade cada URL pedida a PokéAPI y cada acierto de caché.

#### Scenario: Nivel por defecto
- **WHEN** sin `POKEDEX_MCP_LOG` se llama a `obtener_pokemon` con éxito
- **THEN** stderr no recibe ninguna línea

#### Scenario: Nivel debug
- **WHEN** con `POKEDEX_MCP_LOG=debug` se llama a `obtener_pokemon` con `pikachu`
- **THEN** stderr contiene una línea `debug` con `https://pokeapi.co/api/v2/pokemon/pikachu`

### Requirement: Cierre limpio
Al recibir `SIGINT` o `SIGTERM`, el servidor SHALL cerrar el transporte y terminar con código 0 en menos de 2 s, aunque el cierre no llegue a completarse.

#### Scenario: SIGTERM
- **WHEN** el binario está inicializado y recibe `SIGTERM`
- **THEN** el proceso termina con código 0 en menos de 2 s

#### Scenario: SIGINT
- **WHEN** el binario está inicializado y recibe `SIGINT`
- **THEN** el proceso termina con código 0 en menos de 2 s

### Requirement: Metadatos del paquete
`mcp/package.json` SHALL declarar `name` `pokedex-retro-mcp`, `type` `module`, `bin`, `files`, `exports`, `engines.node` `>=22`, `mcpName` `io.github.renzoramosdev/pokedex-retro` y como únicas dependencias de runtime `@modelcontextprotocol/sdk` y `zod` con versión exacta. `mcp/server.json` SHALL cumplir el esquema del registro MCP con ese nombre, la misma versión y transporte stdio.

#### Scenario: Versiones coherentes
- **WHEN** se ejecutan los tests del MCP
- **THEN** la versión de `mcp/server.json` y la de su paquete npm coinciden con la de `mcp/package.json`, y el nombre cumple el patrón del registro

#### Scenario: Dependencia añadida
- **WHEN** `mcp/package.json` declara una dependencia de runtime distinta de esas dos o con rango no exacto
- **THEN** los tests del MCP fallan nombrándola

### Requirement: Pruebas del servidor sin red
`npm run mcp:test` SHALL ejecutar con `node:test` los tests de `mcp/test/`, que hablan con el servidor por un transporte en memoria o lanzando el binario y sirven PokéAPI con un `fetch` falso a partir de los fixtures de la web, sin ninguna petición real.

#### Scenario: Sin red
- **WHEN** se ejecuta `npm run mcp:test` sin conexión a internet
- **THEN** todos los tests pasan
