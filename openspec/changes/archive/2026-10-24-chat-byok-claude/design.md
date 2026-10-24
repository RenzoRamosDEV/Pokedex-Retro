# Diseño: chat con Claude usando la clave del visitante

## Context

Motivación y alcance: proposal.md. Requisitos: `specs/chat-claude` y deltas. Estado actual relevante:

- La web carga cada sección con `site/js/ui/main.js`: crea `fetchJson` con `createFetchJson` + `createApiCache`, envuelve un puerto `(url) => fetchJson(url, { signal }).then((json) => ({ ok: true, status: 200, json }))` y llama a `loadSection`. Además inicia versión, tema y desplegables.
- El MCP define las 12 tools en `mcp/src/tools/{catalogo,efectividad,naturalezas}.js`. La lógica de cada handler (normalizar, `loadSection`/`fetchDetail`, casos de error, resumen y datos) es pura salvo `server.registerTool` y `log`. Dependencias por módulo:
  - Puros (sin zod ni SDK): `results.js` (`MENSAJES`, `okResult`, `errorResult`), `type-chart.js` (`loadTypeChart`, importa solo `site/js/core` y `site/js/mappers/type.js`), `resumenBusqueda` y la tabla `CATALOGO` de `catalogo.js` salvo su campo `salida` (esquemas zod).
  - Con zod: `schemas.js` (esquemas de entrada y salida; contiene los mensajes de validación `MSG_*` y las descripciones de campo de `.describe()`), `prompts/*.js`.
  - Con SDK: `server.js` y el registro en `tools/*.js`.
- Los tests del MCP son de caja negra (cliente MCP real contra el servidor, PokéAPI falsa) y `server.test.js` compara `tools/list` con `mcp/test/fixtures/tools-list.golden.json`, que incluye descripciones y esquemas: cualquier texto movido debe producir exactamente los mismos bytes.
- Las validaciones zod del MCP normalizan además de validar: `trim` en textos, `toLowerCase` en tipos, valores por defecto (`pagina` 1, `tamano_pagina` 10), unicidad de `defensor`, y descartan propiedades desconocidas.
- Stryker: `stryker.config.json` (core+mappers, ≥ 95 %) y `stryker.ui.config.json` están cerca de 180 s; `npm test` ya recoge `site/js/**/*.test.js`.
- `check:html` compara cabeceras con `index.html`; `pages-a11y.test.js` y `site-files.test.js` fijan 7 páginas; `csp.test.js` fija la CSP exacta; `strings.test.js` fija los grupos de `STRINGS` y la lista de ficheros guardados.
- Hechos de la API verificados el 2026-10-24: preflight `OPTIONS` desde `https://renzoramosdev.github.io` → 200 con `access-control-allow-headers: x-api-key,anthropic-version,content-type,anthropic-dangerous-direct-browser-access,anthropic-beta` y `access-control-allow-origin: *`; clave inválida → `401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`.

## Goals / Non-Goals

**Goals:**
- Núcleo del chat en módulos puros de `site/js/chat/` (sin DOM, con `fetch`, almacenamiento, espera y puerto de PokéAPI inyectados), probados con fakes y mutación ≥ 95 %.
- Una sola fuente de verdad para la lógica, los textos y las descripciones de las tools, compartida por web y MCP.
- Interfaz mínima, escapada y accesible, coherente con el resto de páginas.

**Non-Goals:**
- Reutilizar el cliente HTTP de PokéAPI (`createFetchJson`) para Claude: su plazo de 10 s y su caché no sirven para un stream largo.
- Reanudar un stream cortado, persistir conversaciones, compactación, conteo previo de tokens, `display: "summarized"` del pensamiento.
- Tocar `resources/`, `prompts/`, `client.js`, `server.js` del MCP más allá de los imports.

## Decisions

### D1. Lógica de las tools en `site/js/core`, MCP como adaptador

Nuevos módulos puros:

