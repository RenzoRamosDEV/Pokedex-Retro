import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import gengar from './fixtures/pokemon.json' with { type: 'json' };
import {
  mapPokemon,
  typesBySlot,
  abilitiesBySlot,
  heightMeters,
  weightKilograms,
  primaryType,
  statBarWidth,
} from './pokemon.js';

describe('mapPokemon', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapPokemon(gengar), {
      id: 94,
      name: 'gengar',
      baseExperience: 225,
      height: 15,
      weight: 405,
      abilities: [{ name: 'cursed-body', isHidden: false, slot: 1 }],
      stats: [
        { name: 'hp', baseStat: 60, effort: 0 },
        { name: 'attack', baseStat: 65, effort: 0 },
        { name: 'defense', baseStat: 60, effort: 0 },
        { name: 'special-attack', baseStat: 130, effort: 3 },
        { name: 'special-defense', baseStat: 75, effort: 0 },
        { name: 'speed', baseStat: 110, effort: 0 },
      ],
      types: [
        { slot: 1, typeName: 'ghost' },
        { slot: 2, typeName: 'poison' },
      ],
      sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png',
    });
  });

  test('maps a null base_experience to null', () => {
    assert.equal(mapPokemon({ ...gengar, base_experience: null }).baseExperience, null);
  });

  test('maps an absent base_experience to null', () => {
    const { base_experience: _omitted, ...withoutExperience } = gengar;
    assert.equal(mapPokemon(withoutExperience).baseExperience, null);
  });

  test('maps a base_experience of 0 to 0', () => {
    assert.equal(mapPokemon({ ...gengar, base_experience: 0 }).baseExperience, 0);
  });

  test('maps a null front_default sprite to null', () => {
    assert.equal(mapPokemon({ ...gengar, sprites: { front_default: null } }).sprite, null);
  });

  test('maps an absent front_default sprite to null', () => {
    assert.equal(mapPokemon({ ...gengar, sprites: {} }).sprite, null);
  });
});

describe('Pokémon view helpers', () => {
  const pokemon = {
    types: [
      { slot: 2, typeName: 'poison' },
      { slot: 1, typeName: 'ghost' },
    ],
    abilities: [
      { name: 'levitate', isHidden: true, slot: 3 },
      { name: 'cursed-body', isHidden: false, slot: 1 },
    ],
    height: 15,
    weight: 60,
  };

  test('orders types by slot', () => {
    assert.deepEqual(
      typesBySlot(pokemon).map((t) => t.typeName),
      ['ghost', 'poison'],
    );
  });

  test('orders abilities by slot', () => {
    assert.deepEqual(
      abilitiesBySlot(pokemon).map((a) => a.name),
      ['cursed-body', 'levitate'],
    );
  });

  test('does not reorder the original lists', () => {
    typesBySlot(pokemon);
    abilitiesBySlot(pokemon);
    assert.equal(pokemon.types[0].typeName, 'poison');
    assert.equal(pokemon.abilities[0].name, 'levitate');
  });

  test('shows height in meters with one decimal', () => {
    assert.equal(heightMeters({ height: 15 }), '1.5');
  });

  test('shows a whole height with a trailing .0', () => {
    assert.equal(heightMeters({ height: 60 }), '6.0');
  });

  test('shows a height below one meter', () => {
    assert.equal(heightMeters({ height: 7 }), '0.7');
  });

  test('shows weight in kilograms with one decimal', () => {
    assert.equal(weightKilograms({ weight: 405 }), '40.5');
  });

  test('uses the first listed type as the primary type', () => {
    assert.equal(primaryType(pokemon), 'poison');
  });

  test('defaults the primary type to normal when there are no types', () => {
    assert.equal(primaryType({ types: [] }), 'normal');
  });

  for (const [baseStat, width] of [
    [99, 99],
    [100, 100],
    [101, 100],
    [150, 100],
  ]) {
    test(`stat bar width for ${baseStat} is ${width}`, () => {
      assert.equal(statBarWidth(baseStat), width);
    });
  }
});
