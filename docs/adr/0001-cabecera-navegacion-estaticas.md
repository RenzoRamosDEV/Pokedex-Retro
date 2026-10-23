# 0001. Cabecera y navegación estáticas con control en CI

- Estado: Aceptada
- Fecha: 2026-10-23

## Contexto

Las 7 páginas HTML de `site/` repiten la misma cabecera y la misma navegación; solo cambia el enlace de la página activa. La web se publica en GitHub Pages sin build, así que no hay un paso que genere esas partes a partir de una plantilla, y hoy nada impide que una página diverja de las demás.

## Decisión

- La cabecera y la navegación se mantienen escritas a mano en cada HTML: se pintan sin JavaScript, sin salto de maquetación y son indexables.
- El enlace activo se marca con `aria-current="page"`.
- `scripts/check-html.mjs` (expuesto como `npm run check:html` y ejecutado en CI) compara los `<header>` de las 7 páginas y termina con código 1 si difieren en algo distinto de `aria-current="page"`.

## Consecuencias

- Cambiar la navegación obliga a editar las 7 páginas, pero el CI detecta cualquier divergencia.
- La web sigue sin build ni dependencias en runtime.
- Una página nueva debe añadirse también a la comprobación.

## Alternativas

- Inyectar la cabecera con JavaScript: descartada; la navegación dependería de JS, aparecería un salto de maquetación y sería peor para los buscadores.
- Plantillas con un paso de build: descartada; introduce un build que la web no tiene y que el plan excluye.
