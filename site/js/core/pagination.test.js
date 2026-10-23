import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { offsetFor, sliceFor, totalPages, paginationLinks } from './pagination.js';

describe('offsetFor', () => {
  test('page 1 starts at offset 0', () => {
    assert.equal(offsetFor(1, 16), 0);
  });

  test('page 3 with size 16 starts at offset 32', () => {
    assert.equal(offsetFor(3, 16), 32);
  });
});

describe('sliceFor', () => {
  const list = [1, 2, 3, 4, 5, 6, 7];

  test('returns the first page', () => {
    assert.deepEqual(sliceFor(list, 1, 3), [1, 2, 3]);
  });

  test('returns a middle page', () => {
    assert.deepEqual(sliceFor(list, 2, 3), [4, 5, 6]);
  });

  test('returns a partial last page', () => {
    assert.deepEqual(sliceFor(list, 3, 3), [7]);
  });

  test('returns an empty list beyond the last page', () => {
    assert.deepEqual(sliceFor(list, 4, 3), []);
  });
});

describe('totalPages', () => {
  for (const [count, size, expected] of [
    [0, 15, 0],
    [1, 15, 1],
    [15, 15, 1],
    [16, 15, 2],
    [30, 15, 2],
  ]) {
    test(`count ${count} with size ${size} gives ${expected} pages`, () => {
      assert.equal(totalPages(count, size), expected);
    });
  }
});

describe('paginationLinks', () => {
  test('returns null when there are no pages', () => {
    assert.equal(paginationLinks(1, 0, null), null);
  });

  test('returns null for a single page', () => {
    assert.equal(paginationLinks(1, 1, null), null);
  });

  test('disables PREV on the first page', () => {
    assert.deepEqual(paginationLinks(1, 10, null), { page: 1, total: 10, prevHref: null, nextHref: '?page=2' });
  });

  test('disables NEXT on the last page', () => {
    assert.deepEqual(paginationLinks(2, 2, null), { page: 2, total: 2, prevHref: '?page=1', nextHref: null });
  });

  test('links both directions on a middle page', () => {
    assert.deepEqual(paginationLinks(3, 5, null), { page: 3, total: 5, prevHref: '?page=2', nextHref: '?page=4' });
  });

  test('keeps the encoded raw query in both links', () => {
    assert.deepEqual(paginationLinks(2, 4, 'mr mime'), {
      page: 2,
      total: 4,
      prevHref: '?page=1&q=mr%20mime',
      nextHref: '?page=3&q=mr%20mime',
    });
  });
});
