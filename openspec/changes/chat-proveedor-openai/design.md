# Diseño: chat también con clave de OpenAI

## Context

Motivación y alcance: proposal.md. Requisitos: `specs/chat-openai` y deltas. Decisiones previas del chat: `openspec/changes/archive/2026-10-24-chat-byok-claude/design.md` (D1–D13) y ADR 0005.

Estado actual relevante (código en `main`, 1.2.0):

- `site/js/chat/bucle.js` `responder(...)` está acoplado a Anthropic en cuatro puntos: `construirPeticion` (`peticion.js`), lectura con `crearMensaje`/`aplicarEvento` (`sse.js`), `bloquesParaHistorial` (`historial.js`) y la forma de `tool_result`/`sumarUso`; los errores salen de `errores.js` (`crearErrorDeClaude`, `esReintentable` por estado, `name: 'ErrorDeClaude'`).
- `crearLectorSse` (`sse.js`) solo trocea `event:`/`data:` y parsea JSON por `type`: sirve tal cual para el SSE de OpenAI.
- `clave.js` usa una sola clave de almacenamiento (`pokedex:chat:apikey`) y el prefijo `sk-ant-`; `modelos.js` solo lista Claude; `chat-view.js` toma todos sus textos de `STRINGS.chat`; `chat.html` tiene un único `<select id="chat-modelo">` estático con precios en el HTML.
- Mutación: `test:mutation:chat` encadena `stryker.chat-core.config.json` (core compartido + `herramientas.js`) y `stryker.chat.config.json` (resto de `site/js/chat`); en CI tarda 131 s en total, así que añadir el adaptador de OpenAI a una de ellas pondría en riesgo el límite de 180 s.
- Hechos verificados el 2026-10-24: preflight `OPTIONS https://api.openai.com/v1/responses` desde `https://renzoramosdev.github.io` → 200, `access-control-allow-origin: *`, `access-control-allow-headers: authorization,content-type`, métodos con `POST`; clave inválida → `401 {"error":{"type":"invalid_request_error","code":"invalid_api_key",...}}`.

Documentación oficial de OpenAI en la que se basa este diseño (consultada el 2026-10-24):

- Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Structured Outputs, «Supported schemas»: https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
- Reasoning (contexto entre turnos, `store: false`, `max_output_tokens`, esfuerzo): https://developers.openai.com/api/docs/guides/reasoning
- Conversation state (replay manual sin estado): https://developers.openai.com/api/docs/guides/conversation-state
- Streaming: https://developers.openai.com/api/docs/guides/streaming-responses y referencia de eventos https://developers.openai.com/api/reference/resources/responses/streaming-events
- Códigos de error: https://developers.openai.com/api/docs/guides/error-codes
- Prompt caching (semántica de `cached_tokens`): https://developers.openai.com/api/docs/guides/prompt-caching
- Modelos: https://developers.openai.com/api/docs/models, https://developers.openai.com/api/docs/models/gpt-6.1-sol, https://developers.openai.com/api/docs/models/gpt-6-astra, https://developers.openai.com/api/docs/models/gpt-6-luna
- Normalización de elementos de salida a entrada del SDK oficial (`toResponseInputItems`, citado por las guías anteriores): https://github.com/openai/openai-node/blob/master/src/lib/responses/ResponseInputItems.ts

## Goals / Non-Goals

**Goals:**
- `bucle.js` y la interfaz independientes del proveedor tras un puerto pequeño con exactamente dos adaptadores.
- Comportamiento de Claude idéntico: los tests existentes de `site/js/chat` pasan sin tocar sus aserciones.
- Una sola fuente de verdad para las 12 tools (definiciones, validación, ejecución y textos).

**Non-Goals:**
- Registro dinámico de proveedores, configuración por proveedor en datos o cualquier generalidad para un tercero.
- `previous_response_id`, `conversation`, `background`, modo `pro`, `reasoning.context` explícito, resúmenes de razonamiento.
- Recordar el proveedor elegido entre visitas (se carga siempre Claude; la clave de OpenAI recordada se usa al elegir OpenAI).

## Decisions

### D1. Puerto de proveedor

Nuevo `site/js/chat/proveedores/` con `anthropic.js`, `openai.js` e `index.js` (`PROVEEDORES = { anthropic, openai }`, `PROVEEDOR_POR_DEFECTO = 'anthropic'`). Cada adaptador es un objeto puro con:

