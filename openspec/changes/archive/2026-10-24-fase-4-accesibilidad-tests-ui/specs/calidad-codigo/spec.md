# Spec Delta

## MODIFIED Requirements

### Requirement: Lint por entorno
`npm run lint` SHALL ejecutar ESLint con las reglas recomendadas sobre todo el JavaScript versionado, con globales de navegador solo en `site/js/ui` y `site/js/api`, globales de Node en tests, `scripts/` y `mcp/`, globales de Node y de navegador en `tests/e2e` (incluye código evaluado en la página), y en `site/js/core` y `site/js/mappers` solo `URLSearchParams` (común a ambos entornos). MUST terminar con código distinto de 0 si hay errores. `npm run lint:fix` SHALL aplicar las correcciones automáticas.

#### Scenario: Uso del DOM en la capa pura
- **WHEN** un módulo de `site/js/core` referencia `document`
- **THEN** `npm run lint` informa `no-undef` y termina con código 1

#### Scenario: Repositorio limpio
- **WHEN** se ejecuta `npm run lint` sobre el código de la rama de esta fase ya terminada
- **THEN** termina con código 0 sin errores

### Requirement: Comprobaciones de cierre de fase
`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation`, `npm run test:mutation:ui`, `npm run e2e` y `npm run lhci` SHALL terminar en verde al cerrar la fase; `npm test` MUST ejecutar al menos 387 tests; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Número de tests
- **WHEN** se ejecuta `npm test`
- **THEN** el resumen informa 387 tests o más, todos en verde

## ADDED Requirements

### Requirement: Tests de la capa de interfaz
`npm test` SHALL incluir tests en Node, sin red ni navegador, de la maquetación y de cada módulo de renderizado que comprueben con datos de fixture el escapado de valores con `<script>`, los atributos ARIA, la estructura (número de tarjetas, filas y enlaces de paginación) y que los textos visibles salen del objeto de textos.

#### Scenario: Valor malicioso escapado
- **WHEN** un renderizado recibe un nombre `<script>alert(1)</script>`
- **THEN** la salida contiene `&lt;script&gt;` y no contiene `<script>`

#### Scenario: Estructura de la Pokédex
- **WHEN** se renderizan 18 Pokémon de fixture con ids distintos
- **THEN** la salida tiene 18 tarjetas y 18 diálogos con ids únicos

### Requirement: Mutación de la capa de interfaz
`npm run test:mutation:ui` SHALL ejecutar Stryker sobre los módulos no-test de `site/js/ui`, excepto el de arranque y el de tema, con una configuración propia y `thresholds.break: 85`, y MUST abortarse si supera 180 s. La guarda de literales de `strings.test.js`, que lee el código fuente, MUST quedar fuera de esa ejecución.

#### Scenario: Mutación de ui dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation:ui`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 85 %

#### Scenario: Puntuación insuficiente
- **WHEN** la puntuación de mutación de `ui` es inferior al 85 %
- **THEN** el comando termina con código distinto de 0

### Requirement: Pruebas e2e con PokéAPI simulada
`npm run e2e` SHALL ejecutar en Chromium, sobre `site/` servido por un servidor estático local, un smoke que simula todas las peticiones a `https://pokeapi.co/**` con datos derivados de los fixtures de los mappers y no hace peticiones externas. MUST cubrir las 7 páginas, búsqueda, paginación, diálogo con teclado, tema persistido y 0 violaciones axe `serious`/`critical` por página y tema.

#### Scenario: Sin red externa
- **WHEN** se ejecuta `npm run e2e` sin acceso a internet
- **THEN** todas las pruebas pasan y no se registra ninguna petición fuera del servidor local

#### Scenario: Violación de accesibilidad
- **WHEN** una página tiene un texto con contraste 3:1 en el tema `gb` y se ejecuta `npm run e2e`
- **THEN** el comando falla nombrando la página, el tema y la regla de axe

#### Scenario: Violación de CSP
- **WHEN** una página produce una violación de la política de seguridad de contenidos durante el smoke
- **THEN** el comando falla

### Requirement: Presupuestos de Lighthouse
`npm run lhci` SHALL auditar con Lighthouse `index.html` y `tipos.html` servidos localmente, 3 ejecuciones por página, y MUST fallar si accesibilidad, buenas prácticas o SEO bajan de 0,95. Performance SHALL exigir 0,95; solo si la cifra medida es inferior por la latencia real de PokéAPI su aserción MUST pasar a aviso y la cifra documentarse en el PR.

#### Scenario: Accesibilidad por debajo del umbral
- **WHEN** `tipos.html` obtiene 0,90 en accesibilidad
- **THEN** `npm run lhci` termina con código distinto de 0

#### Scenario: Presupuestos cumplidos
- **WHEN** las dos páginas obtienen al menos 0,95 en las cuatro categorías
- **THEN** `npm run lhci` termina con código 0
