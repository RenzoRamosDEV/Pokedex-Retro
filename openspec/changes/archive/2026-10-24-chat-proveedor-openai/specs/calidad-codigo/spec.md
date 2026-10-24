## MODIFIED Requirements

### Requirement: Pruebas e2e con PokéAPI simulada
`npm run e2e` SHALL ejecutar en Chromium, sobre `site/` servido localmente, pruebas que simulan todas las peticiones a `https://pokeapi.co/**` con datos de los fixtures, y a `https://api.anthropic.com/**` y `https://api.openai.com/**` con respuestas SSE sintéticas, sin peticiones externas. MUST cubrir las 8 páginas, búsqueda, paginación, diálogo con teclado, tema persistido, el chat con ambos proveedores y 0 violaciones axe `serious`/`critical` por página y tema.

#### Scenario: Sin red externa
- **WHEN** se ejecuta `npm run e2e` sin acceso a internet
- **THEN** todas las pruebas pasan y no se registra ninguna petición fuera del servidor local

#### Scenario: Violación de accesibilidad
- **WHEN** una página tiene un texto con contraste 3:1 en el tema `gb` y se ejecuta `npm run e2e`
- **THEN** el comando falla nombrando la página, el tema y la regla de axe

#### Scenario: Violación de CSP
- **WHEN** una página produce una violación de la política de seguridad de contenidos durante el smoke
- **THEN** el comando falla

#### Scenario: Flujo del chat simulado
- **WHEN** en `chat.html` se guarda una clave, se pregunta y la API simulada pide una tool y después responde texto
- **THEN** la página muestra `CONSULTANDO: <tool>`, después el texto final y la línea de tokens, sin peticiones externas reales

#### Scenario: Flujo del chat con OpenAI simulado
- **WHEN** en `chat.html` se elige `OpenAI`, se guarda una clave, se pregunta y la API de OpenAI simulada pide una función y después responde texto
- **THEN** la página muestra `CONSULTANDO: <tool>`, después el texto final con la etiqueta `OPENAI` y la línea de tokens, y ninguna petición va a `api.anthropic.com`

### Requirement: Mutación del chat y de la lógica compartida
`npm run test:mutation:chat` SHALL ejecutar Stryker sobre los módulos puros no-test del chat, incluidos los adaptadores de ambos proveedores, y los de `site/js/core` que comparten web y MCP, en configuraciones encadenadas con `thresholds.break: 95` cada una, abortando cada ejecución que supere 180 s. Esos módulos de `core` MUST quedar fuera de `npm run test:mutation`.

#### Scenario: Mutación del chat dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation:chat`
- **THEN** cada ejecución de Stryker termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Puntuación insuficiente
- **WHEN** la puntuación de mutación de cualquiera de las configuraciones del chat es inferior al 95 %
- **THEN** el comando termina con código distinto de 0

### Requirement: Tests del chat sin red
Los tests unitarios del chat SHALL usar un `fetch` falso que devuelve streams SSE sintéticos con el formato documentado de la API de Claude o de la Responses API de OpenAI y MUST NOT hacer peticiones de red reales.

#### Scenario: Sin acceso a internet
- **WHEN** se ejecuta `npm test` sin acceso a internet
- **THEN** todos los tests del chat, de ambos proveedores, pasan
