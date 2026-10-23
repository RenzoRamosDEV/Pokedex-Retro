import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pokedexView } from './render-pokedex.js';
import { SECTIONS } from '../core/sections.js';
import { STRINGS } from './strings.js';

const gengar = SECTIONS.pokedex.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/pokemon.json'), 'utf8')),
);
const pokemons = (count) =>
  Array.from({ length: count }, (_, i) => ({ ...gengar, id: i + 1, name: `poke-${i + 1}` }));
const count = (html, fragment) => html.split(fragment).length - 1;
const render = (list) => pokedexView.renderItems(list) + pokedexView.renderOverlays(list);
const MALICIOUS = '<script>alert(1)</script>';

test('the Pokédex view is titled POKEDEX and searchable', () => {
  assert.equal(pokedexView.title, 'POKEDEX');
  assert.equal(pokedexView.searchable, true);
});

test('18 Pokémon render 18 card links, 18 cards and 18 details with unique ids', () => {
  const items = pokedexView.renderItems(pokemons(18));
  const overlays = pokedexView.renderOverlays(pokemons(18));
  assert.equal(count(items, 'class="card-link"'), 18);
  assert.equal(count(items, 'class="poke-card"'), 18);
  const ids = [...overlays.matchAll(/<(?:div|dialog) id="(pokemon-\d+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, 18);
  assert.equal(ids[0], 'pokemon-1');
  assert.equal(ids[17], 'pokemon-18');
});

test('an empty list renders an empty grid and no details', () => {
  assert.equal(count(pokedexView.renderItems([]), 'class="card-link"'), 0);
  assert.match(pokedexView.renderItems([]), /<div class="pokedex-grid">/);
  assert.equal(pokedexView.renderOverlays([]), '');
});

test('a card links to its detail and shows number and upper-case name', () => {
  const html = pokedexView.renderItems([gengar]);
  assert.ok(html.includes('<a href="#pokemon-94" class="card-link"'));
  assert.ok(html.includes('<span class="card-number">#94</span>'));
  assert.ok(html.includes('<h2 class="card-name">GENGAR</h2>'));
});

test('the card aria-label is "Ver detalles de" plus the escaped name', () => {
  const html = pokedexView.renderItems([{ ...gengar, name: 'a"b' }]);
  assert.ok(html.includes(`aria-label="${STRINGS.pokedex.verDetalles} a&quot;b"`));
  assert.ok(html.includes('aria-label="Ver detalles de a&quot;b"'));
});

test('a malicious name is escaped in card and detail', () => {
  const html = render([{ ...gengar, name: MALICIOUS }]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('type badges follow slot order in card and detail', () => {
  const swapped = {
    ...gengar,
    types: [
      { slot: 2, typeName: 'poison' },
      { slot: 1, typeName: 'ghost' },
    ],
  };
  const badges = (html) => [
    ...html.matchAll(/<span class="type-badge type-([a-z]+)">([A-Z]+)<\/span>/g),
  ];
  for (const html of [pokedexView.renderItems([swapped]), pokedexView.renderOverlays([swapped])]) {
    assert.deepEqual(
      badges(html).map((m) => [m[1], m[2]]),
      [
        ['ghost', 'GHOST'],
        ['poison', 'POISON'],
      ],
    );
  }
  assert.ok(
    pokedexView
      .renderItems([swapped])
      .includes(
        '<span class="type-badge type-ghost">GHOST</span>\n<span class="type-badge type-poison">POISON</span>',
      ),
  );
});

test('a sprite renders an image with escaped src and the name as alt', () => {
  const html = render([gengar]);
  assert.ok(
    html.includes(
      `<img src="${gengar.sprite}" alt="gengar" class="card-sprite" width="96" height="96" loading="lazy" decoding="async">`,
    ),
  );
  assert.ok(html.includes('class="modal-sprite"'));
  assert.doesNotMatch(html, /sprite-missing/);
});

test('a missing sprite renders the placeholders in card and detail', () => {
  const html = render([{ ...gengar, sprite: null }]);
  assert.ok(html.includes('<div class="card-sprite-missing">?</div>'));
  assert.ok(html.includes('<div class="modal-sprite-missing">?</div>'));
});

test('the detail shows number, name, data labels and values', () => {
  const html = pokedexView.renderOverlays([gengar]);
  assert.ok(html.includes('<span class="modal-number">#94</span>'));
  assert.ok(html.includes('<h2 class="modal-name">GENGAR</h2>'));
  assert.ok(html.includes('<h3 class="section-title">INFO</h3>'));
  assert.ok(html.includes('<td class="data-label">HEIGHT</td>'));
  assert.ok(html.includes('<td class="data-value">1.5 m</td>'));
  assert.ok(html.includes('<td class="data-label">WEIGHT</td>'));
  assert.ok(html.includes('<td class="data-value">40.5 kg</td>'));
  assert.ok(html.includes('<td class="data-label">BASE EXP</td>'));
  assert.ok(html.includes('<td class="data-value">225</td>'));
  assert.ok(html.includes('<h3 class="section-title">ABILITIES</h3>'));
  assert.ok(html.includes('<h3 class="section-title">BASE STATS</h3>'));
});

test('a null base experience renders an em dash', () => {
  const html = pokedexView.renderOverlays([{ ...gengar, baseExperience: null }]);
  assert.ok(html.includes('<td class="data-value">—</td>'));
});

test('abilities are listed by slot; a hidden one carries the hidden class and OCULTA', () => {
  const html = pokedexView.renderOverlays([
    {
      ...gengar,
      abilities: [
        { name: 'cursed-body', isHidden: true, slot: 3 },
        { name: 'levitate', isHidden: false, slot: 1 },
      ],
    },
  ]);
  const items = [
    ...html.matchAll(/<li class="(ability-item[^"]*)">\s*([A-Z-]+)\s*(.*?)\s*<\/li>/gs),
  ];
  assert.deepEqual(
    items.map((m) => [m[1], m[2], m[3]]),
    [
      ['ability-item', 'LEVITATE', ''],
      ['ability-item hidden', 'CURSED-BODY', '<span class="hidden-tag">OCULTA</span>'],
    ],
  );
});

test('each base stat renders a row with label, value and a bar of the primary type', () => {
  const html = pokedexView.renderOverlays([gengar]);
  assert.equal(count(html, 'class="stat-row"'), 6);
  assert.ok(html.includes('<span class="stat-label">SPECIAL-ATTACK</span>'));
  assert.ok(html.includes('<span class="stat-value">130</span>'));
  assert.match(html, /<div class="stat-bar-fill type-ghost"\s+data-valor="100"><\/div>/);
  assert.match(html, /<div class="stat-bar-fill type-ghost"\s+data-valor="60"><\/div>/);
});

test('the detail close controls use the Cerrar label', () => {
  const html = pokedexView.renderOverlays([gengar]);
  assert.ok(html.includes(`aria-label="${STRINGS.pokedex.cerrar}">✕<`));
});

test('consecutive cards, details, ability items and stat rows have only whitespace between them', () => {
  const two = [
    { ...gengar, abilities: [...gengar.abilities, { name: 'levitate', isHidden: true, slot: 3 }] },
    { ...gengar, id: 95 },
  ];
  const items = pokedexView.renderItems(two);
  const overlays = pokedexView.renderOverlays(two);
  assert.match(items, /<\/a>\s*<a href="#pokemon-95"/);
  assert.match(overlays, /<\/(?:div|dialog)>\s*<(?:div|dialog) id="pokemon-95"/);
  assert.match(overlays, /<\/li>\s*<li class="ability-item hidden">/);
  assert.equal(overlays.match(/<\/div>\s*<div class="stat-row">/g).length, 10);
});