| Miembro | Contrato |
| --- | --- |
| `construirPeticion({ modelo, clave, historial })` | `{ url, opciones }` listos para `fetch` |
| `mensajeUsuario(pregunta)` | elemento de historial con la pregunta |
| `crearLectura()` | `{ aplicar(eventoSse) → textoVisible, terminar() → Turno }`; `aplicar` lanza un error clasificado ante un evento de error |
| `resultados(salidas)` | elementos de historial con los resultados de las tools, en el orden de las llamadas |
| `errorDeRespuesta(respuesta)` | `Promise<ErrorChat & { reintentable }>` para respuestas no `ok` |
| `errorDeRed(detalle)`, `errorDesconocido(detalle)` | errores clasificados `red` y `servidor` (500) |

`Turno = { motivo: 'fin' | 'herramientas' | 'cortada' | 'rechazo', historial: elementos[], llamadas: { id, nombre, entrada }[], uso: { entrada, salida } }`, con `entrada` ya parseada o `ENTRADA_NO_JSON`. `ErrorChat = Error & { codigo, estado, detalle }`.

`bucle.js` queda así: `responder({ …, proveedor = PROVEEDORES.anthropic })` (el valor por defecto mantiene intactas las llamadas de `bucle.test.js`); `enviar` reintenta cuando `error.reintentable` y quedan intentos; `leerMensaje` usa `crearLectorSse` + `proveedor.crearLectura()`; tras cada turno decide por `motivo`: `rechazo` → `rechazo`; `cortada` → incorpora el turno solo si no hay llamadas; `herramientas` → límite de 8 o `Promise.all` sobre `llamadas` con `ejecutarHerramienta` y `proveedor.resultados`; `fin` → incorpora. Un error es «clasificado» si tiene `codigo`; si no, `proveedor.errorDesconocido(message)`. Las reglas de compromiso de turnos, abortos, notificaciones y suma de uso (D8 del cambio anterior) no cambian.

Alternativas: interfaz genérica con capacidades declarativas (YAGNI con dos proveedores); duplicar `bucle.js` por proveedor (duplicaría reintentos, límite, aborto y compromiso de turnos, justo la lógica más delicada).

### D2. Adaptador de Anthropic sin cambio de comportamiento

`proveedores/anthropic.js` compone los módulos actuales sin moverlos: `construirPeticion` de `peticion.js`, `crearMensaje`/`aplicarEvento` de `sse.js`, `bloquesParaHistorial` de `historial.js`, y `errores.js`. `errorDeRespuesta` = `errorDeRespuesta` actual + `reintentable: esReintentable(status)`; el cuerpo de un 429/5xx ahora se lee antes de reintentar, sin efecto visible. `uso` = la suma actual de `input_tokens` + `cache_read_input_tokens` + `cache_creation_input_tokens` y `output_tokens`. `resultados` produce el único mensaje `user` con los `tool_result` (`is_error: true` cuando corresponde). `sse.js`, `historial.js`, `peticion.js`, `errores.js` y sus tests no cambian; `bucle.test.js` sigue pasando sin tocar aserciones (si un import cambia de ruta, solo se ajusta el import).

### D3. Petición a la Responses API

`proveedores/openai.js` construye `POST https://api.openai.com/v1/responses` con cabeceras `content-type` y `authorization: Bearer <clave>` y cuerpo en orden fijo `model, instructions, input, tools, max_output_tokens, reasoning, store, stream` = `modelo, SISTEMA, historial, FUNCIONES, 8000, { effort: 'low' }, false, true`.

- `instructions` reutiliza `SISTEMA` de `peticion.js` (texto ya neutral respecto al proveedor).
- `effort: 'low'`: es el único valor común a los tres modelos según sus páginas (Astra: `low`…`max`; 6.1 Sol: sin `none`/`minimal`; Luna: `none`…`max`) y equivale al `effort: "low"` de Claude.
- `max_output_tokens: 8000`, igual que `max_tokens` de Claude (decisión del usuario). La guía de razonamiento recomienda reservar 25 000 al experimentar; ver Riesgos.
- Sin `include`: la guía de razonamiento indica que con `store: false` los elementos `reasoning` traen `encrypted_content` por defecto y que `include: ["reasoning.encrypted_content"]` es heredado y no hace falta.
- Sin `reasoning.context`: `auto` aplica el valor por defecto del modelo; como se reenvía el historial completo (D5), `all_turns` funciona allí donde el modelo lo use.
- Sin `parallel_tool_calls` (por defecto `true`), `tool_choice` (por defecto `auto`), `temperature`, `top_p`, `previous_response_id`, `conversation` ni `background`.
- Responses y no Chat Completions: la guía de razonamiento indica que Chat Completions no admite function calling con GPT-6 Astra ni GPT-6.1 Sol.

