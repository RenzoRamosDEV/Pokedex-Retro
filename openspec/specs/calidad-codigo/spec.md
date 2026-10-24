# calidad-codigo Specification

## Purpose
Define las comprobaciones estáticas de calidad del repositorio (lint, formato, typecheck), los comandos que las ejecutan y su aplicación en pre-commit, sin añadir build ni dependencias de runtime a la web.

## Requirements

### Requirement: Versión de Node declarada
El repositorio SHALL declarar Node 22 como versión de desarrollo en `.nvmrc` (contenido `22`) y `"engines": { "node": ">=22" }` en `package.json`.

#### Scenario: Versión fijada para el entorno local
- **WHEN** un desarrollador ejecuta `nvm use` en la raíz
- **THEN** se selecciona Node 22

### Requirement: Convenciones de edición
El repositorio SHALL incluir `.editorconfig` con UTF-8, fin de línea LF, indentación de 2 espacios, línea final obligatoria y eliminación de espacios finales en todos los ficheros excepto `*.md`.

#### Scenario: Markdown conserva espacios finales
- **WHEN** un editor compatible con EditorConfig guarda un `*.md` con dos espacios finales de salto de línea
- **THEN** los espacios finales se conservan

#### Scenario: JavaScript sin espacios finales
- **WHEN** un editor compatible con EditorConfig guarda un `*.js`
- **THEN** se eliminan los espacios finales y el fichero termina en un único salto de línea LF

### Requirement: Lint por entorno
`npm run lint` SHALL ejecutar ESLint con las reglas recomendadas sobre todo el JavaScript versionado, con globales de navegador solo en `site/js/ui` y `site/js/api`, globales de Node en tests, `scripts/` y `mcp/`, globales de Node y de navegador en `tests/e2e`, y en `site/js/core` y `site/js/mappers` solo `URLSearchParams` (común a ambos entornos). MUST terminar con código distinto de 0 si hay errores. `npm run lint:fix` SHALL aplicar las correcciones automáticas.

#### Scenario: Uso del DOM en la capa pura
- **WHEN** un módulo de `site/js/core` referencia `document`
- **THEN** `npm run lint` informa `no-undef` y termina con código 1

#### Scenario: Repositorio limpio
- **WHEN** se ejecuta `npm run lint` sobre el código de la rama de esta fase ya terminada
- **THEN** termina con código 0 sin errores

### Requirement: Formato único
El repositorio SHALL usar Prettier con `singleQuote: true`, `printWidth: 100` y `trailingComma: "all"`; las reglas de estilo de ESLint que choquen con Prettier MUST estar desactivadas. `npm run format` SHALL reescribir el formato y `npm run format:check` SHALL fallar si algún fichero no ignorado no cumple el formato.

#### Scenario: Fichero sin formatear
- **WHEN** un fichero `site/js/**/*.js` usa comillas dobles en un literal y se ejecuta `npm run format:check`
- **THEN** el comando lista el fichero y termina con código distinto de 0

#### Scenario: Fixtures reales intactos
- **WHEN** se ejecuta `npm run format`
- **THEN** los fixtures de respuestas reales de `site/js/mappers/fixtures/` no se modifican

### Requirement: Typecheck sin build
`npm run typecheck` SHALL comprobar tipos con `tsc -p tsconfig.json` sin emitir ficheros (`allowJs`, `checkJs`, `noEmit`, `strict: false`, `NodeNext`) sobre los módulos no-test de `site/js/core`, `site/js/mappers`, `site/js/api` y `mcp/src`, cada uno con `// @ts-check` en la primera línea. La web y el servidor MCP MUST seguir ejecutándose sin compilación.

#### Scenario: Error de tipos
- **WHEN** un módulo de `site/js/core` invoca un método inexistente sobre un número literal
- **THEN** `npm run typecheck` informa el error y termina con código distinto de 0

#### Scenario: Error de tipos en el cliente HTTP
- **WHEN** un módulo de `site/js/api` invoca un método inexistente sobre un número literal
- **THEN** `npm run typecheck` informa el error y termina con código distinto de 0

#### Scenario: Error de tipos en el servidor MCP
- **WHEN** un módulo de `mcp/src` invoca un método inexistente sobre un número literal
- **THEN** `npm run typecheck` informa el error y termina con código distinto de 0

#### Scenario: Sin artefactos generados
- **WHEN** `npm run typecheck` termina con éxito
- **THEN** no aparece ningún fichero nuevo en el árbol de trabajo

