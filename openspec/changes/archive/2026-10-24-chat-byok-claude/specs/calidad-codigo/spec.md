# Spec Delta

## ADDED Requirements

### Requirement: Mutación del chat y de la lógica compartida
`npm run test:mutation:chat` SHALL ejecutar Stryker con una configuración propia sobre los módulos puros no-test del chat y los de `site/js/core` que comparten la web y el MCP para las herramientas, con `thresholds.break: 95`, y MUST abortarse si supera 180 s. Esos módulos de `core` MUST quedar fuera de `npm run test:mutation` para no repetir su mutación.

#### Scenario: Mutación del chat dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation:chat`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Puntuación insuficiente
- **WHEN** la puntuación de mutación del chat es inferior al 95 %
- **THEN** el comando termina con código distinto de 0

### Requirement: Tests del chat sin red
Los tests unitarios del chat SHALL usar un `fetch` falso que devuelve streams SSE sintéticos con el formato documentado de la API de Claude y MUST NOT hacer peticiones de red reales.

#### Scenario: Sin acceso a internet
- **WHEN** se ejecuta `npm test` sin acceso a internet
- **THEN** todos los tests del chat pasan

## MODIFIED Requirements

### Requirement: Cabeceras HTML coherentes
`npm run check:html` SHALL comparar el bloque `<header>…</header>` de cada página HTML de `site/` con el de `index.html`, ignorando solo la marca de página activa del enlace a la propia página (clase `active` y `aria-current="page"`), y MUST terminar con código 1 nombrando cada fichero divergente. `404.html` MUST quedar excluida de la comparación (usa rutas absolutas y no forma parte de la navegación). No SHALL requerir dependencias.

#### Scenario: Cabecera divergente
- **WHEN** `tipos.html` tiene un enlace de navegación distinto al resto y se ejecuta `npm run check:html`
- **THEN** termina con código 1 e indica `tipos.html`

#### Scenario: Marca activa en otra página
- **WHEN** `bayas.html` marca como activo el enlace de `tipos.html` y se ejecuta `npm run check:html`
- **THEN** termina con código 1 e indica `bayas.html`

#### Scenario: Cabeceras iguales
- **WHEN** las 8 páginas, incluida `chat.html`, solo difieren en la marca de su propio enlace y se ejecuta `npm run check:html`
- **THEN** termina con código 0

#### Scenario: Página 404 excluida
- **WHEN** `site/` contiene además `404.html` con una cabecera distinta y se ejecuta `npm run check:html`
- **THEN** termina con código 0 y no menciona `404.html`

### Requirement: Pureza de core y mappers
`npm test` SHALL incluir un test que, tras comprobar que `globalThis.window` y `globalThis.document` son `undefined`, importa todos los módulos no-test de `site/js/core`, `site/js/mappers` y `site/js/chat` en Node y falla si alguna importación lanza.

#### Scenario: Acceso al DOM al importar
- **WHEN** un módulo de `site/js/core` lee `document.title` en su nivel superior
- **THEN** el test de pureza falla nombrando ese módulo

#### Scenario: Chat sin DOM
- **WHEN** un módulo de `site/js/chat` accede a `window` o `document` en su nivel superior
- **THEN** el test de pureza falla nombrando ese módulo

### Requirement: Mutación de la capa de interfaz
`npm run test:mutation:ui` SHALL ejecutar Stryker sobre los módulos no-test de `site/js/ui`, excepto los de arranque y el de tema, con configuraciones propias y `thresholds.break: 85`, y cada ejecución MUST abortarse si supera 180 s; si no cabe en ese tiempo, MUST dividirse en varias configuraciones en secuencia. La guarda de literales de `strings.test.js`, que lee el código fuente, MUST quedar fuera de esas ejecuciones.

#### Scenario: Mutación de ui dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation:ui`
- **THEN** cada ejecución termina en menos de 180 s con una puntuación igual o superior al 85 %

#### Scenario: Puntuación insuficiente
- **WHEN** la puntuación de mutación de `ui` es inferior al 85 %
- **THEN** el comando termina con código distinto de 0

### Requirement: Pruebas e2e con PokéAPI simulada
`npm run e2e` SHALL ejecutar en Chromium, sobre `site/` servido por un servidor estático local, pruebas que simulan todas las peticiones a `https://pokeapi.co/**` con datos derivados de los fixtures de los mappers y todas las peticiones a `https://api.anthropic.com/**` con respuestas SSE sintéticas, y no hacen peticiones externas. MUST cubrir las 8 páginas, búsqueda, paginación, diálogo con teclado, tema persistido, el flujo del chat y 0 violaciones axe `serious`/`critical` por página y tema.

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
