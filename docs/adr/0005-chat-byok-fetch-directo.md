# 0005. Chat con la clave del visitante y `fetch` directo a la API de Claude

- Estado: Aceptada
- Fecha: 2026-10-24

## Contexto

La web es estática (GitHub Pages, sin backend) y el servidor MCP solo sirve a quien lo instala en local. Se quiere que cualquier visitante pueda preguntar en lenguaje natural sobre la Pokédex sin que el dueño pague las llamadas ni exponga una clave propia. La web no tiene build ni dependencias de runtime ([ADR 0004](0004-javascript-jsdoc-ts-check.md)).

## Decisión

- `chat.html` pide al visitante su propia clave de Anthropic (BYOK) y llama desde el navegador a `POST https://api.anthropic.com/v1/messages` con `fetch` directo, en streaming, con la cabecera `anthropic-dangerous-direct-browser-access: true` que habilita el acceso desde navegador (CORS).
- La clave se guarda en `sessionStorage` por defecto y en `localStorage` solo si el visitante marca «Recordar en este navegador»; viaja únicamente en la cabecera `x-api-key` hacia `api.anthropic.com`.
- Las 12 herramientas del servidor MCP se ejecutan en el navegador contra PokéAPI con la misma lógica (`site/js/core`) y se validan en el cliente antes de ejecutarse.
- El parser SSE, la petición, la validación, los reintentos y el bucle de herramientas son módulos puros en `site/js/chat`, probados con un `fetch` falso.

## Consecuencias

- Sin servidor ni coste para el dueño: cada conversación se cobra en la cuenta del visitante, como avisa la página.
- La clave vive en el navegador, así que una XSS o una extensión maliciosa podría leerla. Mitigaciones:
  - CSP sin `unsafe-*` y con `connect-src` limitado a `https://pokeapi.co https://api.anthropic.com`: un script inyectado no puede enviar la clave a otro origen con `fetch`.
  - Todo texto del modelo, del usuario y de las herramientas se inserta con `textContent`; no se interpreta Markdown ni HTML.
  - `sessionStorage` por defecto, botón `OLVIDAR CLAVE` y aviso de privacidad visible; la clave nunca se escribe en el DOM, la consola ni la URL.
- Mantener el formato del streaming y de los bloques (texto, `tool_use`, `thinking`, `fallback`) es responsabilidad del proyecto; los tests usan streams SSE sintéticos con el formato documentado.

## Alternativas

- SDK oficial `@anthropic-ai/sdk`: descartado; exige un bundler o una dependencia de runtime servida desde la web, y la regla es cero dependencias de runtime sin build.
- Proxy o Worker propio con la clave del dueño: descartado; añade backend, coste para el dueño y un punto que proteger frente a abusos.
- Clave del dueño embebida en la web: descartada; quedaría pública en el código y cualquiera podría usarla.
