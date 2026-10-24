# chat-openai Specification

## Purpose
Permite que el visitante use el chat de la Pokédex con su propia clave de OpenAI: la llamada a la Responses API y las 12 herramientas de consulta se ejecutan en su navegador, sin backend y con el mismo comportamiento visible que el chat con Claude.

## Requirements

### Requirement: Modelos de OpenAI
Con el proveedor `OpenAI` el selector de modelo SHALL ofrecer `gpt-6.1-sol` (por defecto, `GPT-6.1 Sol (equilibrado) — $2 / $10 por millón de tokens`), `gpt-6-astra` (`GPT-6 Astra (más capaz, más caro) — $10 / $50`) y `gpt-6-luna` (`GPT-6 Luna (más barato) — $0,10 / $0,50`). Cambiar de modelo MUST empezar una conversación nueva.

#### Scenario: Modelo por defecto de OpenAI
- **WHEN** el usuario elige el proveedor `OpenAI`
- **THEN** el modelo seleccionado es `gpt-6.1-sol`, se ven solo las tres opciones de OpenAI con sus precios y ninguna de Claude

#### Scenario: Cambio de modelo de OpenAI
- **WHEN** hay una conversación con OpenAI y el usuario elige `gpt-6-luna`
- **THEN** la zona de mensajes se vacía y la siguiente petición solo contiene la nueva pregunta

### Requirement: Petición a la Responses API
Cada turno con OpenAI SHALL hacer `POST https://api.openai.com/v1/responses` con solo las cabeceras `content-type: application/json` y `authorization: Bearer <clave>`, y un cuerpo con `model`, `instructions` (el mismo texto de sistema en español que con Claude para el agente que hace la petición), `input`, `tools`, `max_output_tokens` 8000, `reasoning: { effort: "low" }`, `store: false` y `stream: true`.

#### Scenario: Cabeceras y cuerpo exactos
- **WHEN** se envía una pregunta con `gpt-6.1-sol`
- **THEN** la petición lleva exactamente esas cabeceras y un cuerpo con exactamente esos campos

#### Scenario: Sin cabeceras de Anthropic
- **WHEN** se inspecciona cualquier petición a `api.openai.com`
- **THEN** no lleva `x-api-key`, `anthropic-version`, `anthropic-beta` ni `anthropic-dangerous-direct-browser-access`

#### Scenario: Instrucciones del agente principal
- **WHEN** se inspecciona `instructions` de una petición del agente principal
- **THEN** es idéntico al `system` del agente principal con Claude, incluida la respuesta fija `Solo puedo responder preguntas sobre Pokémon.`

### Requirement: Parámetros prohibidos con OpenAI
El cuerpo MUST NOT contener `temperature`, `top_p`, `previous_response_id`, `conversation`, `background` ni un `tool_choice` que fuerce herramientas, y `store` MUST valer siempre `false`.

#### Scenario: Cuerpo sin parámetros prohibidos
- **WHEN** se inspecciona el cuerpo de cualquier petición con cualquiera de los tres modelos de OpenAI
- **THEN** no contiene ninguna de esas claves y `store` es `false`

### Requirement: Herramientas en formato function
Las tools SHALL declararse como `{ type: "function", name, description, parameters, strict: true }` derivadas de las mismas definiciones que usa Claude (mismos nombres, descripciones y descripciones de campo): las 12 de consulta y, en el agente principal, `delegar_subagente` y `usar_skill`. Cada `parameters` MUST tener `additionalProperties: false` y todas sus propiedades en `required`; las opcionales admiten `null`.

#### Scenario: Catálogo declarado
- **WHEN** se inspecciona `tools` de una petición del agente principal a OpenAI
- **THEN** hay 14 definiciones `function` con `strict: true`, en el mismo orden y con los mismos nombres y descripciones que las de Claude

#### Scenario: Campo opcional
- **WHEN** se inspecciona `buscar_pokemon`
- **THEN** `required` es `["consulta", "pagina", "tamano_pagina"]` y `pagina` y `tamano_pagina` tienen tipo `["integer", "null"]`

