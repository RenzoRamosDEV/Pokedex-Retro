import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pokedexView } from './render-pokedex.js';
import { itemsView } from './render-items.js';
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
