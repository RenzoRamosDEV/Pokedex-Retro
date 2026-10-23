# Spec Delta

## MODIFIED Requirements

### Requirement: Typecheck sin build
`npm run typecheck` SHALL comprobar tipos con `tsc -p tsconfig.json` sin emitir ficheros (`allowJs`, `checkJs`, `noEmit`, `strict: false`, `NodeNext`) sobre los módulos no-test de `site/js/core`, `site/js/mappers` y `site/js/api`, cada uno con `// @ts-check` en la primera línea. La web MUST seguir desplegándose sin compilación.

#### Scenario: Error de tipos
- **WHEN** un módulo de `site/js/core` invoca un método inexistente sobre un número literal
- **THEN** `npm run typecheck` informa el error y termina con código distinto de 0

#### Scenario: Error de tipos en el cliente HTTP
- **WHEN** un módulo de `site/js/api` invoca un método inexistente sobre un número literal
- **THEN** `npm run typecheck` informa el error y termina con código distinto de 0

#### Scenario: Sin artefactos generados
- **WHEN** `npm run typecheck` termina con éxito
- **THEN** no aparece ningún fichero nuevo en el árbol de trabajo

### Requirement: Comprobaciones de cierre de fase
`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html` y `npm run test:mutation` SHALL terminar en verde al cerrar la fase; `npm test` MUST ejecutar al menos 135 tests; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Número de tests
- **WHEN** se ejecuta `npm test`
- **THEN** el resumen informa 135 tests o más, todos en verde

## ADDED Requirements

### Requirement: Cabeceras HTML coherentes
`npm run check:html` SHALL comparar el bloque `<header>…</header>` de cada página HTML de `site/` con el de `index.html`, ignorando solo la marca de página activa del enlace a la propia página (clase `active` y `aria-current="page"`), y MUST terminar con código 1 nombrando cada fichero divergente. No SHALL requerir dependencias.

#### Scenario: Cabecera divergente
- **WHEN** `tipos.html` tiene un enlace de navegación distinto al resto y se ejecuta `npm run check:html`
- **THEN** termina con código 1 e indica `tipos.html`

#### Scenario: Marca activa en otra página
- **WHEN** `bayas.html` marca como activo el enlace de `tipos.html` y se ejecuta `npm run check:html`
- **THEN** termina con código 1 e indica `bayas.html`

#### Scenario: Cabeceras iguales
- **WHEN** las 7 páginas solo difieren en la marca de su propio enlace y se ejecuta `npm run check:html`
- **THEN** termina con código 0

### Requirement: Pureza de core y mappers
`npm test` SHALL incluir un test que, tras comprobar que `globalThis.window` y `globalThis.document` son `undefined`, importa todos los módulos no-test de `site/js/core` y `site/js/mappers` en Node y falla si alguna importación lanza.

#### Scenario: Acceso al DOM al importar
- **WHEN** un módulo de `site/js/core` lee `document.title` en su nivel superior
- **THEN** el test de pureza falla nombrando ese módulo

### Requirement: Versión sincronizada
La versión de la web SHALL vivir en `site/js/version.js` (`export const VERSION`), generado a partir de `version` de `package.json` por `scripts/sync-version.mjs`, que también se ejecuta en `npm version`. `npm test` MUST fallar si ambos valores difieren.

#### Scenario: Versión desincronizada
- **WHEN** `package.json` declara `1.0.1` y `site/js/version.js` exporta `1.0.0`
- **THEN** `npm test` falla mostrando ambos valores

#### Scenario: Regeneración
- **WHEN** se ejecuta `node scripts/sync-version.mjs` con `package.json` en `1.0.1`
- **THEN** `site/js/version.js` exporta `1.0.1` y cumple `npm run format:check`
