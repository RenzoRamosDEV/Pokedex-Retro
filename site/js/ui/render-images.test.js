import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pokedexView } from './render-pokedex.js';
import { itemsView } from './render-items.js';
import { naturesView } from './render-natures.js';
import { mapNature } from '../mappers/nature.js';
import { mapPokemon } from '../mappers/pokemon.js';
import { mapItem } from '../mappers/item.js';

const fixture = (name) =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../mappers/fixtures/${name}.json`), 'utf8'));
const pokemon = mapPokemon(fixture('pokemon'));
const item = mapItem(fixture('item'));
const imagesOf = (html) => html.match(/<img\b[^>]*>/g) ?? [];

function assertImageAttributes(tag, size) {
  assert.match(tag, new RegExp(`\\swidth="${size}"`), tag);
  assert.match(tag, new RegExp(`\\sheight="${size}"`), tag);
  assert.match(tag, /\sloading="lazy"/, tag);
  assert.match(tag, /\sdecoding="async"/, tag);
}

test('the Pokémon card image is 96x96, lazy and async', () => {
  const images = imagesOf(pokedexView.renderItems([pokemon]));
  assert.equal(images.length, 1);
  assertImageAttributes(images[0], 96);
  assert.match(images[0], /\sclass="card-sprite"/);
});

test('the Pokémon detail image is 96x96, lazy and async', () => {
  const images = imagesOf(pokedexView.renderOverlays([pokemon]));
  assert.equal(images.length, 1);
  assertImageAttributes(images[0], 96);
  assert.match(images[0], /\sclass="modal-sprite"/);
});

test('the shop item image is 30x30, lazy and async', () => {
  const images = imagesOf(itemsView.renderItems([item]));
  assert.equal(images.length, 1);
  assertImageAttributes(images[0], 30);
});

test('a Pokémon without sprite renders no image in card or detail', () => {
  const missing = { ...pokemon, sprite: null };
  assert.deepEqual(imagesOf(pokedexView.renderItems([missing])), []);
  assert.deepEqual(imagesOf(pokedexView.renderOverlays([missing])), []);
  assert.match(pokedexView.renderItems([missing]), /<div class="card-sprite-missing">\?<\/div>/);
  assert.match(
    pokedexView.renderOverlays([missing]),
    /<div class="modal-sprite-missing">\?<\/div>/,
  );
});

test('an item without sprite renders no image', () => {
  const html = itemsView.renderItems([{ ...item, sprite: null }]);
  assert.deepEqual(imagesOf(html), []);
  assert.match(html, /<span class="shop-sprite-missing">\?<\/span>/);
});

test('a base stat of 150 renders a bar with data-valor="100" and no style', () => {
  const strong = { ...pokemon, stats: [{ name: 'attack', baseStat: 150 }] };
  const html = pokedexView.renderOverlays([strong]);
  assert.match(html, /<div class="stat-bar-fill type-[a-z]+"\s+data-valor="100"><\/div>/);
  assert.doesNotMatch(html, /style=/);
});

test('a base stat of 45 renders data-valor="45"', () => {
  const html = pokedexView.renderOverlays([{ ...pokemon, stats: [{ name: 'hp', baseStat: 45 }] }]);
  assert.match(html, /data-valor="45"/);
});

test('nature accordion headers carry the acc-stat class of their group', () => {
  const adamant = mapNature(fixture('nature'));
  const hardy = { ...adamant, id: 1, name: 'hardy', increasedStat: null, decreasedStat: null };
  const html = naturesView.renderItems([adamant, hardy]);
  const headers = html.match(/<label for="acc-[^"]+" class="[^"]*"/g);
  assert.deepEqual(headers, [
    '<label for="acc-attack" class="acc-header acc-stat-attack"',
    '<label for="acc-defense" class="acc-header acc-stat-defense"',
    '<label for="acc-special-attack" class="acc-header acc-stat-special-attack"',
    '<label for="acc-special-defense" class="acc-header acc-stat-special-defense"',
    '<label for="acc-speed" class="acc-header acc-stat-speed"',
    '<label for="acc-neutral" class="acc-header acc-stat-neutral"',
  ]);
  assert.doesNotMatch(html, /style=/);
});
