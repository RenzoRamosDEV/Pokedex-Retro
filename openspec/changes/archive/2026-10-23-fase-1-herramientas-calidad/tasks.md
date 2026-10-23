# Tareas: Fase 1 — plan, herramientas de calidad y CI

Reglas para todos los commits: asunto exacto indicado, Conventional Commits en español, imperativo, < 72 caracteres, sin punto final, sin `Co-Authored-By` ni mención a IA, identidad git sin cambios. El avance de casillas de este fichero no se añade a commits intermedios: entra en el commit de archivo (design.md D8).

## 1. Rama de trabajo

- [x] 1.1 Actualizar `main` y crear la rama: `git switch main && git pull --ff-only origin main && git switch -c chore/fase-1-herramientas-calidad`; verificar con `git status` que la rama es `chore/fase-1-herramientas-calidad`, que `docs/` y `openspec/` siguen sin seguimiento y que ninguna carpeta listada en `.git/info/exclude` aparece.

## 2. Plan, ADR y OpenSpec

- [x] 2.1 Versionar el plan aprobado tal cual: `git add docs/PLAN.md` y commit `docs(plan): añade el plan de evolución del proyecto`; verificar con `git show --stat HEAD` que solo incluye `docs/PLAN.md`.
- [x] 2.2 Redactar `docs/adr/0001-cabecera-navegacion-estaticas.md`, `0002-estrategia-cache.md`, `0003-mcp-stdio.md` y `0004-javascript-jsdoc-ts-check.md` según design.md D9 (Estado, Fecha, Contexto, Decisión, Consecuencias, Alternativas); verificar con `grep -c '^## \(Contexto\|Decisión\|Consecuencias\|Alternativas\)' docs/adr/*.md` que cada fichero devuelve 4 y que ninguno menciona la carpeta de requisitos locales. Commit `docs(adr): registra las decisiones 0001 a 0004`.
- [x] 2.3 Versionar OpenSpec: `git add openspec/config.yaml openspec/changes/fase-1-herramientas-calidad`; verificar `openspec validate fase-1-herramientas-calidad --strict` en verde. Commit `docs(openspec): añade la configuración y el cambio de la fase 1`.

## 3. Ficheros de repositorio

- [x] 3.1 Crear `.nvmrc` (`22`), `.editorconfig` (UTF-8, LF, 2 espacios, línea final, sin espacios finales salvo `[*.md]`), `LICENSE` (MIT, `Copyright (c) 2026 Renzo Ramos`) y `CONTRIBUTING.md` (design.md D10); verificar `cat .nvmrc` = `22`, `node -p "require('./package.json').engines.node"` = `>=22`, y que `CONTRIBUTING.md` lista los 7 scripts. Commit `chore(repo): añade .nvmrc, .editorconfig, licencia y CONTRIBUTING`.
- [x] 3.2 Crear `.github/PULL_REQUEST_TEMPLATE.md` con Resumen, Cambios y checklist de `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:mutation`; verificar con `grep -c '^- \[ \]' .github/PULL_REQUEST_TEMPLATE.md` = 5. Commit `docs(repo): añade la plantilla de pull request`.

## 4. Lint, formato y typecheck (rojo → verde)

