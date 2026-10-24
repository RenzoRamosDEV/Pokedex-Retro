import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import masterBall from './fixtures/item.json' with { type: 'json' };
import ultraBall from './fixtures/item-ultra-ball.json' with { type: 'json' };
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

  test('maps the golden ultra-ball fixture with prices but no cost', () => {
    assert.deepStrictEqual(mapItem(ultraBall), {
      id: 2,
      name: 'ultra-ball',
      cost: 600,
      category: 'standard-balls',
      sprite:
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
      shortEffect: 'Tries to catch a wild Pokémon.  Success rate is 2×.',
    });
  });

  test('prefers a numeric cost over prices', () => {
    assert.equal(mapItem({ ...ultraBall, cost: 200 }).cost, 200);
  });

  test('keeps a cost of 0 even when prices have a purchase price', () => {
    assert.equal(mapItem({ ...ultraBall, cost: 0 }).cost, 0);
  });

  test('ignores a null cost and falls back to prices', () => {
    assert.equal(mapItem({ ...ultraBall, cost: null }).cost, 600);
  });
});

const price = (purchase, currency = 'poke-dollar') => ({
  purchase_price: purchase,
  sell_price: 0,
  currency: { name: currency, url: 'https://pokeapi.co/api/v2/currency/1/' },
  version_group: { name: 'red-blue', url: 'https://pokeapi.co/api/v2/version-group/1/' },
});

describe('mapItem price from prices', () => {
  const costOf = (prices) => mapItem({ ...masterBall, prices }).cost;

  test('an empty prices list gives null', () => {
    assert.equal(costOf([]), null);
  });

  test('a missing prices list gives null', () => {
    assert.equal(mapItem(masterBall).cost, null);
  });

  for (const [label, purchase] of [
    ['null', null],
    ['0', 0],
    ['negative', -1],
  ]) {
    test(`a ${label} purchase price is not a price`, () => {
      assert.equal(costOf([price(purchase)]), null);
    });
  }

  test('a purchase price of 1 is a price', () => {
    assert.equal(costOf([price(1)]), 1);
  });

  test('takes the last valid poke-dollar entry', () => {
    assert.equal(costOf([price(1200), price(800), price(600)]), 600);
  });

  test('skips trailing entries without a purchase price', () => {
    assert.equal(costOf([price(1200), price(800), price(null), price(0)]), 800);
  });

  test('skips trailing entries in another currency', () => {
    assert.equal(costOf([price(1200), price(500, 'battle-point')]), 1200);
  });

  test('only other currencies give null', () => {
    assert.equal(costOf([price(500, 'battle-point')]), null);
  });

  test('a single valid entry before invalid ones is used', () => {
    assert.equal(costOf([price(300), price(null), price(400, 'other')]), 300);
  });
});

describe('mapItem other fields', () => {
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
