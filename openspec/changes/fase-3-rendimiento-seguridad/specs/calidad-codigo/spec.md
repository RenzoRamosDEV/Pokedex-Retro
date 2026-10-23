# Spec Delta

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
- **WHEN** las 7 páginas solo difieren en la marca de su propio enlace y se ejecuta `npm run check:html`
- **THEN** termina con código 0

#### Scenario: Página 404 excluida
- **WHEN** `site/` contiene además `404.html` con una cabecera distinta y se ejecuta `npm run check:html`
- **THEN** termina con código 0 y no menciona `404.html`

### Requirement: Comprobaciones de cierre de fase
`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html` y `npm run test:mutation` SHALL terminar en verde al cerrar la fase; `npm test` MUST ejecutar al menos 230 tests; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Número de tests
- **WHEN** se ejecuta `npm test`
- **THEN** el resumen informa 230 tests o más, todos en verde
