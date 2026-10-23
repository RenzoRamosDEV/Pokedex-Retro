import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, filterByName } from './search.js';

describe('normalizeQuery', () => {
  for (const blank of [null, undefined, '', '   ', '\t\n']) {
    test(`returns null for ${JSON.stringify(blank)}`, () => {
      assert.equal(normalizeQuery(blank), null);
    });
  }

  test('trims, lowercases and replaces spaces with dashes', () => {
    assert.equal(normalizeQuery('  Mr Mime '), 'mr-mime');
  });

  test('replaces every space, including consecutive ones', () => {
    assert.equal(normalizeQuery('a  b'), 'a--b');
  });

  test('passes an already-normalized query through', () => {
    assert.equal(normalizeQuery('pikachu'), 'pikachu');
  });
});

describe('filterByName', () => {
  const results = [
    { name: 'charmander', url: 'u1' },
    { name: 'charmeleon', url: 'u2' },
    { name: 'mr-mime', url: 'u3' },
    { name: 'mime-jr', url: 'u4' },
    { name: 'pikachu', url: 'u5' },
  ];

  test('returns the input unchanged when there is no query', () => {
    assert.equal(filterByName(results, null), results);
  });

  test('matches a substring at the start of the name', () => {
    assert.deepEqual(
      filterByName(results, 'charm').map((r) => r.name),
      ['charmander', 'charmeleon'],
    );
  });

  test('matches a substring in the middle of the name', () => {
    assert.deepEqual(
      filterByName(results, 'kac').map((r) => r.name),
      ['pikachu'],
    );
  });

  test('matches a substring at the end of the name, preserving order', () => {
    assert.deepEqual(
      filterByName(results, 'mime').map((r) => r.name),
      ['mr-mime', 'mime-jr'],
    );
  });

  test('returns an empty list when nothing matches', () => {
    assert.deepEqual(filterByName(results, 'zzzz'), []);
  });

  test('does not alter the case of list names', () => {
    assert.deepEqual(filterByName([{ name: 'Abc' }, { name: 'abc' }], 'abc'), [{ name: 'abc' }]);
  });
});
