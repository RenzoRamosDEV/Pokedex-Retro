# Spec Delta

## Purpose

Permite que el visitante de la web estática pregunte a Claude en lenguaje natural sobre la Pokédex usando su propia clave de Anthropic, con la llamada a la API y las herramientas de consulta ejecutadas en su navegador, sin backend.

## ADDED Requirements

### Requirement: Página del chat
La web SHALL ofrecer `chat.html` con la cabecera común, un formulario de clave, un selector de modelo, una zona de mensajes y un formulario de pregunta. Junto al formulario de clave SHALL mostrarse el texto `Tu clave se queda en este navegador y solo se envía a api.anthropic.com. Las conversaciones se cobran en tu cuenta de Anthropic.`

#### Scenario: Primera visita
- **WHEN** se carga `chat.html` sin clave guardada
- **THEN** se ven el formulario de clave con su aviso de privacidad y coste, y no se hace ninguna petición a `api.anthropic.com`

### Requirement: Formulario de clave
El formulario SHALL pedir la clave en un `<input type="password" autocomplete="off">` con la casilla `Recordar en este navegador` desmarcada por defecto. Una clave vacía o que no empiece por `sk-ant-` MUST rechazarse localmente con el mensaje `La clave debe empezar por sk-ant-.` sin ninguna petición.

#### Scenario: Clave con formato incorrecto
- **WHEN** el usuario introduce `abc123` y guarda
- **THEN** se muestra `La clave debe empezar por sk-ant-.` y no se hace ninguna petición

#### Scenario: Clave vacía
- **WHEN** el usuario guarda el formulario con el campo vacío o solo con espacios
- **THEN** se muestra `La clave debe empezar por sk-ant-.` y no se guarda nada

#### Scenario: Clave válida
- **WHEN** el usuario introduce `sk-ant-xyz` y guarda
- **THEN** la clave queda guardada y el foco pasa al campo de mensaje

### Requirement: Almacenamiento de la clave
Sin `Recordar en este navegador`, la clave SHALL guardarse solo en `sessionStorage` con la clave `pokedex:chat:apikey`; marcada, solo en `localStorage` con la misma clave. Un almacenamiento no disponible o que lanza MUST NOT romper la página: la clave sigue en memoria de la pestaña.

#### Scenario: Recordar desmarcado
- **WHEN** el usuario guarda la clave con la casilla desmarcada y cierra la pestaña
- **THEN** la clave no está en `localStorage` y solo existía en `sessionStorage`

#### Scenario: Recordar marcado
- **WHEN** el usuario guarda la clave con la casilla marcada
- **THEN** la clave está en `localStorage` bajo `pokedex:chat:apikey` y no en `sessionStorage`

#### Scenario: Almacenamiento que lanza
- **WHEN** `sessionStorage` y `localStorage` lanzan al escribir
- **THEN** la clave se usa durante la pestaña y la página no muestra ningún error

### Requirement: Olvidar la clave
El botón `OLVIDAR CLAVE` SHALL borrar la clave de `sessionStorage` y de `localStorage`, abortar cualquier respuesta en curso, vaciar la conversación y volver a mostrar el formulario de clave.

#### Scenario: Olvidar con clave recordada
- **WHEN** hay una clave en `localStorage` y el usuario pulsa `OLVIDAR CLAVE`
- **THEN** `pokedex:chat:apikey` no existe en ningún almacenamiento, la zona de mensajes queda vacía y se ve el formulario de clave

### Requirement: Confinamiento de la clave
La clave MUST NOT escribirse en el DOM, en la consola ni en la URL, y MUST enviarse solo en la cabecera `x-api-key` de peticiones a `https://api.anthropic.com`.

#### Scenario: Clave fuera del DOM
- **WHEN** se ha guardado la clave y se ha completado una respuesta
- **THEN** el HTML de la página, la URL y los mensajes de consola no contienen la clave

#### Scenario: Peticiones a otros orígenes
- **WHEN** las herramientas consultan PokéAPI
- **THEN** ninguna petición a PokéAPI lleva la cabecera `x-api-key` ni la clave