| Módulo | Contenido | Origen |
| --- | --- | --- |
| `site/js/core/mensajes.js` | `MENSAJES` (caída, página inexistente, recurso inexistente, tipo desconocido), `MENSAJES_ENTRADA` (los siete `MSG_*`) y `textoResultado(resumen, datos)` = `` `${resumen}\n\n${JSON.stringify(datos, null, 2)}` `` | `mcp/src/results.js`, `mcp/src/schemas.js` |
| `site/js/core/type-chart.js` | `loadTypeChart(port)` sin cambios | `mcp/src/type-chart.js` (se elimina) |
| `site/js/core/consultas.js` | `CATALOGO` (sin `salida`), `ESTADISTICAS`, descripciones de tools y de campos, `resumenBusqueda` y las operaciones `buscar`, `obtener`, `efectividad`, `naturalezas` | handlers de `mcp/src/tools/*.js` |

Cada operación recibe `(port, …, entrada ya validada)` y devuelve `{ resumen, datos }` o `{ error, registro? }`; `registro` es el texto que el MCP hoy escribe con `log.error` (p. ej. `lista no disponible`, `<name> <status>`), así que el adaptador hace `log.info`, llama, registra `tool <nombre>: <registro>` si existe y envuelve con `okResult`/`errorResult`. `okResult` usa `textoResultado`. `schemas.js` conserva zod pero toma mensajes y descripciones de `core`. Los títulos (`title`) siguen en el MCP: el chat no los usa.

Verificación de no regresión: `npm run mcp:test` (incluido el golden de `tools/list`) en verde sin tocar ningún test ni golden del MCP, antes y después de cada movimiento.

Alternativas: copiar la lógica al chat (duplicación de textos que divergirían); importar `mcp/src` desde la web (arrastra zod y el SDK al navegador y rompe la dirección de dependencias `mcp → site`).

### D2. Módulos del chat

`site/js/chat/` (puros, `// @ts-check`, en el test de pureza):

- `modelos.js`: `MODELOS` con `id` y `fallback` (`true` en Opus 5.5 y Sonnet 5.5) y `MODELO_POR_DEFECTO = 'claude-opus-5-5'`.
- `herramientas.js`: `DEFINICIONES` (12 tools en el orden de `tools/list` del MCP), `validarEntrada(nombre, entrada)` y `ejecutarHerramienta(port, nombre, entrada)` → `{ contenido, esError }`.
- `peticion.js`: texto `SISTEMA` y `construirPeticion({ modelo, clave, mensajes })` → `{ url, opciones }` con cabeceras y cuerpo (D5).
- `sse.js`: lector incremental de eventos y reconstrucción del mensaje (D6).
- `historial.js`: `bloquesParaHistorial(content)` (D7).
- `errores.js`: clasificación de respuestas HTTP y eventos `error` en códigos, y política de reintento (D9).
- `clave.js`: formato y almacenamiento de la clave (D10).
- `bucle.js`: `responder({ mensajes, pregunta, modelo, clave, fetch, port, signal, esperar, alEvento })` → `{ estado, mensajes, uso, error? }` con `estado` ∈ `fin`, `cortada`, `rechazo`, `limite`, `error`, `abortada` (D8).

Interfaz en `site/js/ui/`: `chat-view.js` (operaciones sobre elementos inyectados: añadir mensaje, añadir texto, estado, uso, vaciar, modo ocupado; solo `textContent`), `chat-main.js` (punto de entrada de `chat.html`: eventos, `AbortController`, almacenamiento real) y `arranque.js` (versión, tema, desplegables, `storageOrNull` y el puerto de PokéAPI con `createLimit(6)`, extraídos de `main.js` y usados por ambas entradas). Los errores del núcleo son códigos (`clave_invalida`, `permiso`, `peticion`, `demasiado_larga`, `limite_uso`, `saturado`, `red`, `servidor`); `chat-view.js` los traduce con `STRINGS.chat`, de modo que `site/js/chat` no importa `ui`.

Alternativa: un único módulo `chat.js`; descartada por SRP y porque impide mutar el núcleo puro con umbral 95 % separado de la interfaz (85 %).

### D3. `chat.html` estático