### Requirement: Validación y ejecución de llamadas
Cada `function_call` SHALL parsear sus `arguments`, tratar como ausente toda propiedad con valor `null` y validarse y ejecutarse en el navegador igual que con Claude (mismas normalizaciones, valores por defecto, límites y textos). Una entrada inválida, una tool desconocida o unos `arguments` que no parsean MUST NOT ejecutarse y su `function_call_output` lleva el texto del error.

#### Scenario: Nulos como valores por defecto
- **WHEN** OpenAI llama a `buscar_pokemon` con `{"consulta":"char","pagina":null,"tamano_pagina":null}`
- **THEN** se ejecuta con `pagina` 1 y `tamano_pagina` 10

#### Scenario: Tamaño de página fuera de rango
- **WHEN** OpenAI llama a `buscar_pokemon` con `{"consulta":"char","pagina":null,"tamano_pagina":51}`
- **THEN** no se hace ninguna petición a PokéAPI y el `function_call_output` contiene `tamano_pagina debe estar entre 1 y 50.`

#### Scenario: Argumentos que no parsean
- **WHEN** los `arguments` de un `function_call` no son JSON válido
- **THEN** la tool no se ejecuta y su `function_call_output` contiene `La entrada de la herramienta no es JSON válido.`

### Requirement: Lectura del streaming de OpenAI
La respuesta SSE SHALL mostrar el texto de `response.output_text.delta` a medida que llega, tomar cada elemento de salida completo de `response.output_item.done` en el orden de `output_index`, terminar con `response.completed`, `response.incomplete` o `response.failed`, ignorar los demás eventos y tolerar eventos partidos entre fragmentos de red.

#### Scenario: Evento partido entre fragmentos
- **WHEN** un evento `response.output_text.delta` llega dividido en tres fragmentos, uno a mitad de un carácter multibyte
- **THEN** el texto mostrado y los elementos reconstruidos son idénticos a los obtenidos con el evento en un solo fragmento

#### Scenario: Texto incremental
- **WHEN** llegan dos `response.output_text.delta` `Gyara` y `dos` separados en el tiempo
- **THEN** la zona de mensajes muestra `Gyara` antes de mostrar `Gyarados`

#### Scenario: Stream sin evento final
- **WHEN** el stream se cierra sin `response.completed`, `response.incomplete` ni `response.failed`
- **THEN** se muestra `Sin conexión con OpenAI.` y la pregunta no se incorpora a la conversación

### Requirement: Historial con elementos de salida intactos
Cada turno de OpenAI SHALL reenviarse en el `input` de las peticiones siguientes con todos sus elementos de salida en su orden y sin modificar (incluidos los `reasoning` con su `encrypted_content`), salvo el campo de solo salida `created_by`, seguido de un `function_call_output` por cada `function_call`, con su `call_id` y en el mismo orden.

#### Scenario: Razonamiento y llamada reenviados
- **WHEN** OpenAI responde un `reasoning` con `encrypted_content` `gAAAA…` y un `function_call` de `efectividad_tipos`
- **THEN** la siguiente petición contiene ambos elementos idénticos y después un `function_call_output` con el mismo `call_id`

#### Scenario: Pregunta siguiente
- **WHEN** tras una respuesta final el usuario envía otra pregunta
- **THEN** el `input` contiene la pregunta anterior, todos los elementos de salida y de resultado de esa pregunta y la nueva pregunta, en ese orden

### Requirement: Bucle de herramientas con OpenAI
Si una respuesta completada contiene `function_call`, el chat SHALL ejecutarlas en paralelo, indicar cada consulta con `CONSULTANDO: <nombre_tool>` (y `delegar_subagente` y `usar_skill` con `SUBAGENTE: <nombre>` y `SKILL: <nombre>`) y enviar todos los `function_call_output` en la siguiente petición. Cada pregunta admite como máximo 8 iteraciones; al superarlo MUST detenerse y mostrar `He alcanzado el límite de consultas para esta pregunta.`

#### Scenario: Bucle con herramienta
- **WHEN** OpenAI simulada responde un `function_call` de `efectividad_tipos` con `{"atacante":"electric","defensor":["water","flying"]}` y después un texto final
- **THEN** la segunda petición contiene un `function_call_output` con `"multiplicador": 4` y se muestra el texto final