- [x] 4.1 Instalar devDependencies: `npm i -D eslint @eslint/js globals eslint-config-prettier prettier typescript`; verificar que `package-lock.json` se actualiza y que `npm ls --depth=0` no muestra errores ni dependencias de runtime nuevas (`dependencies` sigue ausente).
- [x] 4.2 Añadir `eslint.config.js` (design.md D1), `.prettierrc` (`singleQuote: true`, `printWidth: 100`, `trailingComma: "all"`), `.prettierignore` (D2; copiar cada entrada de `.git/info/exclude` también a los ignorados de ESLint), `tsconfig.json` (D3) y scripts `lint` (`eslint .`), `lint:fix` (`eslint . --fix`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `typecheck` (`tsc -p tsconfig.json`).
- [x] 4.3 Añadir `// @ts-check` como primera línea de los 14 módulos no-test de `site/js/core` y `site/js/mappers` (D3); verificar `npm run typecheck` con código 0 y `git status --porcelain` sin ficheros generados por `tsc`.
- [x] 4.4 Comprobar el rojo esperado antes de arreglar: inyectar temporalmente `document.title;` en `site/js/core/html.js` y verificar que `npm run lint` informa `no-undef` y sale con código 1; revertir con `git checkout -- site/js/core/html.js`. Inyectar temporalmente `const x = 1; x.foo();` en el mismo fichero y verificar que `npm run typecheck` falla; revertir. Ejecutar `npm run lint` (esperado: 1 error, `escapeHtml` sin uso en `site/js/ui/render-natures.js:1`) y `npm run format:check` (esperado: código ≠ 0 con la lista de ficheros sin formato); verificar `npm test` en verde.
- [x] 4.5 Commit de herramientas (config, scripts, `package*.json`, `// @ts-check`) sin formatear el resto (aún no hay hook). Commit `build(lint): configura ESLint, Prettier y typecheck con tsc`; verificar con `git show --stat HEAD` que no hay cambios de formato en otros ficheros.
- [x] 4.6 Ejecutar `npm run format` y verificar `npm run format:check` en verde, `npm test` en verde (135 tests) y `git diff --stat` sin ficheros bajo `site/js/mappers/fixtures/` ni `openspec/`. Commit aislado `style: aplica el formato de Prettier` con solo esos cambios.
- [x] 4.7 Eliminar el import sin uso de `escapeHtml` en `site/js/ui/render-natures.js`; verificar `npm run lint` con código 0, `npm run format:check` y `npm test` en verde. Commit `fix(lint): corrige los avisos de ESLint existentes`.

## 5. Hook de pre-commit

- [x] 5.1 Instalar `npm i -D simple-git-hooks lint-staged` y añadir en `package.json` el script `prepare: simple-git-hooks`, la clave `simple-git-hooks` (`pre-commit: npx lint-staged`) y la clave `lint-staged` (design.md D4); ejecutar `npm run prepare` y verificar que existe `.git/hooks/pre-commit`.
- [x] 5.2 Verificar el escenario «Lint en pre-commit»: crear `tmp-hook.js` con `noDefinida();`, `git add tmp-hook.js`, `git commit -m "test: prueba"` → el commit se rechaza mostrando `no-undef`; verificar con `git log -1 --format=%s` que no hay commit nuevo. Verificar el escenario de formato: sustituir el contenido por `export const a = "x"` y comprobar con `npx lint-staged` que el fichero staged queda con comillas simples. Limpiar: `git reset tmp-hook.js && rm tmp-hook.js`.
- [x] 5.3 Commit `build(hooks): ejecuta lint-staged en pre-commit` (pasa por el propio hook); verificar `npm run lint` y `npm run format:check` en verde.

## 6. CI, Pages y Dependabot

- [x] 6.1 Crear `.github/workflows/ci.yml` según design.md D5; verificar `npm run format:check` en verde y `grep -n 'secrets\.' .github/workflows/ci.yml` sin resultados. Commit `ci: añade el workflow de CI con matriz Node 22 y 24`.
- [x] 6.2 Cambiar el disparador de `.github/workflows/pages.yml` a `workflow_run` del workflow `CI` en `main` + `workflow_dispatch`, con la condición `if`, el checkout de `head_sha` y sin job `test` (design.md D6); verificar por revisión que no queda `push:` en `on:`, que los pasos `configure-pages` / `upload-pages-artifact` (`path: site`) / `deploy-pages` no cambian y que `workflows: [CI]` coincide con `name: CI`. Commit `ci(pages): despliega solo tras un CI verde en main`.
- [x] 6.3 Crear `.github/dependabot.yml` (design.md D7: `npm` y `github-actions` en `/`, semanal); verificar `npm run format:check` en verde. Commit `chore(deps): configura Dependabot semanal`.

## 7. Comprobaciones de cierre

- [x] 7.1 Ejecutar desde limpio `npm ci`, `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` y `time npm run test:mutation`; verificar todo en verde, mutación ≥ 95 % y ≤ 180 s (si `timeout` la aborta, parar y dividir la config según la regla común 5 antes de seguir).
- [x] 7.2 Verificar que `git log --format='%s%n%b' main..HEAD` no contiene `Co-Authored-By` ni menciones a IA, que todos los asuntos tienen < 72 caracteres y que ningún documento de `docs/` menciona carpetas locales excluidas (`grep -v '^#' .git/info/exclude | xargs -I{} git grep -nF {} -- docs` sin resultados).

## Workflow follow-up

Pasos posteriores, en este orden (tasks.md ya está archivado cuando ocurren):

- Archivar el cambio: `openspec archive fase-1-herramientas-calidad --yes` (o el procedimiento de `.claude/commands/opsx/archive.md`); verificar que se crean `openspec/specs/calidad-codigo/spec.md`, `openspec/specs/integracion-continua/spec.md` y `openspec/specs/gobierno-repositorio/spec.md` y que el cambio queda en `openspec/changes/archive/<fecha>-fase-1-herramientas-calidad/`. Commit `docs(openspec): archiva el cambio fase-1-herramientas-calidad`.
- Publicar la rama: `git push -u origin chore/fase-1-herramientas-calidad`.
- Abrir el PR: `gh pr create --base main --title "Fase 1: plan, herramientas de calidad y CI" --body-file <cuerpo en español>` con la plantilla de PR rellenada (resumen, lista de commits, checklist marcada, nota sobre el nuevo disparador de Pages); sin atribución a IA.
- Esperar el CI del PR: `gh pr checks --watch`; los dos jobs (Node 22 y 24) en verde. Si falla, corregir en la rama con un commit nuevo (nunca force-push a `main`).
- Fusionar: `gh pr merge --rebase --delete-branch`; después `git switch main && git pull --ff-only`.
- Verificar el despliegue encadenado: `gh run list --workflow ci.yml --branch main --limit 1` en `success`, luego `gh run list --workflow pages.yml --event workflow_run --limit 1` y `gh run watch <id> --exit-status` en `success`, con `headSha` igual al último commit de `main`.
- Verificar la web: `curl -sS -o /dev/null -w '%{http_code}' https://renzoramosdev.github.io/Pokedex-Retro/` devuelve `200`.