Misma `<head>` que el resto (CSP nueva, fuentes, manifiesto, `description` propia) y misma cabecera con el enlace `CHAT` marcado. En `<main>`: salto, `<noscript>`, una región `role="status"` (errores, `CONSULTANDO: …`), formulario de clave con su aviso, `<select>` de modelo con las tres opciones y sus precios escritos en el HTML (texto estático, no generado), `<div role="log" aria-live="polite">`, formulario de pregunta con `<textarea>`, y botones `ENVIAR`, `DETENER`, `NUEVA CONVERSACIÓN` y `OLVIDAR CLAVE`. Sin `data-section`: no usa `main.js`. Los demás 7 HTML ganan el enlace `CHAT`, `SECCIONES 8` y la CSP nueva en el mismo commit para que `check:html` y los tests de CSP pasen de una vez.

### D4. Esquemas de entrada compatibles con `strict`

El modo estricto no admite `minimum`, `maximum`, `minLength`, `maxLength` ni restricciones complejas de array. Los `input_schema` usan solo `type`, `enum`, `anyOf` (`nombre_o_id`: `string` | `integer`), `items`, `required`, `additionalProperties: false` y `description`; los límites se expresan en la descripción del campo (las mismas que `.describe()` del MCP). `validarEntrada` reproduce la semántica zod del MCP con los mismos mensajes: `trim`; `toLowerCase` en tipos; enteros y rangos; regex de nombre `^[A-Za-z0-9 -]+$`; `defensor` de 1 o 2 tipos distintos; `estadistica` del enum; valores por defecto; propiedades desconocidas ignoradas (como zod en el MCP, sin texto nuevo). Resultado: `{ ok: true, valor }` o `{ ok: false, mensaje }`.

Textos solo para el modelo, definidos en `herramientas.js`: JSON que no parsea → `La entrada de la herramienta no es JSON válido.`; tool desconocida → `Herramienta desconocida: <nombre>.`

### D5. Petición

`construirPeticion` produce exactamente las cabeceras y el cuerpo de `specs/chat-claude` («Petición a la API de Claude», «Parámetros prohibidos», «Fallback en servidor según modelo»), con el orden de claves fijo `model, max_tokens, stream, system, tools, messages, output_config, cache_control[, fallbacks]` para que el prefijo cacheable sea estable. Sin `thinking`: los tres modelos piensan de forma adaptativa por defecto y Opus 5.5 rechaza desactivarlo. `SISTEMA` es una constante (sin fecha ni datos variables) para no invalidar la caché.

Alternativa: `@anthropic-ai/sdk`; descartada por la regla de cero dependencias de runtime y sin bundler (ADR 0005).

### D6. Lector SSE

Dos piezas en `sse.js`:

1. `crearLectorSse()`: recibe texto (decodificado con `TextDecoder` en modo `stream`, que resuelve caracteres multibyte partidos), acumula hasta una línea en blanco (`\n\n` o `\r\n\r\n`), y devuelve eventos `{ evento, datos }` con `datos` = JSON de las líneas `data:` unidas; ignora comentarios (`:`) y `ping`.
2. `aplicarEvento(mensaje, evento)`: `message_start` fija `id`, `model` y `usage`; `content_block_start` coloca una copia del `content_block` en su `index` (cualquier tipo, incluido `fallback`); los deltas aplican `text_delta` → `text`, `thinking_delta` → `thinking`, `signature_delta` → `signature`, `input_json_delta` → acumulador de texto aparte; `content_block_stop` convierte el acumulador de un `tool_use` con `JSON.parse` estricto (si falla, el bloque queda marcado como entrada inválida con el texto crudo); `message_delta` fija `stop_reason` y fusiona `usage`; `error` lanza un error clasificado. Devuelve el delta de texto visible, si lo hay, para pintarlo en el momento.

### D7. Bloques que vuelven al historial

Regla general: el turno del asistente se reenvía con sus bloques tal cual se reconstruyeron (incluidos `thinking` vacíos con `signature` y `fallback`). Excepción documentada por Anthropic para fallbacks a mitad de respuesta: se omiten `thinking`, `redacted_thinking` y `tool_use` anteriores al último bloque `fallback`; solo se ejecutan los `tool_use` que quedan. Un `tool_use` con entrada que no parsea se reenvía con `input: {}` (la API exige un objeto) y su `tool_result` lleva `is_error: true`.

