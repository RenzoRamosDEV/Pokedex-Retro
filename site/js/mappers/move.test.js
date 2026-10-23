import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import thunderbolt from './fixtures/move.json' with { type: 'json' };
import { mapMove } from './move.js';

describe('mapMove', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapMove(thunderbolt), {
      id: 85,
      name: 'thunderbolt',
      accuracy: 100,
      pp: 15,
      priority: 0,
      power: 90,
      damageClass: 'special',
      moveType: 'electric',
      shortEffect: 'Has a chance to paralyze the target.',
    });
  });

  test('maps null power and accuracy to null', () => {
    const move = mapMove({ ...thunderbolt, power: null, accuracy: null });
    assert.deepEqual([move.power, move.accuracy], [null, null]);
  });

  test('maps absent power and accuracy to null', () => {
    const { power: _power, accuracy: _accuracy, ...rest } = thunderbolt;
    const move = mapMove(rest);
    assert.deepEqual([move.power, move.accuracy], [null, null]);
  });

  test('keeps a power of 0', () => {
    assert.equal(mapMove({ ...thunderbolt, power: 0 }).power, 0);
  });
});