### Requirement: Petición a la API de Claude
Cada turno SHALL hacer `POST https://api.anthropic.com/v1/messages` con `content-type: application/json`, `x-api-key`, `anthropic-version: 2026-10-21` y `anthropic-dangerous-direct-browser-access: true`, y un cuerpo con `model`, `max_tokens` 8000, `stream: true`, un `system` fijo en español, `tools`, `messages`, `output_config: { effort: "low" }` y `cache_control: { type: "ephemeral" }`.

#### Scenario: Cabeceras y cuerpo exactos
- **WHEN** se envía una pregunta con Opus 5.5
- **THEN** la petición lleva exactamente esas cabeceras más la beta de fallback y un cuerpo con esos campos

#### Scenario: Instrucciones de sistema
- **WHEN** se inspecciona el campo `system` de cualquier petición
- **THEN** es un texto en español que describe la Pokédex y pide usar las herramientas para cualquier dato y responder en español y en texto plano

### Requirement: Parámetros prohibidos
El cuerpo MUST NOT contener `temperature`, `top_p`, `top_k`, `thinking` ni `tool_choice` de tipo `any` o `tool`.

#### Scenario: Cuerpo sin parámetros prohibidos
- **WHEN** se inspecciona el cuerpo de cualquier petición con cualquiera de los tres modelos
- **THEN** no contiene ninguna de esas claves ni un `tool_choice` forzado

### Requirement: Selector de modelo
El selector SHALL ofrecer `claude-opus-5-5` (por defecto, `Claude Opus 5.5 — $4 / $20 por millón de tokens`), `claude-sonnet-5-5` (`Claude Sonnet 5.5 — $2 / $10`) y `claude-haiku-5-5` (`Claude Haiku 5.5 — $0,10 / $0,50`). Cambiar de modelo MUST empezar una conversación nueva.

#### Scenario: Modelo por defecto
- **WHEN** se carga `chat.html`
- **THEN** el modelo seleccionado es `claude-opus-5-5` y las tres opciones muestran sus precios

#### Scenario: Cambio de modelo
- **WHEN** hay una conversación con mensajes y el usuario elige `claude-haiku-5-5`
- **THEN** la zona de mensajes se vacía y la siguiente petición solo contiene la nueva pregunta

### Requirement: Fallback en servidor según modelo
Con `claude-opus-5-5` y `claude-sonnet-5-5` la petición SHALL incluir `fallbacks: "default"` y la cabecera `anthropic-beta: server-side-fallback-2026-07-01`; con `claude-haiku-5-5` MUST NOT incluir ninguno de los dos.

#### Scenario: Haiku sin fallback
- **WHEN** se envía una pregunta con `claude-haiku-5-5`
- **THEN** ni el cuerpo tiene `fallbacks` ni la petición lleva `anthropic-beta`

#### Scenario: Sonnet con fallback
- **WHEN** se envía una pregunta con `claude-sonnet-5-5`
- **THEN** el cuerpo tiene `fallbacks: "default"` y la cabecera `anthropic-beta` vale `server-side-fallback-2026-07-01`

### Requirement: Lectura del streaming
La respuesta SSE SHALL procesar `message_start`, `content_block_start`, `content_block_delta` (`text_delta`, `input_json_delta`, `thinking_delta`, `signature_delta`), `content_block_stop`, `message_delta`, `message_stop`, `ping` y `error`, reconstruir la lista completa de bloques del mensaje y tolerar eventos partidos entre fragmentos de red. El texto SHALL mostrarse a medida que llega.

#### Scenario: Evento partido entre fragmentos
- **WHEN** un evento `content_block_delta` llega dividido en tres fragmentos de red, uno de ellos a mitad de un carácter multibyte
- **THEN** el bloque reconstruido es idéntico al obtenido con el evento en un solo fragmento

#### Scenario: Ping intercalado
- **WHEN** el stream contiene eventos `ping` entre bloques
- **THEN** se ignoran y no alteran los bloques

#### Scenario: Texto incremental
- **WHEN** llegan dos `text_delta` `Gyara` y `dos` separados en el tiempo
- **THEN** la zona de mensajes muestra `Gyara` antes de mostrar `Gyarados`

### Requirement: Historial con bloques del asistente intactos
Cada turno del asistente SHALL reenviarse en las peticiones siguientes con todos sus bloques sin modificar, incluidos `thinking` con su `signature` aunque su texto esté vacío y los bloques `fallback`. La única excepción es la regla documentada de la API para un fallback a mitad de respuesta: se omiten los bloques `thinking`, `redacted_thinking` y `tool_use` anteriores al último bloque `fallback`.

