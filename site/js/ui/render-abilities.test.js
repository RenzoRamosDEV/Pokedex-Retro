import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { abilitiesView } from './render-abilities.js';
import { SECTIONS } from '../core/sections.js';

const stench = SECTIONS.habilidades.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/ability.json'), 'utf8')),
);
const count = (html, fragment) => html.split(fragment).length - 1;

test('the abilities view is titled HABILIDADES and searchable', () => {
  assert.equal(abilitiesView.title, 'HABILIDADES');
  assert.equal(abilitiesView.searchable, true);
});

test('N abilities render N cards inside the list', () => {
  const abilities = [1, 2, 3].map((id) => ({ ...stench, id, name: `ability-${id}` }));
  const html = abilitiesView.renderItems(abilities);
  assert.match(html, /^\s*<div class="abilities-list">/);
  assert.equal(count(html, 'class="ability-card"'), 3);
});

test('an ability card shows id, name, Pokémon count and effect', () => {
  const html = abilitiesView.renderItems([stench]);
  assert.ok(html.includes('<span class="ability-id">#1</span>'));
  assert.ok(html.includes('<h3 class="ability-card-name">STENCH</h3>'));
  assert.ok(html.includes('<span class="ability-pokemon-count">10 POKEMON</span>'));
  assert.ok(
    html.includes(
      '<p class="ability-card-effect">Has a 10% chance of making target Pokémon flinch with each hit.</p>',
    ),
  );
});

test('malicious name and effect are escaped', () => {
  const evil = '<script>alert(1)</script>';
  const html = abilitiesView.renderItems([{ ...stench, name: evil, shortEffect: evil }]);
  assert.ok(
    html.includes('<p class="ability-card-effect">&lt;script&gt;alert(1)&lt;/script&gt;</p>'),
  );
  assert.ok(html.includes('&lt;SCRIPT&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('consecutive ability cards have nothing but whitespace between them', () => {
  const html = abilitiesView.renderItems([stench, { ...stench, id: 2 }]);
  assert.match(html, /<\/p>\s*<\/div>\s*<\/div>\s*<div class="ability-card">/);
});
