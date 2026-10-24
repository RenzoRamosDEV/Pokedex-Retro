# Spec Delta

## MODIFIED Requirements

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

### Requirement: Comprobaciones de cierre de fase
`npm test`, `npm run mcp:test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation`, `npm run test:mutation:ui`, `npm run mcp:test:mutation`, `npm run e2e` y `npm run lhci` SHALL terminar en verde al cerrar la fase; `npm test` MUST ejecutar al menos 586 tests; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %

#### Scenario: Número de tests
- **WHEN** se ejecuta `npm test`
- **THEN** el resumen informa 586 tests o más, todos en verde

## ADDED Requirements

### Requirement: Mutación del servidor MCP
`npm run mcp:test:mutation` SHALL ejecutar Stryker sobre los módulos no-test de `mcp/src` con los tests de `mcp/test`, `thresholds.break` 85 y cada ejecución abortada si supera 180 s; si una única ejecución no cabe en ese tiempo, MUST dividirse en varias configuraciones que se ejecutan en secuencia y cumplen cada una ambos límites.

#### Scenario: Mutación del MCP dentro de presupuesto
- **WHEN** se ejecuta `npm run mcp:test:mutation`
- **THEN** cada ejecución de Stryker termina en menos de 180 s con una puntuación igual o superior al 85 %

#### Scenario: Puntuación insuficiente del MCP
- **WHEN** la puntuación de mutación de `mcp/src` baja del 85 %
- **THEN** `npm run mcp:test:mutation` termina con código distinto de 0