#### Scenario: Thinking vacío con firma
- **WHEN** el asistente responde `thinking` con texto vacío y firma `EqQB...` seguido de un `tool_use`
- **THEN** la siguiente petición contiene ese turno con el bloque `thinking` idéntico, firma incluida, y el `tool_use` idéntico

#### Scenario: Fallback antes de cualquier salida
- **WHEN** el primer bloque del turno es `fallback`
- **THEN** el turno se reenvía completo y sin cambios

#### Scenario: Fallback a mitad de respuesta
- **WHEN** el turno contiene `thinking`, `text`, `fallback` y después `thinking` y `tool_use`
- **THEN** el turno reenviado omite el `thinking` anterior al `fallback` y conserva el resto en su orden

### Requirement: Herramientas del chat
El chat SHALL declarar las 12 tools del servidor MCP con los mismos nombres, parámetros, límites, descripciones y textos de error: `buscar_pokemon`, `obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento`, `buscar_habilidades`, `obtener_habilidad`, `buscar_objetos`, `obtener_objeto`, `buscar_bayas`, `obtener_baya`, `efectividad_tipos` y `naturalezas`, cada una con `strict: true`, `additionalProperties: false` y `eager_input_streaming: true`.

#### Scenario: Catálogo declarado
- **WHEN** se inspecciona `tools` de una petición
- **THEN** hay 12 definiciones con esos nombres, cada una con `strict: true`, `eager_input_streaming: true` y un `input_schema` con `additionalProperties: false`

#### Scenario: Mismo resultado que el MCP
- **WHEN** se ejecuta `obtener_pokemon` con `{ "nombre_o_id": "gyarados" }` en el chat y en el servidor MCP con la misma PokéAPI simulada
- **THEN** el texto del `tool_result` del chat es idéntico al texto del resultado del MCP

### Requirement: Validación de entradas en el cliente
Cada entrada de tool SHALL parsearse como JSON y validarse en el navegador contra su esquema y sus límites antes de ejecutarse, aplicando las mismas normalizaciones y valores por defecto que el MCP. Una entrada inválida, una tool desconocida o un JSON que no parsea MUST NOT ejecutarse y SHALL responderse con un `tool_result` con `is_error: true` y el mensaje del campo.

#### Scenario: Tamaño de página fuera de rango
- **WHEN** Claude llama a `buscar_pokemon` con `{ "consulta": "char", "tamano_pagina": 51 }`
- **THEN** no se hace ninguna petición a PokéAPI y el `tool_result` tiene `is_error: true` y el texto `tamano_pagina debe estar entre 1 y 50.`

#### Scenario: Valores por defecto y normalización
- **WHEN** Claude llama a `efectividad_tipos` con `{ "atacante": " Electric " }`
- **THEN** se ejecuta con `atacante` `electric` y sin defensor

#### Scenario: JSON truncado
- **WHEN** la entrada acumulada de un `tool_use` no es JSON válido
- **THEN** la tool no se ejecuta y su `tool_result` tiene `is_error: true`

### Requirement: Bucle de herramientas
Si `stop_reason` es `tool_use`, el chat SHALL ejecutar en paralelo todas las tools del turno y devolver todos los `tool_result` en un único mensaje `user`, en el orden de los `tool_use`. Un fallo de tool SHALL producir su `tool_result` con `is_error: true` y el texto de error; nunca se descarta. Cada tool en curso SHALL indicarse con la línea `CONSULTANDO: <nombre_tool>`.

#### Scenario: Bucle con herramienta
- **WHEN** la API simulada responde primero `tool_use` de `efectividad_tipos` con `{ "atacante": "electric", "defensor": ["water","flying"] }` y después un texto final
- **THEN** la tool se ejecuta contra PokéAPI simulada, la segunda petición contiene el turno del asistente sin modificar y un `tool_result` con `"multiplicador": 4`, y se muestra el texto final

