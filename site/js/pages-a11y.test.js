import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE_DIR = join(import.meta.dirname, '..');
const SECTION_PAGES = [
  'index.html',
  'movimientos.html',
  'tipos.html',
  'habilidades.html',
  'naturalezas.html',
  'objetos.html',
  'bayas.html',
];

const readSite = (file) => readFileSync(join(SITE_DIR, file), 'utf8');
const tagsOf = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null;
const mainOf = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));

for (const page of SECTION_PAGES) {
  const html = readSite(page);

  test(`${page}: the first child of body is the skip link to #contenido`, () => {
    assert.match(
      html,
      /<body\b[^>]*>\s*<a class="skip-link" href="#contenido">Saltar al contenido<\/a>/,
    );
  });

  test(`${page}: main is the focusable #contenido target`, () => {
    assert.deepEqual(tagsOf(html, 'main'), [
      '<main id="contenido" class="site-main" tabindex="-1">',
    ]);
  });

  test(`${page}: there is exactly one polite status region and it lives in main`, () => {
    const regions = tagsOf(html, '[a-z]+').filter((tag) => attribute(tag, 'role') === 'status');
    assert.equal(regions.length, 1);
    assert.equal(attribute(regions[0], 'aria-live'), 'polite');
    assert.ok(mainOf(html).includes(regions[0]));
  });

  for (const [button, panel] of [
    ['theme-btn', 'theme-dropdown'],
    ['info-btn', 'info-dropdown'],
  ]) {
    test(`${page}: #${button} announces and controls #${panel}`, () => {
      const tag = tagsOf(html, 'button').find((candidate) => attribute(candidate, 'id') === button);
      assert.ok(tag, button);
      assert.equal(attribute(tag, 'type'), 'button');
      assert.equal(attribute(tag, 'aria-haspopup'), 'true');
      assert.equal(attribute(tag, 'aria-expanded'), 'false');
      assert.equal(attribute(tag, 'aria-controls'), panel);
      assert.ok(html.includes(`id="${panel}"`), panel);
    });
  }

  test(`${page}: main has a noscript notice`, () => {
    assert.match(
      mainOf(html),
      /<noscript>\s*<p class="page-info">ESTA POKÉDEX NECESITA JAVASCRIPT<\/p>\s*<\/noscript>/,
    );
  });
}
