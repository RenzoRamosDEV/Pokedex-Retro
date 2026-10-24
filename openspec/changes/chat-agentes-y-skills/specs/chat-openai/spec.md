## MODIFIED Requirements

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

### Requirement: Herramientas en formato function
Las tools SHALL declararse como `{ type: "function", name, description, parameters, strict: true }` derivadas de las mismas definiciones que usa Claude (mismos nombres, descripciones y descripciones de campo): las 12 de consulta y, en el agente principal, `delegar_subagente` y `usar_skill`. Cada `parameters` MUST tener `additionalProperties: false` y todas sus propiedades en `required`; las opcionales admiten `null`.

#### Scenario: Catálogo declarado
- **WHEN** se inspecciona `tools` de una petición del agente principal a OpenAI
- **THEN** hay 14 definiciones `function` con `strict: true`, en el mismo orden y con los mismos nombres y descripciones que las de Claude

#### Scenario: Campo opcional
- **WHEN** se inspecciona `buscar_pokemon`
- **THEN** `required` es `["consulta", "pagina", "tamano_pagina"]` y `pagina` y `tamano_pagina` tienen tipo `["integer", "null"]`

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

### Requirement: Etiqueta y uso de tokens con OpenAI
Las respuestas de OpenAI SHALL etiquetarse `OPENAI`. Tras cada respuesta final SHALL mostrarse `Tokens: <entrada> entrada · <salida> salida` sumando las peticiones de la pregunta, incluidas las de sus subagentes, con entrada `usage.input_tokens` (ya incluye los de caché) y salida `usage.output_tokens` (ya incluye los de razonamiento).

#### Scenario: Pregunta con una herramienta
- **WHEN** una pregunta hace dos peticiones con usos `{input_tokens 100, cached_tokens 40, output_tokens 20}` y `{input_tokens 200, cached_tokens 150, output_tokens 30}`
- **THEN** se muestra `Tokens: 300 entrada · 50 salida`

#### Scenario: Pregunta con un subagente
- **WHEN** una pregunta hace dos peticiones del agente principal con usos `{input_tokens 100, output_tokens 20}` y `{input_tokens 200, output_tokens 30}` y una del subagente con uso `{input_tokens 70, output_tokens 9}`
- **THEN** se muestra `Tokens: 370 entrada · 59 salida`