#### Scenario: Dos tools en paralelo y una falla
- **WHEN** el turno pide `obtener_pokemon` para `gyarados` y para `xyz`
- **THEN** la siguiente petición lleva un único mensaje `user` con dos `tool_result`: el de `toolu_1` con `Pokémon gyarados (#130).` y el de `toolu_2` con `is_error: true` y `No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.`

#### Scenario: Indicador de consulta
- **WHEN** se está ejecutando `efectividad_tipos`
- **THEN** la página muestra `CONSULTANDO: efectividad_tipos`

### Requirement: Límite de iteraciones
Cada pregunta del usuario SHALL admitir como máximo 8 iteraciones de herramientas; al superarlo MUST detenerse sin más peticiones y mostrar `He alcanzado el límite de consultas para esta pregunta.`

#### Scenario: Límite de iteraciones
- **WHEN** la API simulada responde siempre `tool_use`
- **THEN** se hacen exactamente 9 peticiones (1 + 8) y se muestra `He alcanzado el límite de consultas para esta pregunta.`

### Requirement: Motivos de parada
Antes de ejecutar herramientas SHALL comprobarse `stop_reason`: con `max_tokens` se muestra lo recibido más `(respuesta cortada por longitud)` y no se ejecuta ninguna tool; con `refusal` se muestra `Claude no puede responder a esta petición.` y no se ejecuta ninguna tool.

#### Scenario: Respuesta cortada
- **WHEN** la respuesta termina con `stop_reason` `max_tokens` y contiene un `tool_use` incompleto
- **THEN** no se ejecuta la tool y se muestra el texto recibido seguido de `(respuesta cortada por longitud)`

#### Scenario: Rechazo
- **WHEN** la respuesta termina con `stop_reason` `refusal`
- **THEN** se muestra `Claude no puede responder a esta petición.` y no se ejecuta ninguna tool

### Requirement: Conversación coherente tras cortes
Los turnos de una pregunta SHALL incorporarse a la conversación solo si termina con una respuesta final de texto (`end_turn` o `max_tokens` sin `tool_use`). Si termina por error, rechazo, límite de iteraciones o `DETENER`, la siguiente pregunta MUST enviarse sin esos turnos, aunque su texto siga visible.

#### Scenario: Pregunta tras un límite
- **WHEN** una pregunta acaba en el límite de iteraciones y el usuario envía otra
- **THEN** la nueva petición contiene la conversación anterior a la pregunta fallida y la nueva pregunta, sin ningún `tool_use` sin su `tool_result`

### Requirement: Reintentos ante fallos transitorios
Antes de recibir el primer evento, las respuestas 429, 529 y 5xx SHALL reintentarse hasta 2 veces, esperando `retry-after` si la cabecera es legible y, si no, 1 s y después 2 s. Las demás respuestas y los errores llegados por el stream MUST NOT reintentarse.

#### Scenario: Saturación con reintento
- **WHEN** la API responde 529 y después un stream correcto
- **THEN** se reintenta una vez y se muestra la respuesta sin error

#### Scenario: 429 con retry-after
- **WHEN** la API responde 429 con `retry-after: 3` y después un stream correcto
- **THEN** el reintento se hace tras 3 s

#### Scenario: Clave inválida
- **WHEN** con la clave `sk-ant-falsa` guardada el usuario envía `hola` y la API responde 401
- **THEN** no se reintenta y se muestra `Clave no válida. Revísala en console.anthropic.com.`

#### Scenario: Reintentos agotados
- **WHEN** la API responde 500 tres veces seguidas
- **THEN** se hacen 3 peticiones y se muestra `Error de Claude (500). Inténtalo de nuevo.`

### Requirement: Mensajes de error en español
Los errores finales SHALL mostrarse así: 401 `Clave no válida. Revísala en console.anthropic.com.`; 403 `Tu clave no tiene permiso para este modelo.`; 400 `Petición no válida: <mensaje de la API>`; 413 `La conversación es demasiado larga. Empieza una nueva.`; 429 `Límite de uso alcanzado. Espera un momento.`; 529 `Claude está saturado. Inténtalo en unos minutos.`; error de red `Sin conexión con Claude.`; otro estado `Error de Claude (<estado>). Inténtalo de nuevo.`

#### Scenario: Petición inválida
- **WHEN** la API responde 400 con `{"type":"error","error":{"type":"invalid_request_error","message":"max_tokens: too large"}}`
- **THEN** se muestra `Petición no válida: max_tokens: too large`

