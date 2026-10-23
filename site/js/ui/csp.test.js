import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS } from '../core/sections.js';
import { pokedexView } from './render-pokedex.js';
import { movesView } from './render-moves.js';
import { naturesView } from './render-natures.js';
import { itemsView } from './render-items.js';
import { berriesView } from './render-berries.js';
import { typesView } from './render-types.js';
import { abilitiesView } from './render-abilities.js';

const SITE_DIR = join(import.meta.dirname, '../..');
const FONT_FILES = ['press-start-2p-latin-400-normal.woff2', 'vt323-latin-400-normal.woff2'];

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; " +
  "img-src 'self' https://raw.githubusercontent.com; connect-src https://pokeapi.co; " +
  "manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

const HTML_PAGES = readdirSync(SITE_DIR)
  .filter((file) => file.endsWith('.html'))
  .sort();
const readSite = (file) => readFileSync(join(SITE_DIR, file), 'utf8');
const tagsOf = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null;
const hasFlag = (tag, name) => new RegExp(`\\s${name}(?=[\\s/>=])`, 'i').test(tag);

const isResourceTag = (tag) =>
  /^<script\b/i.test(tag) || ['stylesheet', 'preload'].includes(attribute(tag, 'rel'));

for (const page of HTML_PAGES) {
  test(`${page} declares exactly one CSP meta with the exact policy before any resource`, () => {
    const html = readSite(page);
    const metas = tagsOf(html, 'meta').filter(
      (tag) => attribute(tag, 'http-equiv') === 'Content-Security-Policy',
    );
    assert.equal(metas.length, 1, page);
    assert.equal(attribute(metas[0], 'content'), CSP);
    assert.doesNotMatch(metas[0], /unsafe-/);
    const firstResource = html.match(/<(?:link|script)\b[^>]*>/gi).find(isResourceTag);
    assert.ok(html.indexOf(metas[0]) < html.indexOf(firstResource), page);
  });

  test(`${page} does not reference Google Fonts`, () => {
    assert.doesNotMatch(readSite(page), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  test(`${page} has no lazy static image (above-the-fold logo rule)`, () => {
    const lazy = tagsOf(readSite(page), 'img').filter(
      (tag) => attribute(tag, 'loading') === 'lazy',
    );
    assert.deepEqual(lazy, []);
  });

  test(`${page} preloads both self-hosted fonts with crossorigin`, () => {
    const preloads = tagsOf(readSite(page), 'link').filter(
      (tag) => attribute(tag, 'rel') === 'preload',
    );
    assert.equal(preloads.length, 2, page);
    FONT_FILES.forEach((font, index) => {
      const tag = preloads[index];
      assert.ok(attribute(tag, 'href').endsWith(`fonts/${font}`), tag);
      assert.equal(attribute(tag, 'as'), 'font', tag);
      assert.equal(attribute(tag, 'type'), 'font/woff2', tag);
      assert.ok(hasFlag(tag, 'crossorigin'), tag);
    });
  });
}

test('pokedex.css declares both fonts with font-display swap and existing files', () => {
  const css = readSite('css/pokedex.css');
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  assert.deepEqual(
    faces.map((face) => face.match(/font-family:\s*'([^']+)'/)[1]),
    ['Press Start 2P', 'VT323'],
  );
  faces.forEach((face, index) => {
    assert.match(face, /font-display:\s*swap;/);
    const url = face.match(/url\('([^']+)'\)/)[1];
    assert.equal(url, `../fonts/${FONT_FILES[index]}`);
    assert.ok(existsSync(join(SITE_DIR, 'css', url)), url);
  });
});

test('site/fonts/OFL.txt carries the SIL OFL 1.1 for both families', () => {
  const license = readSite('fonts/OFL.txt');
  assert.match(license, /SIL Open Font License, Version 1\.1/);
  assert.match(license, /Press Start 2P/);
  assert.match(license, /VT323/);
});

const INLINE_PATTERNS = {
  'style attribute': /\sstyle\s*=/i,
  'inline script': /<script(?![^>]*\ssrc\s*=)[^>]*>/i,
  'event handler attribute': /\son[a-z]+\s*=/i,
};
const inlineFindings = (html) =>
  Object.entries(INLINE_PATTERNS)
    .filter(([, pattern]) => pattern.test(html))
    .map(([name]) => name);

test('the inline guard detects style, inline scripts and handlers', () => {
  assert.deepEqual(inlineFindings('<div style="x">'), ['style attribute']);
  assert.deepEqual(inlineFindings('<script>alert(1)</script>'), ['inline script']);
  assert.deepEqual(inlineFindings('<img onerror="x">'), ['event handler attribute']);
});

test('the inline guard accepts external scripts and plain classes', () => {
  assert.deepEqual(inlineFindings('<script type="module" src="a.js"></script>'), []);
  assert.deepEqual(inlineFindings('<p class="one">'), []);
});

for (const page of HTML_PAGES) {
  test(`${page} has no inline styles, scripts or handlers`, () => {
    assert.deepEqual(inlineFindings(readSite(page)), [], page);
  });
}

const VIEWS = [
  ['pokedex', pokedexView, 'pokemon'],
  ['movimientos', movesView, 'move'],
  ['naturalezas', naturesView, 'nature'],
  ['objetos', itemsView, 'item'],
  ['bayas', berriesView, 'berry'],
  ['tipos', typesView, 'type'],
  ['habilidades', abilitiesView, 'ability'],
];
const fixtureItems = (section, fixture) => {
  const item = SECTIONS[section].mapper(
    JSON.parse(readSite(`js/mappers/fixtures/${fixture}.json`)),
  );
  const neutral = { ...item, id: item.id + 1, increasedStat: null, decreasedStat: null };
  return section === 'naturalezas' ? [item, neutral] : [item];
};

for (const [section, view, fixture] of VIEWS) {
  test(`the ${section} view renders no inline styles, scripts or handlers`, () => {
    const items = fixtureItems(section, fixture);
    const html = view.renderItems(items) + (view.renderOverlays?.(items) ?? '');
    assert.deepEqual(inlineFindings(html), [], `vista ${section}`);
  });
}
