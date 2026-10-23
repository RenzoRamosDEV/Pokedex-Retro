# 0004. JavaScript con JSDoc y `// @ts-check` en lugar de TypeScript

- Estado: Aceptada
- Fecha: 2026-10-23

## Contexto

La web se publica en GitHub Pages tal cual, sin build, y el servidor MCP previsto importará los mismos módulos de `site/js/core` y `site/js/mappers`. Se quiere comprobación de tipos sin introducir compilación.

## Decisión

- El código sigue en JavaScript (módulos ES) con tipos en JSDoc.
- Los módulos bajo typecheck llevan `// @ts-check` en la primera línea.
- `npm run typecheck` ejecuta `tsc -p tsconfig.json` con `allowJs`, `checkJs` y `noEmit`, y se ejecuta en CI.

## Consecuencias

- `site/` se despliega sin compilar y el MCP importa los módulos directamente.
- Los tipos en JSDoc son más verbosos que la sintaxis de TypeScript.
- `typescript` es solo una dependencia de desarrollo; no añade nada en runtime.

## Alternativas

- TypeScript con build: descartada; obliga a compilar la web y el MCP, y rompe la regla de desplegar `site/` sin build.
- Sin typecheck: descartada; se pierden errores detectables antes de ejecutar.
