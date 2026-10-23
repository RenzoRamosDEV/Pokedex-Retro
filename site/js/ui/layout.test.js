import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyStatBarWidths,
  failedNotice,
  pageHeader,
  paginationNav,
  sectionContent,
  upper,
} from './layout.js';
import { pokedexView } from './render-pokedex.js';
import { mapPokemon } from '../mappers/pokemon.js';
import { STRINGS } from './strings.js';
import { paginationLinks } from '../core/pagination.js';

const fixturePokemon = mapPokemon(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/pokemon.json'), 'utf8')),
);
const pokemons = (count) =>
  Array.from({ length: count }, (_, i) => ({ ...fixturePokemon, id: i + 1 }));
const okResult = (items, failedCount) => ({
  status: 'ok',
  items,
  page: 1,
  totalPages: 1,
  rawQuery: null,
  failedCount,
});
const count = (html, fragment) => html.split(fragment).length - 1;

test('failedNotice(0) is empty', () => {
  assert.equal(failedNotice(0), '');
});

for (const [failed, text] of [
  [1, '1 ELEMENTO NO SE PUDO CARGAR'],
  [2, '2 ELEMENTOS NO SE PUDIERON CARGAR'],
  [18, '18 ELEMENTOS NO SE PUDIERON CARGAR'],
]) {
  test(`failedNotice(${failed}) is a status paragraph with "${text}"`, () => {
    assert.equal(failedNotice(failed), `<p class="page-info" role="status">${text}</p>`);
  });
}

test('partial failures: 16 of 18 Pokémon render as cards with the notice', () => {
  const html = sectionContent(pokedexView, okResult(pokemons(16), 2));
  assert.equal(count(html, 'class="poke-card"'), 16);
  assert.equal(count(html, '2 ELEMENTOS NO SE PUDIERON CARGAR'), 1);
  assert.ok(html.indexOf('role="status"') < html.indexOf('class="poke-card"'));
});

test('every detail failing shows only the notice, not SIN RESULTADOS', () => {
  const html = sectionContent(pokedexView, okResult([], 18));
  assert.equal(html, failedNotice(18));
});

test('an empty result without failures shows SIN RESULTADOS and no notice', () => {
  const html = sectionContent(pokedexView, okResult([], 0));
  assert.equal(html, `<p class="page-info">${STRINGS.comun.sinResultados}</p>`);
});

test('an error result shows the load error message', () => {
  const html = sectionContent(pokedexView, { status: 'error' });
  assert.equal(html, `<p class="page-info">${STRINGS.comun.errorCarga}</p>`);
});

test('a result without failures has no status notice but has items and overlays', () => {
  const html = sectionContent(pokedexView, okResult(pokemons(2), 0));
  assert.doesNotMatch(html, /role="status"/);
  assert.equal(count(html, 'class="poke-card"'), 2);
  assert.equal(count(html, 'class="modal"'), 2);
});

test('pagination is rendered after the items when there are several pages', () => {
  const html = sectionContent(pokedexView, { ...okResult(pokemons(1), 0), totalPages: 3 });
  assert.match(html, /<nav class="pagination">[\s\S]*1 \/ 3/);
  assert.ok(html.indexOf('class="poke-card"') < html.indexOf('class="pagination"'));
});

test('a view without overlays renders only items and pagination', () => {
  const view = { renderItems: (items) => `<ul>${items.length}</ul>` };
  assert.equal(sectionContent(view, okResult([{ id: 1 }], 0)), '<ul>1</ul>');
});

test('pageHeader of a searchable view has the title and an escaped search value', () => {
  const html = pageHeader('POKEDEX', true, '"char"');
  assert.match(html, /<h2 class="page-title">POKEDEX<\/h2>/);
  assert.match(html, /<form class="search-form" method="GET">/);
  assert.match(html, /value="&quot;char&quot;"/);
  assert.ok(html.includes(`placeholder="${STRINGS.comun.buscar}"`));
});

test('pageHeader of a non-searchable view has only the escaped title', () => {
  assert.equal(
    pageHeader('<TIPOS>', false, 'x'),
    `
  <div class="page-header">
    <h2 class="page-title">&lt;TIPOS&gt;</h2>
  </div>`,
  );
});

