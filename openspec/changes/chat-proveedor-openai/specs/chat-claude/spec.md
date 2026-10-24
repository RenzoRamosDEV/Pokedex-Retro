## ADDED Requirements

### Requirement: Selector de proveedor
`chat.html` SHALL ofrecer, visible con y sin clave, el selector `PROVEEDOR` con `Claude (Anthropic)` (por defecto) y `OpenAI`. Cambiar de proveedor MUST vaciar la conversación, mostrar solo los modelos de ese proveedor y usar su clave guardada o, si no hay, mostrar el formulario de clave. Con una respuesta en curso MUST NOT poder cambiarse.

#### Scenario: Proveedor por defecto
- **WHEN** se carga `chat.html`
- **THEN** el proveedor seleccionado es `Claude (Anthropic)` y el selector de modelo solo muestra los tres modelos de Claude

#### Scenario: Cambio a OpenAI sin clave de OpenAI
- **WHEN** hay una conversación con Claude y una clave de Anthropic guardada, y el usuario elige `OpenAI`
- **THEN** la zona de mensajes se vacía y se ve el formulario de clave con la etiqueta `CLAVE DE OPENAI`

#### Scenario: Vuelta a Claude
- **WHEN** hay claves guardadas de ambos proveedores y el usuario pasa de `OpenAI` a `Claude (Anthropic)`
- **THEN** no se pide clave, la conversación está vacía y la siguiente petición va a `api.anthropic.com` con la clave de Anthropic

#### Scenario: Proveedor bloqueado durante una respuesta
- **WHEN** hay una respuesta en curso
- **THEN** el selector `PROVEEDOR` está deshabilitado

## MODIFIED Requirements

### Requirement: Página del chat
La web SHALL ofrecer `chat.html` con la cabecera común, el selector de proveedor, un formulario de clave, un selector de modelo, una zona de mensajes y un formulario de pregunta. Junto al formulario de clave SHALL mostrarse el texto `Tu clave de Anthropic u OpenAI se queda en este navegador y solo se envía a la API de su proveedor (api.anthropic.com o api.openai.com). Las conversaciones se cobran en tu cuenta de ese proveedor.`

#### Scenario: Primera visita
- **WHEN** se carga `chat.html` sin ninguna clave guardada
- **THEN** se ven el selector de proveedor y el formulario de clave con su aviso de privacidad y coste, y no se hace ninguna petición a `api.anthropic.com` ni a `api.openai.com`

### Requirement: Formulario de clave
El formulario SHALL pedir la clave del proveedor elegido en un `<input type="password" autocomplete="off">` etiquetado `CLAVE DE ANTHROPIC` o `CLAVE DE OPENAI`, con `Recordar en este navegador` desmarcada por defecto. Con Claude la clave MUST empezar por `sk-ant-`; con OpenAI MUST empezar por `sk-` y no por `sk-ant-`. Una clave rechazada no hace ninguna petición ni se guarda.

#### Scenario: Clave con formato incorrecto
- **WHEN** con Claude el usuario introduce `abc123` y guarda
- **THEN** se muestra `La clave debe empezar por sk-ant-.` y no se hace ninguna petición

#### Scenario: Clave vacía
- **WHEN** con Claude el usuario guarda el formulario con el campo vacío o solo con espacios
- **THEN** se muestra `La clave debe empezar por sk-ant-.` y no se guarda nada

#### Scenario: Clave válida
- **WHEN** con Claude el usuario introduce `sk-ant-xyz` y guarda
- **THEN** la clave queda guardada y el foco pasa al campo de mensaje

#### Scenario: Clave de OpenAI con Claude elegido
- **WHEN** con Claude el usuario introduce `sk-proj-xyz` y guarda
- **THEN** se muestra `Esa clave parece de OpenAI. Elige OpenAI en PROVEEDOR.` y no se guarda nada

#### Scenario: Clave de Anthropic con OpenAI elegido
- **WHEN** con OpenAI el usuario introduce `sk-ant-xyz` y guarda
- **THEN** se muestra `Esa clave es de Anthropic. Elige Claude (Anthropic) en PROVEEDOR.` y no se guarda nada

#### Scenario: Clave de OpenAI con formato incorrecto
- **WHEN** con OpenAI el usuario introduce `abc123` o deja el campo vacío y guarda
- **THEN** se muestra `La clave de OpenAI debe empezar por sk-.` y no se guarda nada

#### Scenario: Clave de OpenAI válida
- **WHEN** con OpenAI el usuario introduce `sk-proj-xyz` y guarda
- **THEN** la clave queda guardada y el foco pasa al campo de mensaje

