import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { movesView } from './render-moves.js';
import { SECTIONS } from '../core/sections.js';

const thunderbolt = SECTIONS.movimientos.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/move.json'), 'utf8')),
);
const count = (html, fragment) => html.split(fragment).length - 1;
const stat = (label, value) =>
  new RegExp(
    `<span class="move-stat-label">${label}</span>\\s*<span class="move-stat-value">${value}</span>`,
  );

test('the moves view is titled MOVIMIENTOS and searchable', () => {
  assert.equal(movesView.title, 'MOVIMIENTOS');
  assert.equal(movesView.searchable, true);
});

test('N moves render N cards inside the grid', () => {
  const moves = [1, 2, 3].map((id) => ({ ...thunderbolt, id, name: `move-${id}` }));
  const html = movesView.renderItems(moves);
  assert.match(html, /^\s*<div class="moves-grid">/);
  assert.equal(count(html, 'class="move-card"'), 3);
  assert.equal(count(movesView.renderItems([]), 'class="move-card"'), 0);
});

test('a move card shows id, type badge, damage class and name', () => {
  const html = movesView.renderItems([thunderbolt]);
  assert.ok(html.includes('<span class="move-id">#85</span>'));
  assert.ok(html.includes('<span class="type-badge type-electric">ELECTRIC</span>'));
  assert.ok(html.includes('<span class="damage-class special">SPECIAL</span>'));
  assert.ok(html.includes('<h3 class="move-name">THUNDERBOLT</h3>'));
});

test('the stats are POW, ACC, PP and PRI in order with their values', () => {
  const html = movesView.renderItems([thunderbolt]);
  assert.match(html, stat('POW', '90'));
  assert.match(html, stat('ACC', '100'));
  assert.match(html, stat('PP', '15'));
  assert.match(html, stat('PRI', '0'));
  const labels = [...html.matchAll(/move-stat-label">([A-Z]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['POW', 'ACC', 'PP', 'PRI']);
});

test('null power and accuracy render an em dash', () => {
  const html = movesView.renderItems([{ ...thunderbolt, power: null, accuracy: null }]);
  assert.match(html, stat('POW', '—'));
  assert.match(html, stat('ACC', '—'));
});

test('a short effect renders as an escaped paragraph', () => {
  const html = movesView.renderItems([thunderbolt]);
  assert.ok(html.includes('<p class="move-effect">Has a chance to paralyze the target.</p>'));
});

for (const shortEffect of ['', null]) {
  test(`a short effect ${JSON.stringify(shortEffect)} renders no effect paragraph`, () => {
    assert.doesNotMatch(movesView.renderItems([{ ...thunderbolt, shortEffect }]), /move-effect/);
  });
}

test('malicious name and effect are escaped', () => {
  const evil = '<script>alert(1)</script>';
  const html = movesView.renderItems([{ ...thunderbolt, name: evil, shortEffect: evil }]);
  assert.ok(html.includes('<p class="move-effect">&lt;script&gt;alert(1)&lt;/script&gt;</p>'));
  assert.ok(html.includes('&lt;SCRIPT&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('consecutive move cards without effect have nothing but whitespace between them', () => {
  const html = movesView.renderItems([
    { ...thunderbolt, shortEffect: '' },
    { ...thunderbolt, id: 2, shortEffect: '' },
  ]);
  assert.match(
    html,
    /<span class="move-stat-value">0<\/span>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="move-card">/,
  );
});
