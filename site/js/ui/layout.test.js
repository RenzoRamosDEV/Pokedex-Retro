import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyStatBarWidths,
  pageHeader,
  paginationNav,
  sectionBody,
  statusText,
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

for (const [label, result, text] of [
  ['an error', { status: 'error' }, STRINGS.comun.errorCarga],
  ['an empty result without failures', okResult([], 0), 'SIN RESULTADOS'],
  ['0 items and 18 failures', okResult([], 18), '18 ELEMENTOS NO SE PUDIERON CARGAR'],
  ['16 items and 2 failures', okResult(pokemons(16), 2), '2 ELEMENTOS NO SE PUDIERON CARGAR'],
  ['1 item and 1 failure', okResult(pokemons(1), 1), '1 ELEMENTO NO SE PUDO CARGAR'],
  ['2 items without failures', okResult(pokemons(2), 0), ''],
]) {
  test(`statusText of ${label} is "${text}"`, () => {
    assert.equal(statusText(result), text);
  });
}

test('the load error text is the one of STRINGS', () => {
  assert.equal(
    statusText({ status: 'error' }),
    'No se pudieron cargar los datos. Inténtalo de nuevo más tarde.',
  );
});

test('sectionBody of 16 Pokémon renders 16 cards and no status paragraph', () => {
  const html = sectionBody(pokedexView, okResult(pokemons(16), 2));
  assert.equal(count(html, 'class="poke-card"'), 16);
  assert.doesNotMatch(html, /role="status"|ELEMENTOS NO SE PUDIERON/);
});

for (const [label, result] of [
  ['an error', { status: 'error' }],
  ['an empty result', okResult([], 0)],
  ['a result where every detail failed', okResult([], 18)],
]) {
  test(`sectionBody of ${label} is empty`, () => {
    assert.equal(sectionBody(pokedexView, result), '');
  });
}

test('sectionBody renders items and overlays', () => {
  const html = sectionBody(pokedexView, okResult(pokemons(2), 0));
  assert.equal(count(html, 'class="poke-card"'), 2);
  assert.equal(count(html, 'class="modal"'), 2);
  assert.ok(html.indexOf('class="poke-card"') < html.indexOf('class="modal"'));
});

test('sectionBody renders the pagination after the items when there are several pages', () => {
  const html = sectionBody(pokedexView, { ...okResult(pokemons(1), 0), totalPages: 3 });
  assert.match(html, /<nav class="pagination">[\s\S]*1 \/ 3/);
  assert.ok(html.indexOf('class="poke-card"') < html.indexOf('class="pagination"'));
  assert.ok(html.indexOf('class="pagination"') < html.indexOf('class="modal"'));
});

test('sectionBody of a view without overlays renders only items and pagination', () => {
  const view = { renderItems: (items) => `<ul>${items.length}</ul>` };
  assert.equal(sectionBody(view, okResult([{ id: 1 }], 0)), '<ul>1</ul>');
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
      <input class="search-input" type="text" name="q" placeholder="BUSCAR..." aria-label="Buscar por nombre" value="" autocomplete="off">
      <button class="search-btn" type="submit" aria-label="Buscar">▶</button>
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
