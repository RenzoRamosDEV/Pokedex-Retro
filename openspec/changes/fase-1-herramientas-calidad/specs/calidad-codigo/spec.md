# Spec Delta

## Purpose

Define las comprobaciones estáticas de calidad del repositorio (lint, formato, typecheck), los comandos que las ejecutan y su aplicación en pre-commit, sin añadir build ni dependencias de runtime a la web.

## ADDED Requirements

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
`npm run lint` SHALL ejecutar ESLint con las reglas recomendadas sobre todo el JavaScript versionado, con globales de navegador solo en `site/js/ui` y `site/js/api`, globales de Node en tests, `scripts/` y `mcp/`, y en `site/js/core` y `site/js/mappers` solo `URLSearchParams` (común a ambos entornos). MUST terminar con código distinto de 0 si hay errores. `npm run lint:fix` SHALL aplicar las correcciones automáticas.

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
`npm run typecheck` SHALL comprobar tipos con `tsc -p tsconfig.json` sin emitir ficheros (`allowJs`, `checkJs`, `noEmit`, `strict: false`, `NodeNext`) sobre los módulos no-test de `site/js/core` y `site/js/mappers`, cada uno con `// @ts-check` en la primera línea. La web MUST seguir desplegándose sin compilación.

#### Scenario: Error de tipos
- **WHEN** un módulo de `site/js/core` invoca un método inexistente sobre un número literal
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
`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` y `npm run test:mutation` SHALL terminar en verde al cerrar la fase; `npm run test:mutation` MUST abortarse si supera 180 s y mantener `thresholds.break` en 95 sobre `site/js/core` y `site/js/mappers`.

#### Scenario: Mutación dentro de presupuesto
- **WHEN** se ejecuta `npm run test:mutation`
- **THEN** termina en menos de 180 s con una puntuación igual o superior al 95 %