#### Scenario: Sin red
- **WHEN** `fetch` rechaza con un error de red
- **THEN** se muestra `Sin conexión con Claude.`

### Requirement: Errores dentro del stream
Un evento SSE `error` SHALL mapearse por `error.type` al mismo mensaje que su estado HTTP equivalente (`authentication_error` 401, `permission_error` 403, `invalid_request_error` 400, `request_too_large` 413, `rate_limit_error` 429, `overloaded_error` 529, cualquier otro como error de servidor), conservando el texto ya recibido.

#### Scenario: Saturación a mitad de respuesta
- **WHEN** tras un `text_delta` `Hola` llega `event: error` con `overloaded_error`
- **THEN** se conserva `Hola`, no se reintenta y se muestra `Claude está saturado. Inténtalo en unos minutos.`

### Requirement: Controles de la conversación
El chat SHALL ofrecer `ENVIAR` (también con Enter; Mayús+Enter inserta un salto de línea), `DETENER`, que aborta la petición y las tools en curso, y `NUEVA CONVERSACIÓN`. Mientras hay una respuesta en curso MUST NOT poder enviarse otra pregunta, cambiar de modelo ni empezar otra conversación.

#### Scenario: Detener
- **WHEN** hay una respuesta en streaming en curso y el usuario pulsa `DETENER`
- **THEN** la petición se aborta, se conserva el texto recibido y se puede enviar otra pregunta

#### Scenario: Envío con teclado
- **WHEN** el usuario escribe en el campo de mensaje, pulsa Mayús+Enter y después Enter
- **THEN** el mensaje enviado contiene un salto de línea y se envía una sola vez

#### Scenario: Envío bloqueado
- **WHEN** hay una respuesta en curso y el usuario pulsa Enter con texto nuevo
- **THEN** no se hace ninguna petición adicional

#### Scenario: Nueva conversación
- **WHEN** el usuario pulsa `NUEVA CONVERSACIÓN` tras varias preguntas
- **THEN** la zona de mensajes se vacía y la siguiente petición solo contiene la nueva pregunta

### Requirement: Conversación solo en memoria
La conversación MUST vivir solo en memoria de la pestaña: no se guarda en ningún almacenamiento ni se recupera al recargar.

#### Scenario: Recarga
- **WHEN** el usuario recarga `chat.html` tras una conversación
- **THEN** la zona de mensajes está vacía y ningún almacenamiento contiene mensajes

### Requirement: Renderizado seguro de mensajes
Todo texto del usuario, del modelo y de las tools SHALL insertarse escapado, sin interpretar Markdown ni HTML; los saltos de línea se respetan por CSS (`white-space: pre-wrap`).

#### Scenario: HTML del modelo
- **WHEN** el modelo responde `<img src=x onerror=alert(1)> **negrita**`
- **THEN** la página muestra ese texto literal, no crea ningún elemento `img` y no aparece negrita

### Requirement: Uso de tokens por pregunta
Tras cada respuesta final SHALL mostrarse en pequeño `Tokens: <entrada> entrada · <salida> salida`, sumando todas las peticiones de esa pregunta; la entrada incluye `input_tokens`, `cache_read_input_tokens` y `cache_creation_input_tokens`.

#### Scenario: Pregunta con una herramienta
- **WHEN** una pregunta hace dos peticiones con usos `{input 100, cache_creation 50, output 20}` y `{input 10, cache_read 150, output 30}`
- **THEN** se muestra `Tokens: 310 entrada · 50 salida`

### Requirement: Verificación real sin clave válida
Antes de publicar, el chat SHALL comprobarse en Chromium contra la API real sin ninguna clave válida: el preflight CORS de `api.anthropic.com` se completa y una petición con una clave inválida muestra `Clave no válida. Revísala en console.anthropic.com.` sin coste y sin violaciones de CSP en la consola.

#### Scenario: Clave inválida contra la API real
- **WHEN** desde `chat.html` servido en local se guarda `sk-ant-falsa` y se envía `hola` a la API real
- **THEN** el preflight responde 200, la API responde 401, la página muestra `Clave no válida. Revísala en console.anthropic.com.` y la consola no registra violaciones de CSP
