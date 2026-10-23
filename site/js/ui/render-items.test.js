import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemsView } from './render-items.js';
import { SECTIONS } from '../core/sections.js';

const masterBall = SECTIONS.objetos.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/item.json'), 'utf8')),
);
const count = (html, fragment) => html.split(fragment).length - 1;

test('the items view is titled OBJETOS and searchable', () => {
  assert.equal(itemsView.title, 'OBJETOS');
  assert.equal(itemsView.searchable, true);
});

test('the table has the OBJETO, CATEGORÍA, PRECIO and EFECTO headers', () => {
  const headers = [...itemsView.renderItems([]).matchAll(/<th class="([a-z-]+)">([^<]*)<\/th>/g)];
  assert.deepEqual(
    headers.map((m) => [m[1], m[2]]),
    [
      ['shop-th-sprite', ''],
      ['shop-th-name', 'OBJETO'],
      ['shop-th-cat', 'CATEGORÍA'],
      ['shop-th-price', 'PRECIO'],
      ['shop-th-effect', 'EFECTO'],
    ],
  );
});

test('N items render N shop rows', () => {
  const items = [1, 2, 3].map((id) => ({ ...masterBall, id, name: `item-${id}` }));
  assert.equal(count(itemsView.renderItems(items), 'class="shop-row"'), 3);
  assert.equal(count(itemsView.renderItems([]), 'class="shop-row"'), 0);
});

test('a row shows id, name and category', () => {
  const html = itemsView.renderItems([masterBall]);
  assert.ok(html.includes('<span class="shop-item-id">#1</span>'));
  assert.ok(html.includes('<span class="shop-item-name">MASTER-BALL</span>'));
  assert.ok(html.includes('<span class="shop-item-cat">STANDARD-BALLS</span>'));
});

test('a sprite renders an image with the name as alt', () => {
  const html = itemsView.renderItems([masterBall]);
  assert.ok(html.includes(`<img src="${masterBall.sprite}" alt="master-ball" class="shop-sprite"`));
});

test('a missing sprite renders the placeholder', () => {
  const html = itemsView.renderItems([{ ...masterBall, sprite: null }]);
  assert.ok(html.includes('<span class="shop-sprite-missing">?</span>'));
});

for (const cost of [null, 0]) {
  test(`a cost of ${cost} renders the free price`, () => {
    const html = itemsView.renderItems([{ ...masterBall, cost }]);
    assert.ok(html.includes('<span class="shop-price shop-price-free">—</span>'));
  });
}

test('a cost renders the amount in ₽', () => {
  const html = itemsView.renderItems([{ ...masterBall, cost: 200 }]);
  assert.ok(html.includes('<span class="shop-price">200 ₽</span>'));
  assert.doesNotMatch(html, /shop-price-free/);
});

test('a short effect renders as text', () => {
  const html = itemsView.renderItems([masterBall]);
  assert.ok(html.includes('<span class="shop-effect">Catches a wild Pokémon every time.</span>'));
  assert.doesNotMatch(html, /shop-effect-empty/);
});

test('a null short effect renders the empty effect', () => {
  const html = itemsView.renderItems([{ ...masterBall, shortEffect: null }]);
  assert.ok(html.includes('<span class="shop-effect shop-effect-empty">—</span>'));
});

test('malicious name and effect are escaped', () => {
  const evil = '<script>alert(1)</script>';
  const html = itemsView.renderItems([{ ...masterBall, name: evil, shortEffect: evil }]);
  assert.ok(
    html.includes('<span class="shop-effect">&lt;script&gt;alert(1)&lt;/script&gt;</span>'),
  );
  assert.ok(html.includes('alt="&lt;script&gt;alert(1)&lt;/script&gt;"'));
  assert.doesNotMatch(html, /<script/i);
});

test('consecutive shop rows have nothing but whitespace between them', () => {
  const html = itemsView.renderItems([masterBall, { ...masterBall, id: 2 }]);
  assert.match(html, /<\/tr>\s*<tr class="shop-row">/);
});

test('the scrollable shop table is a focusable region named OBJETOS', () => {
  assert.ok(
    itemsView
      .renderItems([masterBall])
      .includes('<div class="shop-wrap" tabindex="0" role="region" aria-label="OBJETOS">'),
  );
});