### Requirement: Control en pre-commit
Al hacer `git commit` SHALL ejecutarse un hook de pre-commit que aplique `eslint --fix` y `prettier --write` a los ficheros staged y vuelva a añadirlos; si queda un error de ESLint no autocorregible, el commit MUST rechazarse mostrando el error.

#### Scenario: Lint en pre-commit
- **WHEN** se ejecuta `git commit` con un fichero staged que contiene un error de ESLint no autocorregible
- **THEN** el commit se rechaza y se muestra el error

#### Scenario: Formato corregido al confirmar
- **WHEN** se ejecuta `git commit` con un `*.js` staged que solo tiene problemas de formato
- **THEN** el commit se crea con el fichero ya formateado

### Requirement: Comprobaciones de cierre de fase
`npm test`, `npm run mcp:test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation`, `npm run test:mutation:ui`, `npm run mcp:test:mutation`, `npm run e2e` y `npm run lhci` SHALL terminar en verde al cerrar la fase; `npm test` MUST ejecutar al menos 586 tests; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Número de tests
- **WHEN** se ejecuta `npm test`
- **THEN** el resumen informa 586 tests o más, todos en verde

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

### Requirement: Versión sincronizada
La versión de la web SHALL vivir en `site/js/version.js` (`export const VERSION`), generado a partir de `version` de `package.json` por `scripts/sync-version.mjs`, que también se ejecuta en `npm version`. `npm test` MUST fallar si ambos valores difieren.

#### Scenario: Versión desincronizada
- **WHEN** `package.json` declara `1.0.1` y `site/js/version.js` exporta `1.0.0`
- **THEN** `npm test` falla mostrando ambos valores

#### Scenario: Regeneración
- **WHEN** se ejecuta `node scripts/sync-version.mjs` con `package.json` en `1.0.1`
- **THEN** `site/js/version.js` exporta `1.0.1` y cumple `npm run format:check`

### Requirement: Tests de la capa de interfaz
`npm test` SHALL incluir tests en Node, sin red ni navegador, de la maquetación y de cada módulo de renderizado que comprueben con datos de fixture el escapado de valores con `<script>`, los atributos ARIA, la estructura (número de tarjetas, filas y enlaces de paginación) y que los textos visibles salen del objeto de textos.

#### Scenario: Valor malicioso escapado
- **WHEN** un renderizado recibe un nombre `<script>alert(1)</script>`
- **THEN** la salida contiene `&lt;script&gt;` y no contiene `<script>`

#### Scenario: Estructura de la Pokédex
- **WHEN** se renderizan 18 Pokémon de fixture con ids distintos
- **THEN** la salida tiene 18 tarjetas y 18 diálogos con ids únicos

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

### Requirement: Presupuestos de Lighthouse
`npm run lhci` SHALL auditar con Lighthouse `index.html` y `tipos.html` servidos localmente, 3 ejecuciones por página, y MUST fallar si accesibilidad, buenas prácticas o SEO bajan de 0,95. Performance SHALL exigir 0,95; solo si la cifra medida es inferior por la latencia real de PokéAPI su aserción MUST pasar a aviso y la cifra documentarse en el PR.

#### Scenario: Accesibilidad por debajo del umbral
- **WHEN** `tipos.html` obtiene 0,90 en accesibilidad
- **THEN** `npm run lhci` termina con código distinto de 0

#### Scenario: Presupuestos cumplidos
- **WHEN** las dos páginas obtienen al menos 0,95 en las cuatro categorías
- **THEN** `npm run lhci` termina con código 0

### Requirement: Mutación del servidor MCP
`npm run mcp:test:mutation` SHALL ejecutar Stryker sobre los módulos no-test de `mcp/src` con los tests de `mcp/test`, `thresholds.break` 85 y cada ejecución abortada si supera 180 s; si una única ejecución no cabe en ese tiempo, MUST dividirse en varias configuraciones que se ejecutan en secuencia y cumplen cada una ambos límites.

#### Scenario: Mutación del MCP dentro de presupuesto
- **WHEN** se ejecuta `npm run mcp:test:mutation`
- **THEN** cada ejecución de Stryker termina en menos de 180 s con una puntuación igual o superior al 85 %

#### Scenario: Puntuación insuficiente del MCP
- **WHEN** la puntuación de mutación de `mcp/src` baja del 85 %
- **THEN** `npm run mcp:test:mutation` termina con código distinto de 0

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