`modelos.js` añade `MODELOS_OPENAI` (`gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-luna`) y `MODELO_POR_DEFECTO_OPENAI = 'gpt-6.1-sol'`; `MODELOS` y `MODELO_POR_DEFECTO` de Claude no cambian.

### D4. Tools como `function` estricta

`FUNCIONES` se deriva en `openai.js` de `DEFINICIONES` (misma fuente que Claude): `{ type: 'function', name, description, parameters, strict: true }` con `parameters` = `input_schema` donde `required` lista todas las propiedades y cada propiedad no requerida originalmente pasa de `type: T` a `type: [T, 'null']` (patrón documentado en «Supported schemas»: todos los campos `required`, opcionales como unión con `null`, `additionalProperties: false`). En el catálogo actual todas las opcionales tienen `type` simple (`pagina`, `tamano_pagina`, `defensor`, `estadistica`); `nombre_o_id` (`anyOf` string|integer) es siempre requerida y `anyOf` anidado está soportado. El `enum` de `estadistica` se conserva tal cual, como en el ejemplo oficial de unión con `null`. No se añaden `minimum`/`maxLength`: los límites siguen en las descripciones y en la validación del cliente, igual que con Claude.

Llamadas: `arguments` se parsea con `JSON.parse`; si falla, `ENTRADA_NO_JSON`. Si parsea, se eliminan las propiedades de primer nivel con valor `null` y el objeto pasa por `ejecutarHerramienta` sin cambios (valores por defecto y mensajes idénticos al MCP).

Alternativa: `strict: false` con los esquemas de Claude tal cual; descartada porque el usuario pidió `strict` y la guía recomienda activarlo.

### D5. Lectura del stream e historial

`crearLectura()` de OpenAI:

- `response.output_text.delta` → devuelve `delta` (texto visible).
- `response.output_item.done` → guarda `item` en `output_index`, sin `created_by`.
- `response.completed` / `response.incomplete` → guarda `status`, `incomplete_details` y `usage`.
- `response.failed` → lanza el error de `response.error`; `error` → lanza el error del evento (D6).
- Cualquier otro evento (`response.created`, `response.in_progress`, `content_part`, `function_call_arguments.delta`, resúmenes…) se ignora: el elemento completo llega en `output_item.done`.

`terminar()`: sin evento final → `errorDeRed('stream incompleto')`. `motivo`: `incomplete` con `content_filter` → `rechazo`; otro `incomplete` → `cortada`; `completed` con alguna parte `refusal` en un `message` → `rechazo`; con algún `function_call` → `herramientas`; si no → `fin`. `historial` = los elementos en orden de `output_index`. `uso = { entrada: usage.input_tokens, salida: usage.output_tokens }` (según prompt caching, `cached_tokens` es un subconjunto de `input_tokens`; los de razonamiento lo son de `output_tokens`).

Historial: `mensajeUsuario(pregunta)` = `{ role: 'user', content: pregunta }`; cada turno añade sus elementos de salida tal cual (incluidos `reasoning` con `encrypted_content`, `message` con su `phase` si viene, y `function_call`), y `resultados(salidas)` añade un `{ type: 'function_call_output', call_id, output }` por llamada. Es la regla de la guía de conversation state y de reasoning para `store: false` («preserve every output item … and replay the complete history»); la única transformación es quitar `created_by`, el campo de solo salida que elimina `toResponseInputItems` del SDK oficial para los tipos que usamos. Un `function_call` cuyos `arguments` no parsean se reenvía igual (son una cadena, la API no exige objeto) con su `function_call_output` de error. La Responses API no tiene `is_error`: el texto de error es el `output`.

Alternativa: `previous_response_id` con `store: true`; descartada porque guardaría las conversaciones del visitante en su cuenta de OpenAI y contradice «conversación solo en memoria».

