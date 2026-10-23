import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createListCache } from './cache.js';

const LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=100000';
const LIST_KEY = `pokedex:lista:${LIST_URL}`;
const NOW = 1_700_000_000_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const LIST = { count: 1, results: [{ name: 'charmander' }] };

function createFakeStorage(entries = {}) {
  const items = new Map(Object.entries(entries));
  const writes = [];
  return {
    items,
    writes,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      writes.push([key, value]);
      items.set(key, String(value));
    },
  };
}

function createThrowingStorage() {
  const fail = () => {
    throw new DOMException('lleno', 'QuotaExceededError');
  };
  return { getItem: fail, setItem: fail };
}

const storedList = (t, data = LIST) => JSON.stringify({ t, data });

test('importing the cache module in Node has no side effects', async () => {
  assert.equal(globalThis.window, undefined);
  await import(`./cache.js?import-check=${Date.now()}`);
  assert.equal(globalThis.window, undefined);
});

test('list cache: an empty storage is a miss', () => {
  const cache = createListCache({ storage: createFakeStorage(), now: () => NOW });
  assert.equal(cache.get(LIST_URL), undefined);
});

test('list cache: set writes the list key with the timestamp and the data', () => {
  const storage = createFakeStorage();
  createListCache({ storage, now: () => NOW }).set(LIST_URL, LIST);
  assert.deepEqual(storage.writes, [[LIST_KEY, storedList(NOW)]]);
});

test('list cache: set then get returns the data', () => {
  const cache = createListCache({ storage: createFakeStorage(), now: () => NOW });
  cache.set(LIST_URL, LIST);
  assert.deepEqual(cache.get(LIST_URL), LIST);
});

for (const [label, ageMs, expected] of [
  ['2 h old', 2 * HOUR_MS, LIST],
  ['0 ms old', 0, LIST],
  ['86 399 999 ms old', DAY_MS - 1, LIST],
  ['86 400 000 ms old (exact limit)', DAY_MS, undefined],
  ['25 h old', 25 * HOUR_MS, undefined],
]) {
  test(`list cache: an entry ${label} is ${expected ? 'a hit' : 'a miss'}`, () => {
    const storage = createFakeStorage({ [LIST_KEY]: storedList(NOW - ageMs) });
    const cache = createListCache({ storage, now: () => NOW });
    assert.deepEqual(cache.get(LIST_URL), expected);
  });
}

test('list cache: the default lifetime is 24 h', () => {
  const fresh = createFakeStorage({ [LIST_KEY]: storedList(NOW - DAY_MS + 1) });
  const stale = createFakeStorage({ [LIST_KEY]: storedList(NOW - DAY_MS) });
  assert.deepEqual(createListCache({ storage: fresh, now: () => NOW }).get(LIST_URL), LIST);
  assert.equal(createListCache({ storage: stale, now: () => NOW }).get(LIST_URL), undefined);
});

test('list cache: a custom ttlMs is honoured', () => {
  const storage = createFakeStorage({ [LIST_KEY]: storedList(NOW - 10) });
  assert.equal(createListCache({ storage, now: () => NOW, ttlMs: 10 }).get(LIST_URL), undefined);
  assert.deepEqual(createListCache({ storage, now: () => NOW, ttlMs: 11 }).get(LIST_URL), LIST);
});

test('list cache: now defaults to Date.now', (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const storage = createFakeStorage({ [LIST_KEY]: storedList(NOW - DAY_MS) });
  assert.equal(createListCache({ storage }).get(LIST_URL), undefined);
});

test('list cache: a stale entry is overwritten by the next set', () => {
  const storage = createFakeStorage({ [LIST_KEY]: storedList(NOW - 25 * HOUR_MS, { old: true }) });
  const cache = createListCache({ storage, now: () => NOW });
  assert.equal(cache.get(LIST_URL), undefined);
  cache.set(LIST_URL, LIST);
  assert.equal(storage.items.get(LIST_KEY), storedList(NOW));
  assert.deepEqual(cache.get(LIST_URL), LIST);
});

for (const [label, raw] of [
  ['text that is not JSON', '{no es json'],
  ['null', 'null'],
  ['a number', '42'],
  ['a non-numeric t', JSON.stringify({ t: 'x', data: {} })],
  ['a non-finite t', '{"t":1e999,"data":{}}'],
  ['no data', JSON.stringify({ t: NOW })],
  ['null data', JSON.stringify({ t: NOW, data: null })],
  ['primitive data', JSON.stringify({ t: NOW, data: 'lista' })],
]) {
  test(`list cache: an entry with ${label} is a miss without throwing`, () => {
    const storage = createFakeStorage({ [LIST_KEY]: raw });
    assert.equal(createListCache({ storage, now: () => NOW }).get(LIST_URL), undefined);
  });
}

test('list cache: a storage that throws on read is a miss', () => {
  const cache = createListCache({ storage: createThrowingStorage(), now: () => NOW });
  assert.equal(cache.get(LIST_URL), undefined);
});

test('list cache: a storage that throws QuotaExceededError on write is ignored', () => {
  const cache = createListCache({ storage: createThrowingStorage(), now: () => NOW });
  assert.doesNotThrow(() => cache.set(LIST_URL, LIST));
});

test('list cache: a null storage misses and ignores writes', () => {
  const cache = createListCache({ storage: null, now: () => NOW });
  assert.doesNotThrow(() => cache.set(LIST_URL, LIST));
  assert.equal(cache.get(LIST_URL), undefined);
});
