# Propuesta: chat con Claude usando la clave del visitante (versión 1.2.0)

## Why

La Pokédex Retro es una web estática en GitHub Pages sin backend y ya expone sus datos a Claude por el servidor MCP local, pero quien solo visita la web no puede preguntar en lenguaje natural («¿qué tipos le hacen x4 a Gyarados?»). Un chat en el navegador que llame directamente a la API de Claude con la clave del propio visitante (BYOK) y ejecute en el navegador las mismas 12 herramientas del MCP lo resuelve sin servidor, sin exponer ninguna clave del dueño y sin coste para él.

## What Changes

- Nueva página `site/chat.html` con la cabecera común y un enlace `CHAT` en la navegación de las 8 páginas; entra en `sitemap.xml` y el panel INFO pasa a `SECCIONES 8`.
- Formulario de clave de Anthropic: validación local (`sk-ant-`), guardado en `sessionStorage` o, con `Recordar en este navegador`, en `localStorage` (clave `pokedex:chat:apikey`), botón `OLVIDAR CLAVE` y aviso de privacidad y coste. La clave solo sale hacia `https://api.anthropic.com`.
- Llamada en streaming a `POST https://api.anthropic.com/v1/messages` con `fetch` directo (sin SDK: cero dependencias de runtime), cabeceras de acceso directo desde navegador, `anthropic-version: 2026-10-21`, `max_tokens` 8000, esfuerzo `low`, caché automática y, con Opus 5.5 y Sonnet 5.5, fallback en servidor (`fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01`). Nunca se envían `temperature`, `top_p`, `top_k`, `thinking` ni `tool_choice` forzado.
- Selector de modelo: `claude-opus-5-5` (por defecto), `claude-sonnet-5-5`, `claude-haiku-5-5`, con precios informativos; cambiar de modelo empieza una conversación nueva.
- Parser SSE puro (`site/js/chat/sse.js`) que reconstruye todos los bloques del mensaje (texto, `tool_use`, `thinking` con firma, `fallback`) y tolera eventos partidos; el texto se pinta a medida que llega.
- Bucle de herramientas en el navegador con las 12 tools del MCP (mismos nombres, parámetros, límites y textos de error), declaradas en JSON Schema `strict` con `eager_input_streaming` y validadas en el cliente antes de ejecutarse; tools en paralelo con todos los `tool_result` en un único mensaje, `is_error` ante fallos, máximo 8 iteraciones por pregunta y tratamiento de `max_tokens` y `refusal`.
- Reintentos (429, 529, 5xx, hasta 2, respetando `retry-after`) y mensajes de error en español; botones `ENVIAR`, `DETENER` (aborta petición y tools) y `NUEVA CONVERSACIÓN`; conversación solo en memoria; línea de uso de tokens por pregunta.
- Renderizado siempre escapado (`textContent`/`escapeHtml`), sin Markdown ni HTML del modelo.
- CSP de las 8 páginas: `connect-src https://pokeapi.co https://api.anthropic.com`; el resto de la política no cambia.
- La lógica pura de las tools que hoy vive solo en `mcp/src` (textos de error, tabla de tipos, ejecución de búsquedas, detalles, efectividad y naturalezas, descripciones) pasa a `site/js/core`; el MCP la importa sin cambiar su comportamiento (tests y goldens intactos).
- Tests unitarios con `fetch` falso y streams SSE sintéticos, mutación propia del chat (`stryker.chat.config.json`, ≥ 95 %), e2e con la API de Claude simulada y axe en los tres temas; verificación manual en Chromium contra la API real sin clave válida.
- ADR `0005`, README (sección Chat), `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md` `[1.2.0]`, versión `1.2.0` en todos los manifiestos y etiqueta `v1.2.0`.

Fuera de alcance: backend, proxy o Worker; clave del dueño; guardar conversaciones entre visitas; Markdown o HTML del modelo; imágenes o ficheros; resources y prompts del MCP en el chat; cambios de comportamiento del MCP; pruebas contra la API real con una clave válida.

## Capabilities

### New Capabilities

- `chat-claude`: chat en el navegador contra la API de Claude con la clave del visitante: gestión de la clave, petición y modelos, streaming, herramientas y su bucle, errores, controles, renderizado seguro y uso de tokens.

### Modified Capabilities

- `seguridad-web`: la CSP de las 8 páginas permite además `connect-src https://api.anthropic.com`.
- `interfaz-web`: 8 páginas con enlace `CHAT`, marca activa y panel INFO `SECCIONES 8`; la guarda de literales visibles cubre los módulos del chat.
- `accesibilidad-web`: requisitos de accesibilidad del chat (registro `role="log"`, etiquetas, foco, axe en tres temas).
- `publicacion-web`: el sitemap lista las 8 páginas.
- `calidad-codigo`: cabeceras coherentes en 8 páginas, pureza también de `site/js/chat`, mutación del chat ≥ 95 % y e2e con la API de Claude simulada.
- `integracion-continua`: el CI ejecuta también `npm run test:mutation:chat` en Node 24.
- `gobierno-repositorio`: ADR `0001` a `0005`.
- `documentacion-proyecto`: README con sección Chat y ADR 0005; arquitectura con el flujo del chat.
- `publicacion-versiones`: la verificación de la web publicada incluye `chat.html` y la CSP con `api.anthropic.com`.

## Impact

- **Web nueva**: `site/chat.html`, `site/js/chat/` (módulos puros: SSE, petición, modelos, herramientas y validación, errores y reintentos, clave, bucle), `site/js/ui/chat-main.js`, `site/js/ui/chat-view.js`, estilos en `site/css/pokedex.css`, textos en `site/js/ui/strings.js`.
- **Web modificada**: los 7 HTML actuales (enlace `CHAT`, `SECCIONES 8`, CSP), `site/sitemap.xml`, `site/js/ui/main.js` (arranque común extraído), tests de CSP, sitio, accesibilidad, pureza y textos.
- **Lógica compartida**: nuevos `site/js/core/mensajes.js`, `site/js/core/type-chart.js`, `site/js/core/consultas.js`; `mcp/src/results.js`, `mcp/src/schemas.js`, `mcp/src/tools/*.js` y `mcp/src/resources/tipos.js` pasan a importarlos; se elimina `mcp/src/type-chart.js`.
- **Calidad y CI**: `stryker.chat.config.json`, exclusiones en `stryker.config.json` y `stryker.ui.config.json`, script `test:mutation:chat`, paso nuevo en `.github/workflows/ci.yml`, `tests/e2e/chat.spec.js` y `tests/e2e/anthropic-mock.js`.
- **Documentación y versión**: `docs/adr/0005-*.md`, `README.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `mcp/package.json`, `mcp/package-lock.json`, `mcp/server.json`, `site/js/version.js`.
- **Sistemas externos**: `https://api.anthropic.com` (CORS con `access-control-allow-origin: *`); el coste lo paga la cuenta del visitante.
- **Dependencias**: ninguna nueva de runtime ni de desarrollo.