### D6. Errores y reintentos de OpenAI

Clasificación en `openai.js` con el mismo `ErrorChat` (`name: 'ErrorDeOpenAI'`) y códigos de `CodigoError` más uno nuevo, `sin_saldo`:

| Origen | Código | Reintento |
| --- | --- | --- |
| HTTP 400 | `peticion` (detalle `error.message` o `HTTP 400`) | no |
| HTTP 401 | `clave_invalida` | no |
| HTTP 403 | `permiso` | no |
| HTTP 429 con `error.type` o `error.code` de saldo (`insufficient_quota`, `credit_balance_exhausted`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded`, `organization_usage_limit_exceeded`) | `sin_saldo` | no |
| Otro HTTP 429 | `limite_uso` | sí |
| HTTP 503 | `saturado` | sí |
| Otro ≥ 500 | `servidor` | sí |
| Otro estado | `servidor` | no |
| `fetch` rechaza con `TypeError` | `red` | no |
| Evento `error` / `response.failed` | por `code`: `invalid_api_key` → `clave_invalida`; saldo → `sin_saldo`; `rate_limit_exceeded`, `slow_down` → `limite_uso`; `server_is_overloaded` → `saturado`; otro → `servidor` (500) | no |

La guía de códigos de error dice que reintentar errores de saldo «won't restore API access» y que 429 de ritmo, 500 y 503 se reintentan respetando `Retry-After`. Esperas: `esperaReintento` de `errores.js` (cabecera legible o 1 s y 2 s), compartida. Textos en `STRINGS` (D7).

### D7. Clave, interfaz y textos

- `clave.js`: `CLAVES_ALMACENAMIENTO = { anthropic: 'pokedex:chat:apikey', openai: 'pokedex:chat:apikey:openai' }`; `leerClave`, `guardarClave` y `olvidarClave` aceptan un último parámetro opcional con la clave de almacenamiento (por defecto la de Anthropic, así `clave.test.js` no cambia). `validarClave(proveedor, texto)` → `'ok' | 'formato' | 'otro_proveedor'`: Anthropic `sk-ant-` → ok, `sk-` → otro_proveedor, resto → formato; OpenAI `sk-ant-` → otro_proveedor, `sk-` → ok, resto → formato. `esClaveValida` se conserva.
- `chat.html`: título `CHAT CON CLAUDE U OPENAI`; `<label for="chat-proveedor">PROVEEDOR</label>` + `<select id="chat-proveedor">` fuera del formulario de clave y de la sección del chat; dos selectores estáticos de modelo, `chat-modelo` (Claude, sin cambios) y `chat-modelo-openai`, cada uno con su `<label>` `MODELO` en un contenedor que se oculta con `hidden` según el proveedor (ocultar `<option>` no es fiable entre navegadores); aviso de privacidad nuevo; la etiqueta de la clave la escribe `chat-main.js` desde `STRINGS`.
- `chat-main.js`: estado `proveedor`; al cambiar, `resetConversation()`, alterna contenedores de modelo, lee la clave del proveedor y llama a `showChat(clave !== null)`; pasa `proveedor` y el modelo del selector visible a `responder`; `OLVIDAR CLAVE` usa la clave de almacenamiento del proveedor; las claves de ambos se guardan en memoria por proveedor.
- `chat-view.js`: `setProvider(id)` elige la tabla de textos `{ ...STRINGS.chat, ...STRINGS.chatOpenai }` para OpenAI; `setBusy` deshabilita también el selector de proveedor y ambos de modelo; `showKeyError(motivo)` para los tres mensajes de formato. `STRINGS.chatOpenai` contiene `asistente: 'OPENAI'`, `rechazo`, `claveFormato`, `otroProveedor`, `errorClave`, `errorSinSaldo`, `errorSaturado`, `errorRed` y `errorServidor`; `STRINGS.chat` añade `otroProveedor` y las etiquetas `CLAVE DE ANTHROPIC`/`CLAVE DE OPENAI`. Los demás textos (límite, cortada, tokens, 400, 403, 429) son compartidos.

### D8. CSP

`connect-src https://pokeapi.co https://api.anthropic.com https://api.openai.com` en los 8 HTML y `404.html` en el mismo commit que el test exacto de `csp.test.js`, para que `check:html` y los tests pasen a la vez. La CSP sigue impidiendo exfiltrar la clave a cualquier otro origen.

### D9. Tests y mutación

- `tests/support/openai-sse.js` (fuera de `site/`): constructores de `response.created`, `output_text.delta`, `output_item.done` (`message` con `output_text` o `refusal`, `reasoning` con `encrypted_content`, `function_call`), `response.completed`/`incomplete`/`failed`, `error`, serialización `event:`/`data:` y troceado, reutilizando `trocear`/`respuestaSse` de `claude-sse.js` si encajan. Los usan los tests unitarios y el mock e2e.
- `proveedores/openai.test.js`: petición exacta y prohibidos, conversión de las 12 tools (golden de `required` y tipos nulables), lectura con cortes exhaustivos y multibyte, motivos, uso, historial (orden, `created_by` quitado, `encrypted_content` intacto), `function_call_output`, nulos, JSON inválido, tabla de errores completa con valores límite (429 de cada código de saldo, 429 sin cuerpo, 499/500/503/599).
- `proveedores/anthropic.test.js`: el adaptador reproduce exactamente lo que hoy hace `bucle.js` (motivos, historial con `fallback`, `tool_result` con `is_error`, uso) y `reintentable` por estado.
- `bucle.test.js` existente intacto; se añaden casos de OpenAI de extremo a extremo con `fetch` falso (bucle con tool, dos llamadas, límite 9 peticiones, sin saldo con una sola petición, 503×3, aborto).
- `stryker.chat-openai.config.json`: `mutate` = `site/js/chat/proveedores/openai.js`, comando solo sobre `openai.test.js`, `break: 95`; `stryker.chat.config.json` lo excluye y añade `proveedores/anthropic.js` e `index.js`; `test:mutation:chat` encadena `chat:core`, `chat:openai` y `chat`. Cada ejecución medida con `time` ≤ 180 s; si `chat` crece por encima, `bucle.js` se separa a su propia configuración con el mismo umbral. Ningún umbral `break` se baja.
- e2e: `tests/e2e/openai-mock.js` (`page.route('https://api.openai.com/**')`, `OPTIONS` con las cabeceras CORS verificadas, `POST` con SSE completo, errores JSON, registro de cuerpos y cabeceras) y casos nuevos en `chat.spec.js`.

## Risks / Trade-offs

- [`max_output_tokens` 8000 con modelos de razonamiento: el razonamiento puede agotar el presupuesto antes del texto (guía de reasoning)] → esfuerzo `low`; el caso se trata como `cortada` y se ve `(respuesta cortada por longitud)`; subir el límite sería un cambio de una constante documentado en la ADR 0006.
- [El `enum` de `estadistica` con tipo `["string","null"]` sin `null` en el `enum` sigue el ejemplo oficial; si la API lo rechazara con 400] → lo detecta la verificación real (6.x) con el 400 «Petición no válida: …»; corrección: añadir `null` al `enum`, sin cambio de spec.
- [`retry-after` puede no estar expuesto por CORS] → mismo comportamiento que con Claude: 1 s y 2 s; ambos caminos con test.
- [Formatos de eventos reconstruidos de la documentación, no de una respuesta real con clave válida] → los fixtures siguen la referencia de eventos; la verificación real cubre CORS, cabeceras, cuerpo aceptado hasta la autenticación y el 401; una respuesta real con clave válida queda fuera de alcance (coste).
- [Refactor del bucle rompe Claude] → `bucle.test.js` sin cambios de aserciones como red de seguridad, más los e2e de Claude existentes; refactor en pasos pequeños con `npm test` verde en cada uno.
- [Mutación del chat > 180 s al crecer] → configuración propia para `openai.js` y medición en cada tarea.
- [La clave de OpenAI en el navegador] → mismas mitigaciones que la ADR 0005 (CSP con `connect-src` cerrado, escapado, `sessionStorage` por defecto, `OLVIDAR CLAVE`) y aislamiento por proveedor.

## Migration Plan

Sin migración de datos: la clave de Anthropic sigue bajo `pokedex:chat:apikey`, así que los visitantes con clave recordada no la pierden. Despliegue por Pages tras el merge. Vuelta atrás: revertir el merge; una clave de OpenAI recordada queda huérfana e inocua bajo `pokedex:chat:apikey:openai`.