#### Scenario: Dos llamadas y una falla
- **WHEN** la respuesta pide `obtener_pokemon` para `gyarados` y para `xyz`
- **THEN** la siguiente petición lleva dos `function_call_output` en ese orden: el primero con `Pokémon gyarados (#130).` y el segundo con `No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.`

#### Scenario: Límite de iteraciones
- **WHEN** OpenAI simulada responde siempre con un `function_call`
- **THEN** se hacen exactamente 9 peticiones y se muestra `He alcanzado el límite de consultas para esta pregunta.`

#### Scenario: Delegación con OpenAI
- **WHEN** OpenAI simulada responde un `function_call` de `delegar_subagente` con `{"subagente":"estratega-tipos","tarea":"debilidades de gyarados"}`, el subagente responde un texto y después el agente principal responde un texto final
- **THEN** la petición del subagente va a `api.openai.com` con el mismo modelo y su `input` empieza por la tarea, y la siguiente petición del agente principal contiene un `function_call_output` con el texto del subagente

### Requirement: Motivos de parada de OpenAI
Con `response.incomplete` por `max_output_tokens` SHALL mostrarse lo recibido más `(respuesta cortada por longitud)` sin ejecutar tools; con un contenido `refusal` o `response.incomplete` por `content_filter` SHALL mostrarse `OpenAI no puede responder a esta petición.` sin ejecutar tools. Los turnos de la pregunta MUST incorporarse a la conversación con las mismas reglas que con Claude.

#### Scenario: Respuesta cortada con llamada
- **WHEN** la respuesta termina en `response.incomplete` con `max_output_tokens` y contiene un `function_call`
- **THEN** no se ejecuta la tool, se muestra `(respuesta cortada por longitud)` y la siguiente pregunta se envía sin ese turno

#### Scenario: Rechazo
- **WHEN** el mensaje de salida contiene una parte `refusal`
- **THEN** se muestra `OpenAI no puede responder a esta petición.` y no se ejecuta ninguna tool

