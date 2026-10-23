import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './html.js';

describe('escapeHtml', () => {
  for (const [input, expected] of [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ]) {
    test(`escapes ${input}`, () => {
      assert.equal(escapeHtml(input), expected);
    });
  }

  test('escapes every occurrence in a mixed string', () => {
    assert.equal(escapeHtml(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });

  test('passes plain text through', () => {
    assert.equal(escapeHtml('pikachu'), 'pikachu');
  });

  test('coerces numbers to strings', () => {
    assert.equal(escapeHtml(0), '0');
  });

  test('renders null as an empty string', () => {
    assert.equal(escapeHtml(null), '');
  });

  test('renders undefined as an empty string', () => {
    assert.equal(escapeHtml(undefined), '');
  });
});
