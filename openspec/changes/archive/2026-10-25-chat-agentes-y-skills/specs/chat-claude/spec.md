## MODIFIED Requirements

### Requirement: Página del chat
La web SHALL ofrecer `chat.html` con la cabecera común, el selector de proveedor, un formulario de clave, un selector de modelo, una zona de mensajes y un formulario de pregunta. Junto al formulario de clave SHALL mostrarse el texto `Tu clave de Anthropic u OpenAI se queda en este navegador y solo se envía a la API de su proveedor (api.anthropic.com o api.openai.com). Las conversaciones se cobran en tu cuenta de ese proveedor. Delegar en subagentes consume tokens adicionales.`

#### Scenario: Primera visita
- **WHEN** se carga `chat.html` sin ninguna clave guardada
- **THEN** se ven el selector de proveedor y el formulario de clave con su aviso de privacidad y coste, incluida la frase `Delegar en subagentes consume tokens adicionales.`, y no se hace ninguna petición a `api.anthropic.com` ni a `api.openai.com`

### Requirement: Petición a la API de Claude
Cada turno SHALL hacer `POST https://api.anthropic.com/v1/messages` con `content-type: application/json`, `x-api-key`, `anthropic-version: 2026-10-21` y `anthropic-dangerous-direct-browser-access: true`, y un cuerpo con `model`, `max_tokens` 8000, `stream: true`, un `system` fijo en español (el del agente que hace la petición), `tools`, `messages`, `output_config: { effort: "low" }` y `cache_control: { type: "ephemeral" }`.

#### Scenario: Cabeceras y cuerpo exactos
- **WHEN** se envía una pregunta con Opus 5.5
- **THEN** la petición lleva exactamente esas cabeceras más la beta de fallback y un cuerpo con esos campos

#### Scenario: Instrucciones de sistema
- **WHEN** se inspecciona el campo `system` de cualquier petición del agente principal
- **THEN** es un texto en español que describe la Pokédex, limita las respuestas a temas de Pokémon con la respuesta fija `Solo puedo responder preguntas sobre Pokémon.`, pide usar las herramientas para cualquier dato y responder en español y en texto plano, y lista los subagentes y las skills disponibles

### Requirement: Herramientas del chat
El chat SHALL declarar las 12 tools del MCP con iguales nombres, parámetros, límites, descripciones y errores: `buscar_pokemon`, `obtener_pokemon`, `buscar_movimientos`, `obtener_movimiento`, `buscar_habilidades`, `obtener_habilidad`, `buscar_objetos`, `obtener_objeto`, `buscar_bayas`, `obtener_baya`, `efectividad_tipos` y `naturalezas`, y luego, en el agente principal, `delegar_subagente` y `usar_skill`, cada una con `strict: true`, `additionalProperties: false` y `eager_input_streaming: true`.

#### Scenario: Catálogo declarado
- **WHEN** se inspecciona `tools` de una petición del agente principal
- **THEN** hay 14 definiciones: las 12 con esos nombres en ese orden y después `delegar_subagente` y `usar_skill`, cada una con `strict: true`, `eager_input_streaming: true` y un `input_schema` con `additionalProperties: false`

#### Scenario: Mismo resultado que el MCP
- **WHEN** se ejecuta `obtener_pokemon` con `{ "nombre_o_id": "gyarados" }` en el chat y en el servidor MCP con la misma PokéAPI simulada
- **THEN** el texto del `tool_result` del chat es idéntico al texto del resultado del MCP

### Requirement: Bucle de herramientas
Si `stop_reason` es `tool_use`, el chat SHALL ejecutar en paralelo todas las tools del turno y devolver todos los `tool_result` en un único mensaje `user`, en el orden de los `tool_use`. Un fallo de tool SHALL producir su `tool_result` con `is_error: true` y el texto de error; nunca se descarta. Cada tool de consulta en curso SHALL indicarse con la línea `CONSULTANDO: <nombre_tool>`; `delegar_subagente` y `usar_skill` se indican con `SUBAGENTE: <nombre>` y `SKILL: <nombre>`.

#### Scenario: Bucle con herramienta
- **WHEN** la API simulada responde primero `tool_use` de `efectividad_tipos` con `{ "atacante": "electric", "defensor": ["water","flying"] }` y después un texto final
- **THEN** la tool se ejecuta contra PokéAPI simulada, la segunda petición contiene el turno del asistente sin modificar y un `tool_result` con `"multiplicador": 4`, y se muestra el texto final

#### Scenario: Dos tools en paralelo y una falla
- **WHEN** el turno pide `obtener_pokemon` para `gyarados` y para `xyz`
- **THEN** la siguiente petición lleva un único mensaje `user` con dos `tool_result`: el de `toolu_1` con `Pokémon gyarados (#130).` y el de `toolu_2` con `is_error: true` y `No existe el Pokémon "xyz". Usa buscar_pokemon para encontrar el nombre exacto.`

#### Scenario: Indicador de consulta
- **WHEN** se está ejecutando `efectividad_tipos`
- **THEN** la página muestra `CONSULTANDO: efectividad_tipos`

#### Scenario: Indicador de skill
- **WHEN** se está ejecutando `usar_skill` con `comparar-pokemon`
- **THEN** la página muestra `SKILL: comparar-pokemon` y no `CONSULTANDO: usar_skill`

### Requirement: Uso de tokens por pregunta
Tras cada respuesta final SHALL mostrarse en pequeño `Tokens: <entrada> entrada · <salida> salida`, sumando todas las peticiones de esa pregunta, incluidas las de sus subagentes; la entrada incluye `input_tokens`, `cache_read_input_tokens` y `cache_creation_input_tokens`.

#### Scenario: Pregunta con una herramienta
- **WHEN** una pregunta hace dos peticiones con usos `{input 100, cache_creation 50, output 20}` y `{input 10, cache_read 150, output 30}`
- **THEN** se muestra `Tokens: 310 entrada · 50 salida`

#### Scenario: Pregunta con un subagente
- **WHEN** una pregunta hace dos peticiones del agente principal con usos `{input 100, output 20}` y `{input 10, cache_read 150, output 30}` y una del subagente con uso `{input 40, cache_creation 10, output 5}`
- **THEN** se muestra `Tokens: 310 entrada · 55 salida`
