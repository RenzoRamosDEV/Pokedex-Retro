import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import masterBall from './fixtures/item.json' with { type: 'json' };
import { mapItem } from './item.js';

describe('mapItem', () => {
  test('maps the golden PokéAPI fixture field by field (current API has no cost)', () => {
    assert.deepStrictEqual(mapItem(masterBall), {
      id: 1,
      name: 'master-ball',
      cost: null,
      category: 'standard-balls',
      sprite:
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
      shortEffect: 'Catches a wild Pokémon every time.',
    });
  });

  test('keeps cost when the API provides it', () => {
    assert.equal(mapItem({ ...masterBall, cost: 200 }).cost, 200);
  });

  test('keeps a cost of 0', () => {
    assert.equal(mapItem({ ...masterBall, cost: 0 }).cost, 0);
  });

  test('maps missing sprites to null', () => {
    const { sprites: _sprites, ...rest } = masterBall;
    assert.equal(mapItem(rest).sprite, null);
  });

  test('maps a null default sprite to null', () => {
    assert.equal(mapItem({ ...masterBall, sprites: { default: null } }).sprite, null);
  });

  test('maps empty effect entries to an empty short effect', () => {
    assert.equal(mapItem({ ...masterBall, effect_entries: [] }).shortEffect, '');
  });
});
