import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typesView } from './render-types.js';
import { SECTIONS } from '../core/sections.js';

const ghost = SECTIONS.tipos.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/type.json'), 'utf8')),
);
const plain = (name) => ({
  ...ghost,
  name,
  doubleDamageTo: [],
  halfDamageTo: [],
  noDamageTo: [],
});
const types = [ghost, plain('normal'), plain('dark'), plain('psychic')];
const count = (html, fragment) => html.split(fragment).length - 1;
const ghostRow = (html) => {
  const start = html.indexOf('<td class="matrix-row-header">');
  return html.slice(start, html.indexOf('</tr>', start));
};

test('the types view is titled TABLA DE TIPOS and not searchable', () => {
  assert.equal(typesView.title, 'TABLA DE TIPOS');
  assert.equal(typesView.searchable, false);
});

test('N types render N rows and N column headers after the corner', () => {
  const html = typesView.renderItems(types);
  assert.equal(count(html, '<td class="matrix-row-header">'), 4);
  assert.equal(count(html, '<th class="matrix-col-header">'), 4);
  assert.equal(count(html, 'class="matrix-cell '), 16);
  assert.ok(html.includes('<th class="matrix-corner">ATK ╲ DEF</th>'));
  assert.ok(
    html.includes(
      '<th class="matrix-col-header"><span class="type-badge type-ghost">GHOST</span></th>',
    ),
  );
});

test('each cell carries the effectiveness class and symbol of attacker on defender', () => {
  const cells = [
    ...ghostRow(typesView.renderItems(types)).matchAll(
      /<td class="matrix-cell (eff-[a-z0-9]+-cell)">([^<]*)<\/td>/g,
    ),
  ];
  assert.deepEqual(
    cells.map((m) => [m[1], m[2]]),
    [
      ['eff-2x-cell', '×2'],
      ['eff-0-cell', '✕'],
      ['eff-half-cell', '½'],
      ['eff-2x-cell', '×2'],
    ],
  );
});

test('a neutral matchup renders an empty eff-1-cell', () => {
  const html = typesView.renderItems([plain('fire')]);
  assert.ok(html.includes('<td class="matrix-cell eff-1-cell"></td>'));
});

test('the legend lists the four effectiveness classes with their labels', () => {
  const html = typesView.renderItems([]);
  const legend = [
    ...html.matchAll(
      /<span class="matrix-legend-item (eff-[a-z0-9]+-cell)">([^<]+)<\/span>\s*<span class="matrix-legend-label">([^<]+)<\/span>/g,
    ),
  ];
  assert.deepEqual(
    legend.map((m) => [m[1], m[2], m[3]]),
    [
      ['eff-2x-cell', '×2', 'Súper efectivo'],
      ['eff-half-cell', '½', 'No muy efectivo'],
      ['eff-0-cell', '✕', 'Inmune'],
      ['eff-1-cell', '—', 'Normal'],
    ],
  );
});

test('a malicious type name is escaped', () => {
  const html = typesView.renderItems([plain('<script>alert(1)</script>')]);
  assert.ok(html.includes('type-&lt;script&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('consecutive cells, column headers and rows have only whitespace between them', () => {
  const html = typesView.renderItems(types);
  assert.equal(html.match(/<\/td><td class="matrix-cell /g).length, 12);
  assert.equal(html.match(/<\/th><th class="matrix-col-header">/g).length, 3);
  assert.equal(html.match(/<\/tr>\s*<tr>/g).length, 3);
});

test('the scrollable matrix is a focusable region named TABLA DE TIPOS', () => {
  assert.ok(
    typesView
      .renderItems(types)
      .includes(
        '<div class="matrix-scroll" tabindex="0" role="region" aria-label="TABLA DE TIPOS">',
      ),
  );
});
