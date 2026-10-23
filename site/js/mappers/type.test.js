import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import ghost from './fixtures/type.json' with { type: 'json' };
import { mapType, effectiveness } from './type.js';

describe('mapType', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapType(ghost), {
      id: 8,
      name: 'ghost',
      doubleDamageTo: ['ghost', 'psychic'],
      halfDamageTo: ['dark'],
      noDamageTo: ['normal'],
      doubleDamageFrom: ['ghost', 'dark'],
      halfDamageFrom: ['poison', 'bug'],
      noDamageFrom: ['normal', 'fighting'],
      pokemonCount: 4,
    });
  });

  test('maps every missing damage relation key to an empty list', () => {
    const type = mapType({ id: 10001, name: 'unknown', damage_relations: {}, pokemon: [] });
    assert.deepEqual(
      [
        type.doubleDamageTo,
        type.halfDamageTo,
        type.noDamageTo,
        type.doubleDamageFrom,
        type.halfDamageFrom,
        type.noDamageFrom,
      ],
      [[], [], [], [], [], []],
    );
  });

  test('counts zero Pokémon when the pokemon list is missing', () => {
    const { pokemon: _pokemon, ...rest } = ghost;
    assert.equal(mapType(rest).pokemonCount, 0);
  });
});

describe('effectiveness', () => {
  const attacker = (relations) => ({
    doubleDamageTo: [],
    halfDamageTo: [],
    noDamageTo: [],
    ...relations,
  });

  test('returns 2x for double damage', () => {
    assert.equal(effectiveness(attacker({ doubleDamageTo: ['grass'] }), 'grass'), '2x');
  });

  test('returns half for half damage', () => {
    assert.equal(effectiveness(attacker({ halfDamageTo: ['grass'] }), 'grass'), 'half');
  });

  test('returns 0 for no damage', () => {
    assert.equal(effectiveness(attacker({ noDamageTo: ['grass'] }), 'grass'), '0');
  });

  test('returns 1 for normal damage', () => {
    assert.equal(effectiveness(attacker({ doubleDamageTo: ['fire'] }), 'grass'), '1');
  });

  test('double damage wins over half and none', () => {
    const all = attacker({
      doubleDamageTo: ['grass'],
      halfDamageTo: ['grass'],
      noDamageTo: ['grass'],
    });
    assert.equal(effectiveness(all, 'grass'), '2x');
  });

  test('half damage wins over none', () => {
    assert.equal(
      effectiveness(attacker({ halfDamageTo: ['grass'], noDamageTo: ['grass'] }), 'grass'),
      'half',
    );
  });
});