test('paginationNav without links is empty', () => {
  assert.equal(paginationNav(null), '');
});

for (const [label, prevHref, nextHref] of [
  ['first page', null, '?page=2'],
  ['last page', '?page=2', null],
]) {
  test(`paginationNav on the ${label} disables only the missing direction`, () => {
    const html = paginationNav({ page: 2, total: 3, prevHref, nextHref });
    const prev = prevHref
      ? `<a href="${prevHref}" class="page-btn">${STRINGS.comun.anterior}</a>`
      : `<span class="page-btn disabled">${STRINGS.comun.anterior}</span>`;
    const next = nextHref
      ? `<a href="${nextHref}" class="page-btn">${STRINGS.comun.siguiente}</a>`
      : `<span class="page-btn disabled">${STRINGS.comun.siguiente}</span>`;
    assert.ok(html.includes(prev), prev);
    assert.ok(html.includes(next), next);
    assert.match(html, /<span class="page-info">2 \/ 3<\/span>/);
  });
}

test('upper turns any value into escaped upper case text', () => {
  assert.equal(upper('mr-mime <x>'), 'MR-MIME &lt;X&gt;');
  assert.equal(upper(7), '7');
  assert.equal(upper(0), '0');
  assert.equal(upper(null), 'NULL');
});

const PREV_LINK = (href) => `<a href="${href}" class="page-btn">◀ ANT.</a>`;
const NEXT_LINK = (href) => `<a href="${href}" class="page-btn">SIG. ▶</a>`;
const PREV_OFF = '<span class="page-btn disabled">◀ ANT.</span>';
const NEXT_OFF = '<span class="page-btn disabled">SIG. ▶</span>';

for (const [label, page, total, rawQuery, prev, next] of [
  ['first of 3', 1, 3, null, PREV_OFF, NEXT_LINK('?page=2')],
  ['middle of 3', 2, 3, null, PREV_LINK('?page=1'), NEXT_LINK('?page=3')],
  ['last of 3', 3, 3, null, PREV_LINK('?page=2'), NEXT_OFF],
  [
    'middle of 3 with query',
    2,
    3,
    'mr mime',
    PREV_LINK('?page=1&amp;q=mr%20mime'),
    NEXT_LINK('?page=3&amp;q=mr%20mime'),
  ],
]) {
  test(`paginationNav on the ${label} renders the exact navigation`, () => {
    assert.equal(
      paginationNav(paginationLinks(page, total, rawQuery)),
      `
  <nav class="pagination">
    ${prev}
    <span class="page-info">${page} / ${total}</span>
    ${next}
  </nav>`,
    );
  });
}

test('paginationNav on a single page renders nothing', () => {
  assert.equal(paginationNav(paginationLinks(1, 1, null)), '');
});

test('pageHeader escapes a search value that tries to break out of the attribute', () => {
  const html = pageHeader('POKEDEX', true, '"><script>alert(1)</script>');
  assert.ok(html.includes('value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  assert.doesNotMatch(html, /<script/i);
});

test('pageHeader of a searchable view renders the exact search form', () => {
  assert.equal(
    pageHeader('POKEDEX', true, ''),
    `
  <div class="page-header">
    <h2 class="page-title">POKEDEX</h2>
    <form class="search-form" method="GET">
      <input class="search-input" type="text" name="q" placeholder="BUSCAR..." value="" autocomplete="off">
      <button class="search-btn" type="submit">▶</button>
    </form>
  </div>`,
  );
});

function fakeElement(dataset) {
  const properties = [];
  return { dataset, properties, style: { setProperty: (...args) => properties.push(args) } };
}

test('applyStatBarWidths sets --ancho from data-valor on every bar of the root', () => {
  const bars = [fakeElement({ valor: '45' }), fakeElement({ valor: '100' })];
  const root = {
    querySelectorAll: (selector) => (selector === '[data-valor]' ? bars : []),
  };
  applyStatBarWidths(root);
  assert.deepEqual(
    bars.map((bar) => bar.properties),
    [[['--ancho', '45%']], [['--ancho', '100%']]],
  );
});

test('applyStatBarWidths leaves the root untouched when there are no bars', () => {
  const root = { querySelectorAll: () => [] };
  assert.doesNotThrow(() => applyStatBarWidths(root));
});
