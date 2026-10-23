import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import adamant from './fixtures/nature.json' with { type: 'json' };
import { mapNature, groupNatures } from './nature.js';

describe('mapNature', () => {
  test('maps the golden PokéAPI fixture field by field', () => {
    assert.deepStrictEqual(mapNature(adamant), {
      id: 11,
      name: 'adamant',
      increasedStat: 'attack',
      decreasedStat: 'special-attack',
      likesFlavor: 'spicy',
      hatesFlavor: 'dry',
    });
  });

  test('maps null stats and flavors to null', () => {
    const neutral = {
      id: 1,
      name: 'hardy',
      increased_stat: null,
      decreased_stat: null,
      likes_flavor: null,
      hates_flavor: null,
    };
    assert.deepStrictEqual(mapNature(neutral), {
      id: 1,
      name: 'hardy',
      increasedStat: null,
      decreasedStat: null,
      likesFlavor: null,
      hatesFlavor: null,
    });
  });

  test('maps missing stats and flavors to null', () => {
    assert.deepStrictEqual(mapNature({ id: 2, name: 'bashful' }), {
      id: 2,
      name: 'bashful',
      increasedStat: null,
      decreasedStat: null,
      likesFlavor: null,
      hatesFlavor: null,
    });
  });
});

const nature = (name, increasedStat, decreasedStat) => ({ name, increasedStat, decreasedStat });
const neutrals = (count) =>
  Array.from({ length: count }, (_, i) => nature(`n${i + 1}`, null, null));

describe('groupNatures', () => {
  test('returns the five stat groups in order with their labels', () => {
    const groups = groupNatures([]).statGroups;
    assert.deepEqual(
      groups.map((g) => [g.stat, g.label]),
      [
        ['attack', 'ATK'],
        ['defense', 'DEF'],
        ['special-attack', 'SP.ATK'],
        ['special-defense', 'SP.DEF'],
        ['speed', 'SPD'],
      ],
    );
  });

  test('keeps the accent color of each stat group', () => {
    assert.deepEqual(
      groupNatures([]).statGroups.map((g) => g.color),
      ['#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#f39c12'],
    );
  });

  test('lists natures raising a stat under up and lowering it under down', () => {
    const adamantNature = nature('adamant', 'attack', 'special-attack');
    const modestNature = nature('modest', 'special-attack', 'attack');
    const lonelyNature = nature('lonely', 'attack', 'defense');
    const attack = groupNatures([adamantNature, modestNature, lonelyNature]).statGroups[0];
    assert.deepEqual(
      { up: attack.up.map((n) => n.name), down: attack.down.map((n) => n.name) },
      { up: ['adamant', 'lonely'], down: ['modest'] },
    );
  });

  test('leaves groups empty when no nature touches the stat', () => {
    const speed = groupNatures([nature('adamant', 'attack', 'special-attack')]).statGroups[4];
    assert.deepEqual([speed.up, speed.down], [[], []]);
  });

  test('ignores natures that only have one stat set when collecting neutrals', () => {
    const grouped = groupNatures([nature('odd', 'attack', null), nature('odder', null, 'speed')]);
    assert.deepEqual(grouped.neutrals, { all: [], left: [], right: [] });
  });

  for (const [count, leftCount] of [
    [0, 0],
    [1, 1],
    [4, 2],
    [5, 3],
  ]) {
    test(`splits ${count} neutral natures with ${leftCount} in the left column`, () => {
      const list = neutrals(count);
      const grouped = groupNatures(list).neutrals;
      assert.deepEqual(grouped, {
        all: list,
        left: list.slice(0, leftCount),
        right: list.slice(leftCount),
      });
    });
  }
});
