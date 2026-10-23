# Guía de contribución

## Requisitos

- Node 22 (usa el último parche de la serie 22). Con `nvm`, ejecuta `nvm use` en la raíz: lee `.nvmrc`.
- `npm ci` instala las dependencias de desarrollo y el hook de pre-commit.

La web (`site/`) no tiene build ni dependencias en runtime: se despliega tal cual en GitHub Pages.

## Ramas

- Crea la rama desde `main` actualizado: `git switch main && git pull --ff-only && git switch -c <tipo>/<descripcion-kebab>`.
- `<tipo>` es el mismo tipo del commit principal (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`…).

## Commits

Conventional Commits con el tipo en inglés y la descripción en español:

```
<tipo>(<ámbito>): <descripción>
```

- Descripción en imperativo (`añade`, `corrige`), asunto de menos de 72 caracteres y sin punto final.
- Sin líneas `Co-Authored-By` ni otras atribuciones de coautoría.
- El hook de pre-commit ejecuta `eslint --fix` y `prettier --write` sobre los ficheros staged; un error de ESLint no autocorregible rechaza el commit.

## Pull requests

1. Publica la rama: `git push -u origin <rama>`.
2. Abre el PR con `gh pr create`; la plantilla incluye la checklist de comprobaciones.
3. Se fusiona con `gh pr merge --rebase --delete-branch` solo con el CI en verde. Nunca se hace force-push a `main`.

## Comandos

| Comando                    | Qué hace                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `npm test`                 | Tests unitarios con `node --test` (`site/js` y `scripts`)          |
| `npm run test:mutation`    | Mutación con Stryker sobre `core` y `mappers` (umbral 95 %, 180 s) |
| `npm run test:mutation:ui` | Mutación con Stryker sobre `site/js/ui` (umbral 85 %, 180 s)       |
| `npm run lint`             | ESLint sobre todo el JavaScript                                    |
| `npm run lint:fix`         | ESLint aplicando las correcciones automáticas                      |
| `npm run format`           | Reescribe el formato con Prettier                                  |
| `npm run format:check`     | Falla si algún fichero no cumple el formato                        |
| `npm run typecheck`        | `tsc` sin emitir ficheros sobre `core`, `mappers` y `api`          |
| `npm run check:html`       | Comprueba que la cabecera de las 7 páginas HTML coincide           |

Antes de abrir un PR deben pasar `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation` y `npm run test:mutation:ui`.

## TDD

Ningún código de producción sin un test que falle antes: rojo, verde y refactor. Los tests usan fixtures reales y dobles ligeros (fakes antes que mocks) y no acceden a la red.