Alternativa: reenviar todo sin excepción; descartada porque la guía oficial de fallback lo prohíbe y produciría `tool_use` del modelo que rechazó sin `tool_result` coherente.

### D8. Bucle y conversación

Por pregunta: `mensajes = conversacion + [user]`; hasta 1 + 8 peticiones. Tras cada stream: `refusal` → `rechazo`; `max_tokens` → `cortada` (sin ejecutar tools); `tool_use` → si ya hubo 8 iteraciones, `limite`; si no, `Promise.all` sobre los `tool_use` vigentes (D7), cada uno validado y ejecutado con `{ contenido, esError }`, y un único mensaje `user` con todos los `tool_result` en el orden de los `tool_use`; otro motivo → `fin`. `alEvento` notifica `texto`, `herramienta` (para `CONSULTANDO: <nombre>`) y `uso`.

Compromiso de turnos: la conversación solo incorpora los turnos de la pregunta si termina en `fin` o en `cortada` sin `tool_use`; en `rechazo`, `limite`, `error`, `abortada` o `cortada` con `tool_use` se descarta la pregunta entera del historial (el texto queda en pantalla). Así nunca se envía un `tool_use` sin su `tool_result`, nunca se edita un turno ya enviado (solo se deja de anexar una cola no confirmada) y se cumple el modelo «append-only» que exige el pensamiento preservado.

Uso: por petición, `entrada = input_tokens + cache_read_input_tokens + cache_creation_input_tokens` y `salida = output_tokens`, con el `usage` de `message_start` actualizado por `message_delta`; se suma por pregunta y se muestra solo en `fin` y `cortada`.

### D9. Errores y reintentos

`enviar` (en `bucle.js`) hace hasta 3 intentos: respuesta `ok` → stream; 429, 529 o ≥ 500 con intentos restantes → `esperar(ms)` y repetir, con `ms` = `retryAfterMs` de `site/js/api/client.js` (se exporta; acepta segundos o fecha HTTP) o, si no hay cabecera legible, 1000 y 2000; otro estado → lee el JSON de error y lanza el código. `fetch` que rechaza con `TypeError` → `red`, sin reintento; `AbortError` → `abortada`. Un evento `error` llegado por el stream no se reintenta. Mapeo por estado y por `error.type` según `specs/chat-claude`; estados sin texto propio (otros 4xx, 5xx agotados, `api_error`, tipos desconocidos) → `servidor` con `Error de Claude (<estado>). Inténtalo de nuevo.` (punto abierto resuelto con el mínimo texto que informa sin inventar causas; para eventos `error` sin estado se usa 500).

### D10. Clave

`clave.js`: `esClaveValida(texto)` (`trim` no vacío que empieza por `sk-ant-`), `leerClave({ session, local })` (sesión primero, después local), `guardarClave(almacenes, clave, recordar)` (escribe en uno y borra del otro, para que desmarcar «Recordar» olvide la copia persistente), `olvidarClave(almacenes)`. Toda lectura o escritura va en `try/catch`; `chat-main.js` guarda además la clave en una variable de la pestaña, de modo que un almacenamiento que lanza no impide usar el chat. La clave solo llega a `construirPeticion`; ningún código la escribe en el DOM, la consola o la URL, y el `<input>` se vacía tras guardar.

### D11. Controles y estado de la interfaz

Un único `AbortController` por pregunta, cuyo `signal` va a `fetch` y al puerto de PokéAPI. Mientras hay respuesta en curso: `ENVIAR`, el selector y `NUEVA CONVERSACIÓN` deshabilitados y `DETENER` habilitado; Enter envía y Mayús+Enter deja el salto de línea del `<textarea>`. `OLVIDAR CLAVE` aborta lo que haya en curso y vacía todo. Cambiar de modelo vacía la conversación. Al terminar, por cualquier motivo, el foco vuelve al campo de mensaje. Los mensajes llevan una etiqueta visible (`TÚ` / `CLAUDE`) desde `STRINGS.chat` y CSS con `white-space: pre-wrap`; nada pasa por `innerHTML` salvo la cabecera estática.

### D12. Mutación y tests

