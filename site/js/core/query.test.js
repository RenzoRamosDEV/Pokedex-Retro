import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from './query.js';

describe('parseQuery', () => {
  test('defaults to page 1 and no query for an empty search string', () => {
    assert.deepEqual(parseQuery(''), { page: 1, rawQuery: null, query: null });
  });

  test('reads a valid page number', () => {
    assert.equal(parseQuery('?page=3').page, 3);
  });

  test('accepts page 1 as the lower boundary', () => {
    assert.equal(parseQuery('?page=1').page, 1);
  });

  test('accepts a large page number', () => {
    assert.equal(parseQuery('?page=123456').page, 123456);
  });

  for (const invalid of ['abc', '0', '-2', '2.5', '', '01', '3a', ' 3']) {
    test(`treats page=${JSON.stringify(invalid)} as page 1`, () => {
      assert.equal(parseQuery(`?page=${encodeURIComponent(invalid)}`).page, 1);
    });
  }

  test('keeps the raw query and normalizes the active query', () => {
    assert.deepEqual(parseQuery('?q=Mr%20Mime'), { page: 1, rawQuery: 'Mr Mime', query: 'mr-mime' });
  });

  test('treats a blank query as no active query while keeping it raw', () => {
    assert.deepEqual(parseQuery('?q=%20%20'), { page: 1, rawQuery: '  ', query: null });
  });

  test('combines page and query', () => {
    assert.deepEqual(parseQuery('?page=2&q=char'), { page: 2, rawQuery: 'char', query: 'char' });
  });

  test('works without the leading question mark', () => {
    assert.deepEqual(parseQuery('page=4&q=Pika'), { page: 4, rawQuery: 'Pika', query: 'pika' });
  });
});
