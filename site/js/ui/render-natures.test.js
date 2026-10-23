import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { naturesView } from './render-natures.js';
import { SECTIONS } from '../core/sections.js';

const adamant = SECTIONS.naturalezas.mapper(
  JSON.parse(readFileSync(join(import.meta.dirname, '../mappers/fixtures/nature.json'), 'utf8')),
);
const neutral = (id, name) => ({ ...adamant, id, name, increasedStat: null, decreasedStat: null });
const count = (html, fragment) => html.split(fragment).length - 1;
const sectionOf = (html, stat) => {
  const start = html.indexOf(`<input type="checkbox" id="acc-${stat}"`);
  const end = html.indexOf('<div class="acc-section">', start);
  return html.slice(start, end === -1 ? undefined : end);
};

test('the natures view is titled NATURALEZAS and not searchable', () => {
  assert.equal(naturesView.title, 'NATURALEZAS');
  assert.equal(naturesView.searchable, false);
});

test('the five stat sections render in order with only attack checked', () => {
  const html = naturesView.renderItems([adamant]);
  const toggles = [
    ...html.matchAll(/<input type="checkbox" id="acc-([a-z-]+)" class="acc-toggle"( checked)?>/g),
  ];
  assert.deepEqual(
    toggles.map((m) => [m[1], Boolean(m[2])]),
    [
      ['attack', true],
      ['defense', false],
      ['special-attack', false],
      ['special-defense', false],
      ['speed', false],
    ],
  );
  assert.ok(html.includes('<label for="acc-attack" class="acc-header acc-stat-attack">'));
  assert.ok(html.includes('<span class="acc-stat-name">ATK</span>'));
  assert.match(html, /^\s*<div class="stat-accordion">/);
});

test('counts show how many natures raise and lower each stat', () => {
  const brave = { ...adamant, id: 2, name: 'brave', decreasedStat: 'speed' };
  const html = naturesView.renderItems([adamant, brave]);
  const attack = sectionOf(html, 'attack');
  assert.ok(attack.includes('<span class="acc-count-up">↑ 2</span>'));
  assert.ok(attack.includes('<span class="acc-count-down">↓ 0</span>'));
  const speed = sectionOf(html, 'speed');
  assert.ok(speed.includes('<span class="acc-count-up">↑ 0</span>'));
  assert.ok(speed.includes('<span class="acc-count-down">↓ 1</span>'));
});

test('raising and lowering columns use SUBE and BAJA and name the opposite stat', () => {
  const html = naturesView.renderItems([adamant]);
  const attack = sectionOf(html, 'attack');
  assert.ok(attack.includes('<div class="acc-col-header">↑ SUBE ATK</div>'));
  assert.ok(attack.includes('<div class="acc-col-header">↓ BAJA ATK</div>'));
  assert.match(
    attack,
    /<span class="acc-nature-name">ADAMANT<\/span>\s*<span class="acc-nature-sub">↓ SPECIAL-ATTACK<\/span>/,
  );
  const spAttack = sectionOf(html, 'special-attack');
  assert.match(
    spAttack,
    /<span class="acc-nature-name">ADAMANT<\/span>\s*<span class="acc-nature-sub">↑ ATTACK<\/span>/,
  );
});

test('a nature without opposite stat names an em dash', () => {
  const odd = { ...adamant, decreasedStat: null };
  const attack = sectionOf(naturesView.renderItems([odd]), 'attack');
  assert.ok(attack.includes('<span class="acc-nature-sub">↓ —</span>'));
});

test('without neutral natures there is no neutral section', () => {
  const html = naturesView.renderItems([adamant]);
  assert.doesNotMatch(html, /acc-neutral|NEUTRAL|SIN CAMBIO DE STATS/);
});

test('neutral natures render a collapsed section split in two columns', () => {
  const html = naturesView.renderItems([
    adamant,
    neutral(1, 'hardy'),
    neutral(6, 'docile'),
    neutral(13, 'serious'),
  ]);
  const section = html.slice(html.indexOf('id="acc-neutral"'));
  assert.ok(html.includes('<input type="checkbox" id="acc-neutral" class="acc-toggle">'));
  assert.ok(section.includes('<label for="acc-neutral" class="acc-header acc-stat-neutral">'));
  assert.ok(section.includes('<span class="acc-stat-name">NEUTRAL</span>'));
  assert.ok(section.includes('<span class="acc-count-up">3 naturales</span>'));
  assert.equal(count(section, '<div class="acc-col-header">SIN CAMBIO DE STATS</div>'), 2);
  assert.equal(count(section, '<span class="acc-nature-sub acc-neutral-tag">— NEUTRAL</span>'), 3);
  const columns = section.split('SIN CAMBIO DE STATS').slice(1);
  assert.deepEqual(
    columns.map((col) => [...col.matchAll(/acc-nature-name">([A-Z]+)</g)].map((m) => m[1])),
    [['HARDY', 'DOCILE'], ['SERIOUS']],
  );
});

test('a malicious nature name is escaped', () => {
  const html = naturesView.renderItems([
    { ...adamant, name: '<script>alert(1)</script>' },
    neutral(1, '<script>x</script>'),
  ]);
  assert.ok(html.includes('&lt;SCRIPT&gt;'));
  assert.doesNotMatch(html, /<script/i);
});

test('a lowering nature without raised stat names an em dash', () => {
  const odd = { ...adamant, increasedStat: null, decreasedStat: 'speed' };
  const speed = sectionOf(naturesView.renderItems([odd]), 'speed');
  assert.ok(speed.includes('<span class="acc-nature-sub">↑ —</span>'));
});

test('sections and rows have nothing but whitespace between them', () => {
  const brave = { ...adamant, id: 2, name: 'brave', decreasedStat: 'speed' };
  const lonely = {
    ...adamant,
    id: 3,
    name: 'lonely',
    increasedStat: 'defense',
    decreasedStat: 'special-attack',
  };
  const withNeutrals = naturesView.renderItems([
    adamant,
    brave,
    lonely,
    neutral(1, 'hardy'),
    neutral(6, 'docile'),
    neutral(13, 'serious'),
  ]);
  const rowsAfterRow = /<\/div>\s*<div class="acc-nature-row">/g;
  assert.equal(withNeutrals.match(rowsAfterRow).length, 9);
  assert.equal(withNeutrals.match(/<\/div>\s*<div class="acc-section">/g).length, 5);
  const onlyStats = naturesView.renderItems([adamant]);
  assert.match(onlyStats, /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$/);
});