- `stryker.chat.config.json`: `mutate` = `site/js/chat/**/*.js` + `site/js/core/{mensajes,type-chart,consultas}.js` (sin tests); comando `node --test` sobre sus tests; `break` 95; script `test:mutation:chat` con `timeout 180`. `stryker.config.json` excluye esos tres módulos de `core` para no alargar su ejecución.
- `stryker.ui.config.json` excluye `chat-main.js` y `arranque.js` (arranque, cubiertos por e2e) y mantiene `chat-view.js`; si la ejecución pasa de 180 s, `chat-view.js` sale a `stryker.ui-chat.config.json` encadenado en `test:mutation:ui`.
- Unit tests con `fetch` falso que devuelve `Response` con `ReadableStream` de fragmentos SSE. Los eventos se construyen con `tests/support/claude-sse.js` (fuera de `site/`: no se publica, no se muta y no entra en el test de pureza), que comparten los tests unitarios y el mock del e2e para que ambos usen el mismo formato documentado. `esperar` falso que registra los milisegundos. Golden: el texto de `tool_result` de `obtener_pokemon gyarados` y de `efectividad_tipos` se compara con la salida del MCP usando los mismos fixtures.
- e2e: `tests/e2e/anthropic-mock.js` (`page.route('https://api.anthropic.com/**')`, responde `OPTIONS` con las cabeceras CORS verificadas y `POST` con cuerpos SSE completos en `text/event-stream`, registra los cuerpos recibidos) y `tests/e2e/chat.spec.js` (clave → pregunta → tool → respuesta, 401, DETENER con una petición retenida, axe en tres temas). `smoke.spec.js` añade `chat.html` a las comprobaciones de navegación y tema que recorren todas las páginas.

### D13. Documentación y versión

ADR `0005-chat-byok-fetch-directo.md` (Contexto, Decisión, Consecuencias, Alternativas: SDK, proxy/Worker, clave del dueño). README (sección «Chat» entre «Ejecutar en local» y «Servidor MCP», tests y decisiones), `docs/ARCHITECTURE.md` (tercer diagrama, carpetas, seguridad con la nueva CSP), `CONTRIBUTING.md` (8 páginas, nuevo script de mutación), `CHANGELOG.md` `[1.2.0]`. Versión con `npm version 1.2.0 --no-git-tag-version` en raíz y `mcp/`, más `mcp/server.json`, como en 1.1.0.

## Risks / Trade-offs

- [La clave vive en el navegador: una XSS o una extensión maliciosa podría leerla] → CSP sin `unsafe-*` y con `connect-src` limitado a PokéAPI y Anthropic (una XSS no puede exfiltrar a otro origen por `fetch`), todo texto por `textContent`, `sessionStorage` por defecto, botón `OLVIDAR CLAVE` y aviso visible; documentado en la ADR 0005.
- [`retry-after` puede no ser legible desde el navegador si la API no lo expone por CORS] → se usa si `headers.get` lo devuelve y, si no, 1 s y 2 s; ambos caminos tienen test.
- [La interceptación de Playwright y el preflight CORS] → el mock responde explícitamente `OPTIONS` con las cabeceras verificadas; la verificación real (tarea de cierre) cubre el preflight auténtico.
- [Más paralelismo contra PokéAPI con varias tools a la vez] → el puerto del chat comparte un `createLimit(6)`.
- [La mutación de `ui` o de `core` supera 180 s] → configuraciones separadas (D12) y medición con `time` en cada tarea de mutación.
- [Cambio de comportamiento accidental del MCP al mover lógica] → movimientos en pasos pequeños con `npm run mcp:test` y golden intactos tras cada uno.
- [Texto vacío del pensamiento (`display` por defecto `omitted`)] → la espera hasta el primer texto se cubre con la línea de estado; no se pide `summarized` para no mostrar razonamiento.
- [El modelo puede devolver Markdown pese a las instrucciones] → se muestra literal; es aceptable y seguro.

## Migration Plan

Sin migración de datos. El despliegue es el de Pages tras el merge. Vuelta atrás: revertir el merge; la clave guardada por visitantes en `localStorage` queda huérfana e inocua bajo `pokedex:chat:apikey` y se borra con «Borrar datos del sitio».
