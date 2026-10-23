import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import stench from './fixtures/ability.json' with { type: 'json' };
import { mapAbility } from './ability.js';

describe('mapAbility', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapAbility(stench), {
      id: 1,
      name: 'stench',
      shortEffect: 'Has a 10% chance of making target Pokémon flinch with each hit.',
      pokemonCount: 10,
    });
  });

  test('counts zero Pokémon when the pokemon list is missing', () => {
    const { pokemon: _pokemon, ...rest } = stench;
    assert.equal(mapAbility(rest).pokemonCount, 0);
  });

  test('counts zero Pokémon for an empty list', () => {
    assert.equal(mapAbility({ ...stench, pokemon: [] }).pokemonCount, 0);
  });
});
