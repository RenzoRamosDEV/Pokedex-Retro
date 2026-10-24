# 0006. Chat también con la clave de OpenAI tras un puerto de proveedor

- Estado: Aceptada
- Fecha: 2026-10-24

## Contexto

El chat de `chat.html` (1.2.0, [ADR 0005](0005-chat-byok-fetch-directo.md)) solo acepta una clave de Anthropic, así que quien solo tiene cuenta en OpenAI no puede usarlo. La Responses API de OpenAI (`POST https://api.openai.com/v1/responses`) admite llamadas desde el navegador: el preflight CORS verificado el 2026-10-24 responde 200 con `access-control-allow-origin: *` y permite las cabeceras `authorization` y `content-type`. La web sigue sin backend, sin build y sin dependencias de runtime ([ADR 0004](0004-javascript-jsdoc-ts-check.md)).

## Decisión

- Un selector `PROVEEDOR` en `chat.html` ofrece `Claude (Anthropic)` (por defecto) y `OpenAI`; cambiar de proveedor empieza una conversación nueva.
- Con OpenAI el navegador llama a la Responses API con `fetch` directo, sin SDK: `authorization: Bearer <clave>`, `stream: true`, `store: false`, `max_output_tokens` 8000 y `reasoning: { effort: "low" }`, el único esfuerzo común a `gpt-6.1-sol`, `gpt-6-astra` y `gpt-6-luna`.
- La conversación vive solo en memoria: cada petición reenvía el historial completo, con los elementos de salida tal cual (incluidos los `reasoning` con `encrypted_content`, que con `store: false` llegan por defecto) salvo el campo de solo salida `created_by`, seguidos de un `function_call_output` por llamada.
- Las 12 herramientas se declaran como `function` con `strict: true`, derivadas de las mismas definiciones que usa Claude: todas las propiedades en `required` y las opcionales como unión con `null`. Los nulos de primer nivel se tratan como ausentes y la validación sigue en el cliente.
- Puerto de proveedor en `site/js/chat/proveedores/` con exactamente dos adaptadores (`anthropic.js`, que compone los módulos de 1.2.0 sin cambiarlos, y `openai.js`) y un registro en `index.js`. El bucle (`bucle.js`) solo conoce el puerto: petición, lectura del stream en un `Turno` normalizado (motivo, historial, llamadas y uso), resultados de las tools y clasificación de errores con su reintento.
- Una clave por proveedor: la de Anthropic sigue en `pokedex:chat:apikey` (las claves recordadas por 1.2.0 siguen valiendo) y la de OpenAI en `pokedex:chat:apikey:openai`. Cada una viaja solo a la API de su proveedor y `OLVIDAR CLAVE` olvida solo la del proveedor elegido.
- Errores de OpenAI: los 429 de saldo (`insufficient_quota` y los de límite de gasto) no se reintentan y muestran `Tu cuenta de OpenAI no tiene saldo.`; los 429 de ritmo y los 5xx se reintentan dos veces como con Claude.

## Consecuencias

- Quien tenga cuenta en cualquiera de los dos proveedores puede usar el chat, con el coste en su propia cuenta.
- Claude se comporta igual que en 1.2.0: los tests de `peticion.js`, `sse.js`, `historial.js`, `errores.js` y `bucle.js` siguen pasando sin cambiar aserciones.
- La CSP amplía `connect-src` a `https://pokeapi.co https://api.anthropic.com https://api.openai.com`; sigue impidiendo enviar una clave a cualquier otro origen.
- Riesgos:
  - La clave de OpenAI vive en el navegador, con las mismas mitigaciones de la ADR 0005 (CSP cerrada, `textContent`, `sessionStorage` por defecto, `OLVIDAR CLAVE`) más el aislamiento por proveedor.
  - Con modelos de razonamiento, `max_output_tokens` 8000 puede agotarse antes del texto (la guía de razonamiento recomienda reservar hasta 25 000 al experimentar). Se trata como respuesta cortada; subir el límite es cambiar una constante de `openai.js`.
  - Las respuestas de error de `POST /v1/responses` no llevan `Access-Control-Allow-Origin` (comprobado con `curl` el 2026-10-24: el 401 de una clave falsa llega sin ella, mientras que `GET /v1/models` con la misma clave responde 401 con `access-control-allow-origin: *`), así que el navegador solo ve un fallo de red. Mitigación: ante ese fallo, un único `GET /v1/models` con la misma clave distingue clave inválida (401), un rechazo con clave válida, probablemente por saldo o límites (200, `OpenAI rechazó la petición. Revisa el saldo y los límites de tu cuenta en platform.openai.com.`) y falta de conexión (cualquier otra cosa). Si OpenAI añade CORS a sus errores, se usan directamente las respuestas legibles. No se distingue el 429 de saldo del de ritmo ni de un 5xx cuando no son legibles.
  - Los formatos de eventos se reconstruyen de la documentación oficial; la verificación real con una clave falsa cubre CORS, cabeceras, la aceptación del cuerpo hasta la autenticación y el 401 a través del diagnóstico, sin coste.
- La mutación del chat se reparte en tres configuraciones encadenadas de ≤ 180 s (`chat:core`, `chat:openai` y `chat`).

## Alternativas

- SDK oficial de OpenAI: descartado por la misma razón que el de Anthropic: exige bundler o una dependencia de runtime.
- Chat Completions: descartado; según la guía de razonamiento no admite function calling con GPT-6 Astra ni GPT-6.1 Sol.
- `previous_response_id` con `store: true`: descartado; guardaría las conversaciones del visitante en su cuenta de OpenAI, en contra de la conversación solo en memoria.
- Proxy o Worker propio: descartado, como en la ADR 0005 (backend, coste y abuso).
- Abstracción genérica de proveedores con capacidades declarativas o registro dinámico: descartada por YAGNI con dos proveedores; duplicar `bucle.js` por proveedor también, porque duplicaría reintentos, límite, aborto y compromiso de turnos.

## Referencias

- Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Structured Outputs, «Supported schemas»: https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
- Reasoning: https://developers.openai.com/api/docs/guides/reasoning
- Conversation state: https://developers.openai.com/api/docs/guides/conversation-state
- Streaming: https://developers.openai.com/api/docs/guides/streaming-responses y https://developers.openai.com/api/reference/resources/responses/streaming-events
- Códigos de error: https://developers.openai.com/api/docs/guides/error-codes
- Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
- Modelos: https://developers.openai.com/api/docs/models
- `toResponseInputItems` del SDK oficial: https://github.com/openai/openai-node/blob/master/src/lib/responses/ResponseInputItems.ts
