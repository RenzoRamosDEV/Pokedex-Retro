import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { berriesView } from './render-berries.js';
import { SECTIONS } from '../core/sections.js';

const cheri = SECTIONS.bayas.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/berry.json'), 'utf8')),
);
const count = (html, fragment) => html.split(fragment).length - 1;
const stat = (label, value) =>
  new RegExp(
    `<span class="berry-stat-label">${label}</span>\\s*<span class="berry-stat-value">${value}</span>`,
  );

test('the berries view is titled BAYAS and searchable', () => {
  assert.equal(berriesView.title, 'BAYAS');
  assert.equal(berriesView.searchable, true);
});

test('N berries render N cards inside the grid', () => {
  const berries = [1, 2].map((id) => ({ ...cheri, id, name: `berry-${id}` }));
  const html = berriesView.renderItems(berries);
  assert.match(html, /^\s*<div class="berries-grid">/);
  assert.equal(count(html, 'class="berry-card"'), 2);
});

test('a berry card shows id, natural gift type and name with BERRY', () => {
  const html = berriesView.renderItems([cheri]);
  assert.ok(html.includes('<span class="berry-id">#1</span>'));
  assert.ok(html.includes('<span class="type-badge type-fire">FIRE</span>'));
  assert.ok(html.includes('<h3 class="berry-name">CHERI BERRY</h3>'));
});

test('the stats show growth hours, x harvest, power, smoothness and firmness', () => {
  const html = berriesView.renderItems([cheri]);
  assert.match(html, stat('CRECIM.', '3 H'));
  assert.match(html, stat('COSECHA', 'x5'));
  assert.match(html, stat('POD.NAT.', '60'));
  assert.match(html, stat('SUAVIDAD', '25'));
  assert.match(html, stat('FIRMEZA', 'SOFT'));
});

test('only flavors with potency above 0 are shown', () => {
  const html = berriesView.renderItems([
    {
      ...cheri,
      flavors: [
        { potency: 10, flavor: 'spicy' },
        { potency: 0, flavor: 'dry' },
        { potency: 1, flavor: 'sour' },
      ],
    },
  ]);
  assert.ok(
    html.includes(
      '<div class="berry-flavors"><span class="berry-flavor flavor-spicy">SPICY 10</span>\n<span class="berry-flavor flavor-sour">SOUR 1</span></div>',
    ),
  );
  assert.doesNotMatch(html, /flavor-dry/);
});

for (const [label, flavors] of [
  ['no flavors', []],
  ['only zero potency flavors', [{ potency: 0, flavor: 'dry' }]],
]) {
  test(`a berry with ${label} renders no flavors block`, () => {
    assert.doesNotMatch(berriesView.renderItems([{ ...cheri, flavors }]), /berry-flavors/);
  });
}

test('malicious values are escaped', () => {
  const evil = '<script>alert(1)</script>';
  const html = berriesView.renderItems([
    {
      ...cheri,
      name: evil,
      growthTime: evil,
      maxHarvest: evil,
      naturalGiftPower: evil,
      smoothness: evil,
      firmness: evil,
      flavors: [{ potency: evil, flavor: 'spicy' }],
    },
  ]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('consecutive berry cards without flavors have nothing but whitespace after their stats', () => {
  const html = berriesView.renderItems([
    { ...cheri, flavors: [] },
    { ...cheri, id: 2, flavors: [] },
  ]);
  assert.match(
    html,
    /<span class="berry-stat-value">SOFT<\/span>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="berry-card">/,
  );
});
