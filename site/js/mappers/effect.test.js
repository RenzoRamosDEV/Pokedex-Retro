import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shortEffect } from './effect.js';

const entry = (language, text) => ({ short_effect: text, language: { name: language } });

describe('shortEffect', () => {
  test('prefers the English entry even when it is not first', () => {
    assert.equal(
      shortEffect({ effect_entries: [entry('de', 'Deutsch'), entry('en', 'English')] }),
      'English',
    );
  });

  test('falls back to the first entry when there is no English one', () => {
    assert.equal(
      shortEffect({ effect_entries: [entry('fr', 'Français'), entry('de', 'Deutsch')] }),
      'Français',
    );
  });

  test('returns an empty string for an empty entry list', () => {
    assert.equal(shortEffect({ effect_entries: [] }), '');
  });

  test('returns an empty string when effect_entries is missing', () => {
    assert.equal(shortEffect({}), '');
  });

  test('returns an empty string when the preferred entry lacks short_effect', () => {
    assert.equal(
      shortEffect({ effect_entries: [{ language: { name: 'en' } }, entry('de', 'Deutsch')] }),
      '',
    );
  });

  test('skips entries without a language when looking for English', () => {
    assert.equal(
      shortEffect({ effect_entries: [{ short_effect: 'Unknown' }, entry('en', 'English')] }),
      'English',
    );
  });
});
