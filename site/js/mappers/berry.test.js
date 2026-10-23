import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import cheri from './fixtures/berry.json' with { type: 'json' };
import { mapBerry } from './berry.js';

describe('mapBerry', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapBerry(cheri), {
      id: 1,
      name: 'cheri',
      growthTime: 3,
      maxHarvest: 5,
      naturalGiftPower: 60,
      naturalGiftType: 'fire',
      smoothness: 25,
      firmness: 'soft',
      flavors: [
        { potency: 10, flavor: 'spicy' },
        { potency: 0, flavor: 'dry' },
        { potency: 0, flavor: 'sweet' },
        { potency: 0, flavor: 'bitter' },
        { potency: 0, flavor: 'sour' },
      ],
    });
  });

  test('maps an empty flavor list to an empty list', () => {
    assert.deepEqual(mapBerry({ ...cheri, flavors: [] }).flavors, []);
  });
});
