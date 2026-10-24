# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.4.0] - 2026-10-25

### Añadido

- El chat se organiza en un agente principal (`profesor`), tres subagentes (`estratega-tipos`, `entrenador-equipos` e `investigador-pokedex`) y cuatro skills (`comparar-pokemon`, `equipo-contra-tipo`, `analizar-debilidades` y `recomendar-naturaleza`), definidos como módulos de datos en `site/js/chat/agentes/`, con Claude y con OpenAI.
- Herramienta `delegar_subagente`: el subagente trabaja en un bucle propio con el mismo proveedor, modelo y clave, como mucho 6 iteraciones y sin poder delegar a su vez; su texto vuelve al agente principal y sus tokens se suman a la línea de uso.
- Herramienta `usar_skill`: las instrucciones completas de una skill solo se cargan cuando el agente principal las pide.
- Indicadores `SUBAGENTE: <nombre>` y `SKILL: <nombre>` en la línea de estado; `DETENER` aborta también a los subagentes.
- Alcance solo Pokémon: ante cualquier otro tema o un intento de saltarse las instrucciones, la respuesta es `Solo puedo responder preguntas sobre Pokémon.` (restricción por instrucciones, de mejor esfuerzo).
- ADR 0007 y mutación propia de los agentes y el bucle (`stryker.chat-agentes.config.json`), con e2e de la delegación y de las preguntas fuera de tema.

### Cambiado

- Cada petición lleva el prompt de sistema y las herramientas de su agente; el agente principal declara 14 herramientas.
- Las skills `comparar-pokemon` y `equipo-contra-tipo` comparten su guía con los prompts del MCP (`site/js/core/guias.js`); el texto de los prompts del MCP no cambia.
- El aviso de `chat.html` advierte de que delegar en subagentes consume tokens adicionales.

## [1.3.0] - 2026-10-24

### Añadido

- OpenAI como segundo proveedor del chat: selector `PROVEEDOR` con `Claude (Anthropic)` (por defecto) y `OpenAI`, con la clave de OpenAI del propio visitante y la Responses API en streaming (`store: false`).
- Modelos de OpenAI con sus precios: GPT-6.1 Sol (por defecto), GPT-6 Astra y GPT-6 Luna.
- Las 12 herramientas como funciones estrictas para OpenAI, con los mismos nombres, límites y textos, y mensajes de error de OpenAI en español, incluido `Tu cuenta de OpenAI no tiene saldo.` sin reintento.
- Diagnóstico con `GET /v1/models` cuando un error de OpenAI llega sin cabeceras CORS, para mostrar si la clave no es válida o si OpenAI rechazó la petición con una clave válida.
- ADR 0006 y mutación propia del adaptador de OpenAI (`stryker.chat-openai.config.json`), con e2e contra la API de OpenAI simulada.

### Cambiado

- El bucle del chat usa un puerto de proveedor con dos adaptadores (Anthropic y OpenAI); el comportamiento con Claude no cambia.
- Una clave por proveedor: la de Anthropic sigue en `pokedex:chat:apikey` y la de OpenAI va en `pokedex:chat:apikey:openai`; `OLVIDAR CLAVE` olvida solo la del proveedor elegido.

### Seguridad

- La CSP de todas las páginas permite además `connect-src https://api.openai.com`; el resto de la política no cambia.
- La clave de OpenAI solo se envía a `api.openai.com` y la de Anthropic solo a `api.anthropic.com`.

## [1.2.0] - 2026-10-24

### Añadido

- Página `chat.html` para preguntar a Claude en lenguaje natural con la clave de Anthropic del propio visitante, en streaming, con selector de modelo (Opus 5.5, Sonnet 5.5 y Haiku 5.5), botones `ENVIAR`, `DETENER`, `NUEVA CONVERSACIÓN` y `OLVIDAR CLAVE`, y uso de tokens por pregunta.
- Las 12 herramientas del servidor MCP se ejecutan en el navegador con los mismos nombres, límites y textos de error, validadas antes de ejecutarse, con reintentos ante 429, 529 y 5xx y mensajes de error en español.
- Enlace `CHAT` en la navegación de todas las páginas y `chat.html` en `sitemap.xml`.
- ADR 0005 y mutación propia del chat (`npm run test:mutation:chat`, umbral 95 %), con e2e contra la API de Claude simulada.

### Cambiado

- La lógica de las tools (búsquedas, detalles, efectividad, naturalezas, tabla de tipos, textos y descripciones) pasa a `site/js/core` y la comparten la web y el MCP; el MCP no cambia de comportamiento.
- El panel INFO cuenta 8 secciones.