### Requirement: Reintentos con OpenAI
Antes del primer evento, un 429 que no sea de saldo y los 5xx SHALL reintentarse hasta 2 veces, esperando `retry-after` si es legible y, si no, 1 s y después 2 s. Un 429 de saldo (tipo o código `insufficient_quota`, o códigos `credit_balance_exhausted`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded`, `organization_usage_limit_exceeded`) MUST NOT reintentarse.

#### Scenario: Ritmo con reintento
- **WHEN** la API responde 429 con código `rate_limit_exceeded` y después un stream correcto
- **THEN** se reintenta una vez y se muestra la respuesta sin error

#### Scenario: Sin saldo
- **WHEN** la API responde 429 con `{"error":{"type":"insufficient_quota","code":"insufficient_quota","message":"…"}}`
- **THEN** se hace una sola petición y se muestra `Tu cuenta de OpenAI no tiene saldo.`

#### Scenario: Saturación agotada
- **WHEN** la API responde 503 tres veces seguidas
- **THEN** se hacen 3 peticiones y se muestra `OpenAI está saturado. Inténtalo en unos minutos.`

### Requirement: Mensajes de error de OpenAI
Los errores finales con OpenAI SHALL mostrarse así: 401 `Clave de OpenAI no válida. Revísala en platform.openai.com.`; 403 `Tu clave no tiene permiso para este modelo.`; 400 `Petición no válida: <mensaje de la API>`; 429 de saldo `Tu cuenta de OpenAI no tiene saldo.`; otro 429 `Límite de uso alcanzado. Espera un momento.`; 503 `OpenAI está saturado. Inténtalo en unos minutos.`; red `Sin conexión con OpenAI.`; otro `Error de OpenAI (<estado>). Inténtalo de nuevo.`

#### Scenario: Clave inválida
- **WHEN** con la clave `sk-falsa` guardada el usuario envía `hola` y la API responde 401 con código `invalid_api_key`
- **THEN** no se reintenta y se muestra `Clave de OpenAI no válida. Revísala en platform.openai.com.`

#### Scenario: Reintentos agotados
- **WHEN** la API responde 500 tres veces seguidas
- **THEN** se hacen 3 peticiones y se muestra `Error de OpenAI (500). Inténtalo de nuevo.`

### Requirement: Diagnóstico de errores de OpenAI sin respuesta legible
Cuando el `POST` a `/v1/responses` falla sin respuesta legible (sus errores no llevan `Access-Control-Allow-Origin`) y no por un aborto, el chat SHALL hacer un único diagnóstico `GET https://api.openai.com/v1/models` con la misma `authorization: Bearer <clave>`, sin cuerpo ni reintentos, y elegir el mensaje según su resultado. La pregunta MUST NOT reintentarse.

#### Scenario: Clave inválida sin respuesta legible
- **WHEN** el `POST` a `/v1/responses` falla sin respuesta legible y el diagnóstico `GET /v1/models` responde 401
- **THEN** se hacen exactamente un `POST` y un `GET` y se muestra `Clave de OpenAI no válida. Revísala en platform.openai.com.`

#### Scenario: Clave válida sin respuesta legible
- **WHEN** el `POST` a `/v1/responses` falla sin respuesta legible y el diagnóstico responde 200
- **THEN** no se reintenta y se muestra `OpenAI rechazó la petición. Revisa el saldo y los límites de tu cuenta en platform.openai.com.`

#### Scenario: Diagnóstico sin conexión
- **WHEN** el `POST` y el diagnóstico fallan sin respuesta, o el diagnóstico responde otro estado
- **THEN** se muestra `Sin conexión con OpenAI.`

#### Scenario: Detener no diagnostica
- **WHEN** el usuario pulsa `DETENER` con una petición a OpenAI en curso
- **THEN** no se hace ninguna petición a `/v1/models`

### Requirement: Errores dentro del stream de OpenAI
Un evento `error` o `response.failed` SHALL mapearse por su código (`invalid_api_key` como 401, códigos de saldo como sin saldo, `rate_limit_exceeded` y `slow_down` como 429, `server_is_overloaded` como 503, cualquier otro como error de servidor 500), sin reintento y conservando el texto ya recibido.

#### Scenario: Fallo a mitad de respuesta
- **WHEN** tras un `response.output_text.delta` `Hola` llega `response.failed` con código `server_error`
- **THEN** se conserva `Hola`, no se reintenta y se muestra `Error de OpenAI (500). Inténtalo de nuevo.`

### Requirement: Etiqueta y uso de tokens con OpenAI
Las respuestas de OpenAI SHALL etiquetarse `OPENAI`. Tras cada respuesta final SHALL mostrarse `Tokens: <entrada> entrada · <salida> salida` sumando las peticiones de la pregunta, incluidas las de sus subagentes, con entrada `usage.input_tokens` (ya incluye los de caché) y salida `usage.output_tokens` (ya incluye los de razonamiento).

#### Scenario: Pregunta con una herramienta
- **WHEN** una pregunta hace dos peticiones con usos `{input_tokens 100, cached_tokens 40, output_tokens 20}` y `{input_tokens 200, cached_tokens 150, output_tokens 30}`
- **THEN** se muestra `Tokens: 300 entrada · 50 salida`

#### Scenario: Pregunta con un subagente
- **WHEN** una pregunta hace dos peticiones del agente principal con usos `{input_tokens 100, output_tokens 20}` y `{input_tokens 200, output_tokens 30}` y una del subagente con uso `{input_tokens 70, output_tokens 9}`
- **THEN** se muestra `Tokens: 370 entrada · 59 salida`

### Requirement: Verificación real de OpenAI sin clave válida
Antes de publicar, el chat SHALL comprobarse en Chromium contra la API real de OpenAI sin ninguna clave válida: el preflight CORS de `api.openai.com` se completa y una petición con una clave falsa muestra, gracias al diagnóstico con `/v1/models`, el mensaje de clave inválida sin coste ni violaciones de CSP.

#### Scenario: Clave falsa contra la API real
- **WHEN** desde `chat.html` servido en local se elige `OpenAI`, se guarda `sk-falsa-prueba` y se envía `hola`
- **THEN** se hacen un `POST` a `https://api.openai.com/v1/responses` y un `GET` a `https://api.openai.com/v1/models`, ambos con 401, la página muestra `Clave de OpenAI no válida. Revísala en platform.openai.com.`, la consola no registra violaciones de CSP y la clave no aparece en la URL, el HTML ni la consola
