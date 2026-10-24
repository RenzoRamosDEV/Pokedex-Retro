# Propuesta: chat también con clave de OpenAI (versión 1.3.0)

## Why

El chat de `chat.html` (1.2.0) solo funciona con una clave de Anthropic, así que quien solo tiene cuenta en OpenAI no puede usarlo. OpenAI permite llamar a `https://api.openai.com/v1/responses` desde el navegador (CORS verificado el 2026-10-24), de modo que el mismo chat sin backend puede aceptar también la clave de OpenAI del visitante y ejecutar las mismas 12 herramientas en su navegador.

## What Changes

- Selector `PROVEEDOR` en `chat.html` con `Claude (Anthropic)` (por defecto) y `OpenAI`. El selector de modelo muestra los modelos del proveedor elegido; los de Claude no cambian y los de OpenAI son `gpt-6.1-sol` (por defecto, equilibrado), `gpt-6-astra` (más capaz, más caro) y `gpt-6-luna` (más barato), con sus precios. Cambiar de proveedor empieza una conversación nueva.
- Una clave por proveedor, guardada por separado: la de Anthropic sigue en `pokedex:chat:apikey` (las claves ya guardadas siguen valiendo) y la de OpenAI en `pokedex:chat:apikey:openai`, con las mismas reglas de `Recordar en este navegador`. `OLVIDAR CLAVE` olvida solo la del proveedor elegido.
- Validación local por proveedor: OpenAI exige `sk-` y rechaza `sk-ant-`; si la clave pegada parece del otro proveedor, se indica en español cuál elegir.
- Petición a la Responses API de OpenAI con `fetch` directo (sin SDK): `POST https://api.openai.com/v1/responses`, `Authorization: Bearer <clave>`, `stream: true`, `store: false`, `max_output_tokens` 8000, esfuerzo de razonamiento `low`, las mismas 12 tools como `function` con esquemas `strict` derivados de las mismas definiciones, validación en el cliente, máximo 8 iteraciones y el historial reenviado tal cual (incluidos los elementos de razonamiento cifrados).
- Errores de OpenAI en español: 401 `Clave de OpenAI no válida. Revísala en platform.openai.com.`, 429 sin saldo `Tu cuenta de OpenAI no tiene saldo.` (sin reintento), y 429 de ritmo, 5xx y red con los mismos reintentos y textos análogos a los de Claude.
- Línea de tokens normalizada (entrada y salida) para ambos proveedores.
- Frontera puerto/adaptador de proveedor en el núcleo del chat: el bucle y la interfaz dejan de conocer el formato de cada API. El código de Anthropic pasa detrás del puerto sin cambiar su comportamiento.
- CSP de las 8 páginas y de `404.html`: `connect-src https://pokeapi.co https://api.anthropic.com https://api.openai.com`.
- Tests unitarios con streams SSE sintéticos de OpenAI, e2e con `https://api.openai.com/**` simulada, mutación del código nuevo y cambiado ≥ 95 % en ejecuciones de ≤ 180 s, y verificación real con una clave falsa `sk-falsa…` (401, sin coste).
- ADR `0006`, README, `docs/ARCHITECTURE.md`, `CHANGELOG.md` `[1.3.0]`, versión `1.3.0` en todos los manifiestos y etiqueta `v1.3.0`.

Fuera de alcance: otros proveedores; SDK de OpenAI; Chat Completions; `previous_response_id` o conversaciones guardadas en OpenAI (`store` siempre `false`); recordar el proveedor elegido entre visitas; persistir conversaciones; cambios en el MCP o en las tools; pruebas con una clave real.

## Capabilities

### New Capabilities

- `chat-openai`: el chat contra la Responses API de OpenAI con la clave del visitante: petición y modelos, streaming, herramientas en formato `function`, historial con elementos de salida, motivos de parada, errores, reintentos, uso de tokens y verificación real sin clave válida.

### Modified Capabilities

- `chat-claude`: la página ofrece el selector de proveedor; formulario, almacenamiento, olvido y confinamiento de la clave pasan a ser por proveedor; el aviso de privacidad nombra ambos destinos; el selector de modelo depende del proveedor.
- `seguridad-web`: la CSP permite además `connect-src https://api.openai.com`.
- `accesibilidad-web`: el selector de proveedor tiene etiqueta y entra en la auditoría axe del chat.
- `calidad-codigo`: mutación del chat en varias configuraciones encadenadas de ≤ 180 s, cada una ≥ 95 %; e2e también con `https://api.openai.com/**` simulada; tests del chat con streams sintéticos de ambos formatos.
- `gobierno-repositorio`: ADR `0001` a `0006`.
- `documentacion-proyecto`: README con el chat de ambos proveedores y la ADR 0006; arquitectura con `api.openai.com` en el diagrama del chat.
- `publicacion-versiones`: la verificación de la web publicada comprueba `1.3.0` y `api.openai.com` en la CSP de `chat.html`.

## Impact

- **Núcleo del chat** (`site/js/chat/`): nuevos `proveedores/anthropic.js` y `proveedores/openai.js` (puerto común) y `proveedores/index.js` (registro); `bucle.js` recibe el proveedor en vez de construir peticiones de Anthropic; `clave.js` y `modelos.js` pasan a ser por proveedor; las definiciones de `herramientas.js` no cambian y el adaptador de OpenAI las convierte a `function` estricta; `sse.js`, `historial.js`, `peticion.js` y `errores.js` se conservan como piezas del adaptador de Anthropic.
- **Interfaz**: `site/chat.html` (selector de proveedor, opciones de modelo por proveedor, textos), `site/js/ui/chat-main.js`, `site/js/ui/chat-view.js`, `site/js/ui/strings.js`; CSP en los 9 HTML de `site/`.
- **Tests y calidad**: `tests/support/openai-sse.js`, `tests/e2e/openai-mock.js`, `tests/e2e/chat.spec.js`, `site/js/ui/csp.test.js`, `site/js/pages-a11y.test.js`, `stryker.chat-openai.config.json` y el script `test:mutation:chat` encadenado.
- **Documentación y versión**: `docs/adr/0006-chat-multiproveedor-openai.md`, `README.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, manifiestos y `site/js/version.js`.
- **Sistemas externos**: `https://api.openai.com/v1/responses` (CORS con `access-control-allow-origin: *`); el coste lo paga la cuenta del visitante.
- **Dependencias**: ninguna nueva de runtime ni de desarrollo.