### Seguridad

- La CSP de todas las páginas permite además `connect-src https://api.anthropic.com`; el resto de la política no cambia.
- La clave del visitante solo vive en su navegador (`sessionStorage` por defecto) y solo se envía a `api.anthropic.com`; todo texto del chat se inserta escapado.

## [1.1.1] - 2026-10-24

### Corregido

- La tabla de TIPOS ya no muestra la fila y la columna vacías del tipo `stellar`; la web y el MCP comparten la misma lista de tipos excluidos.
- Los precios de OBJETOS vuelven a mostrarse: PokéAPI ya no devuelve `cost`, así que se usa el último precio de compra en `poke-dollar` de `prices` (o «—» si no hay ninguno). El MCP devuelve el mismo `cost`.
- La demo muestra a PIKACHU con su tipo real `ELECTRIC`.

### Cambiado

- Dependabot ya no propone versiones mayores de `@types/node`, porque el proyecto apunta a Node 22.

## [1.1.0] - 2026-10-24

`1.0.0` fue la versión de trabajo de `package.json` desde la fase 2 y nunca se etiquetó ni publicó; los cambios de las fases 1–5 se publican juntos en esta versión.

### Añadido

- CI en cada pull request y en cada push a `main` con Node 22 y 24: lint con ESLint, formato con Prettier, typecheck con `tsc`, hook de pre-commit y Dependabot.
- Plan del proyecto, cuatro ADR, licencia MIT, guía de contribución y plantilla de pull request.
- Cliente HTTP con reintentos, plazo de 10 s y cancelación al salir de la página.
- Caché de listas completas en `localStorage` (24 h) y de detalles en memoria y `sessionStorage`.
- Como máximo 6 peticiones de detalle simultáneas y aviso de los elementos que no se pudieron cargar.
- Página 404, `robots.txt`, `sitemap.xml` y manifiesto web con iconos.
- Versión de la web en el panel INFO, generada desde `package.json`.
- Detalle de Pokémon en un `<dialog>` nativo con enlace profundo `#pokemon-<id>`.
- Enlace para saltar al contenido, aviso `<noscript>`, región de estado anunciada, soporte de `prefers-reduced-motion` y tema inicial según `prefers-color-scheme`.
- Tests de la interfaz, mutación de `site/js/ui`, smoke e2e con Playwright y axe, y presupuestos de Lighthouse CI.
- Servidor MCP local por stdio con 12 tools, 2 resources y 2 prompts, caché en memoria y en disco opcional, registros en stderr y cierre limpio con `SIGINT` y `SIGTERM`.

### Cambiado

- GitHub Pages despliega solo tras un CI correcto de un push a `main`.
- Textos de la interfaz en español y centralizados en `strings.js` (`ANT.`, `SIG.`, `OCULTA`).
- El tema ya no tiene efectos al importarse y funciona aunque el almacenamiento falle.
- Meta description de las páginas corregida.
- Menú móvil y desplegables de tema e información operables por teclado.
- Contraste WCAG 2.1 AA en los temas NORMAL, DMG y MONO.
- Los reintentos ante 429 respetan la cabecera `Retry-After`.

### Seguridad

- Content Security Policy en `<meta>` sin `'unsafe-inline'` ni `'unsafe-eval'`.
- HTML sin estilos, scripts ni manejadores de eventos en línea, comprobado con un test.
- Fuentes autoalojadas; ya no se cargan desde Google Fonts.
- Workflows sin secretos y con permisos mínimos.

## [1.0.0-RC.0] - 2026-10-23

La etiqueta `v1.0.0-RC.0` apunta al primer commit del repositorio (`dcfbae7`, solo `package.json` y la configuración de Stryker); la versión inicial que se describe aquí es la del commit `73b20e6`, punto de partida del plan.

### Añadido

- Pokédex estática sobre PokéAPI v2 con HTML, CSS y JavaScript en módulos ES, sin frameworks ni build.
- Siete secciones (Pokédex, movimientos, tipos, habilidades, naturalezas, objetos y bayas) con buscador por nombre y, salvo Tipos y Naturalezas, paginación en la URL.
- Ficha detallada de cada Pokémon.
- Tres temas: NORMAL, DMG y MONO.
- Tests con `node --test` y mutación con Stryker sobre `site/js/core` y `site/js/mappers`.
- Despliegue de `site/` en GitHub Pages.

[1.4.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/compare/v1.0.0-RC.0...v1.1.0
[1.0.0-RC.0]: https://github.com/RenzoRamosDEV/Pokedex-Retro/releases/tag/v1.0.0-RC.0