### Requirement: Almacenamiento de la clave
Cada proveedor SHALL guardar su clave por separado: Anthropic bajo `pokedex:chat:apikey` y OpenAI bajo `pokedex:chat:apikey:openai`. Sin `Recordar en este navegador` se guarda solo en `sessionStorage`; marcada, solo en `localStorage`. Un almacenamiento no disponible o que lanza MUST NOT romper la página: la clave sigue en memoria de la pestaña.

#### Scenario: Recordar desmarcado
- **WHEN** el usuario guarda la clave de Anthropic con la casilla desmarcada y cierra la pestaña
- **THEN** la clave no está en `localStorage` y solo existía en `sessionStorage`

#### Scenario: Recordar marcado
- **WHEN** el usuario guarda la clave de Anthropic con la casilla marcada
- **THEN** la clave está en `localStorage` bajo `pokedex:chat:apikey` y no en `sessionStorage`

#### Scenario: Clave anterior conservada
- **WHEN** un visitante con una clave de Anthropic recordada por la versión 1.2.0 carga la nueva `chat.html`
- **THEN** el chat con Claude usa esa clave sin pedirla de nuevo

#### Scenario: Claves aisladas por proveedor
- **WHEN** el usuario guarda `sk-proj-xyz` con OpenAI y tenía `sk-ant-xyz` guardada para Claude
- **THEN** `pokedex:chat:apikey:openai` contiene `sk-proj-xyz`, `pokedex:chat:apikey` sigue con `sk-ant-xyz` y ninguna petición lleva la clave del otro proveedor

#### Scenario: Almacenamiento que lanza
- **WHEN** `sessionStorage` y `localStorage` lanzan al escribir
- **THEN** la clave se usa durante la pestaña y la página no muestra ningún error

### Requirement: Olvidar la clave
El botón `OLVIDAR CLAVE` SHALL borrar de `sessionStorage` y de `localStorage` solo la clave del proveedor elegido, abortar cualquier respuesta en curso, vaciar la conversación y volver a mostrar el formulario de clave.

#### Scenario: Olvidar con clave recordada
- **WHEN** con Claude hay una clave en `localStorage` y el usuario pulsa `OLVIDAR CLAVE`
- **THEN** `pokedex:chat:apikey` no existe en ningún almacenamiento, la zona de mensajes queda vacía y se ve el formulario de clave

#### Scenario: Olvidar solo la del proveedor elegido
- **WHEN** hay claves guardadas de ambos proveedores y con OpenAI el usuario pulsa `OLVIDAR CLAVE`
- **THEN** `pokedex:chat:apikey:openai` no existe en ningún almacenamiento y `pokedex:chat:apikey` sigue guardada

### Requirement: Confinamiento de la clave
Ninguna clave MUST escribirse en el DOM, en la consola ni en la URL. La de Anthropic MUST enviarse solo en la cabecera `x-api-key` de peticiones a `https://api.anthropic.com` y la de OpenAI solo en `authorization: Bearer` de peticiones a `https://api.openai.com`.

#### Scenario: Clave fuera del DOM
- **WHEN** se ha guardado una clave de cada proveedor y se ha completado una respuesta con cada uno
- **THEN** el HTML de la página, la URL y los mensajes de consola no contienen ninguna de las dos claves

#### Scenario: Peticiones a otros orígenes
- **WHEN** las herramientas consultan PokéAPI
- **THEN** ninguna petición a PokéAPI lleva `x-api-key`, `authorization` ni ninguna clave

### Requirement: Selector de modelo
Con el proveedor `Claude (Anthropic)` el selector SHALL ofrecer `claude-opus-5-5` (por defecto, `Claude Opus 5.5 — $4 / $20 por millón de tokens`), `claude-sonnet-5-5` (`Claude Sonnet 5.5 — $2 / $10`) y `claude-haiku-5-5` (`Claude Haiku 5.5 — $0,10 / $0,50`). Cambiar de modelo MUST empezar una conversación nueva.

#### Scenario: Modelo por defecto
- **WHEN** se carga `chat.html`
- **THEN** el modelo seleccionado es `claude-opus-5-5` y las tres opciones de Claude muestran sus precios

#### Scenario: Cambio de modelo
- **WHEN** hay una conversación con mensajes y el usuario elige `claude-haiku-5-5`
- **THEN** la zona de mensajes se vacía y la siguiente petición solo contiene la nueva pregunta
