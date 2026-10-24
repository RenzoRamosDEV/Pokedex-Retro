import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiCache, createDetailCache, createListCache } from './cache.js';
import { createFetchJson } from './client.js';

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

test('list cache: prefix "" writes the URL as the exact key', () => {
  const storage = createFakeStorage();
  createListCache({ storage, now: () => NOW, prefix: '' }).set(LIST_URL, LIST);
  assert.deepEqual(storage.writes, [[LIST_URL, storedList(NOW)]]);
});

test('list cache: prefix "" reads the URL as the exact key', () => {
  const storage = createFakeStorage({ [LIST_URL]: storedList(NOW) });
  const reads = [];
  const getItem = storage.getItem;
  storage.getItem = (key) => (reads.push(key), getItem(key));
  const cache = createListCache({ storage, now: () => NOW, prefix: '' });
  assert.deepEqual(cache.get(LIST_URL), LIST);
  assert.deepEqual(reads, [LIST_URL]);
});

test('list cache: prefix "" ignores entries stored under the default prefix', () => {
  const storage = createFakeStorage({ [LIST_KEY]: storedList(NOW) });
  assert.equal(createListCache({ storage, now: () => NOW, prefix: '' }).get(LIST_URL), undefined);
});

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

const DETAIL_URL = 'https://pokeapi.co/api/v2/pokemon/charmander';
const DETAIL_KEY = `pokedex:detalle:${DETAIL_URL}`;
const DETAIL = { id: 4, name: 'charmander' };

test('detail cache: an empty storage is a miss', () => {
  assert.equal(createDetailCache({ storage: createFakeStorage() }).get(DETAIL_URL), undefined);
});

test('detail cache: set writes the detail key with the JSON data', () => {
  const storage = createFakeStorage();
  createDetailCache({ storage }).set(DETAIL_URL, DETAIL);
  assert.deepEqual(storage.writes, [[DETAIL_KEY, JSON.stringify(DETAIL)]]);
});

test('detail cache: get after set is served from memory', () => {
  const storage = createFakeStorage();
  const cache = createDetailCache({ storage });
  cache.set(DETAIL_URL, DETAIL);
  storage.items.clear();
  assert.deepEqual(cache.get(DETAIL_URL), DETAIL);
});

test('detail cache: an entry only in storage (after a reload) is a hit and stays in memory', () => {
  const storage = createFakeStorage({ [DETAIL_KEY]: JSON.stringify(DETAIL) });
  const cache = createDetailCache({ storage });
  assert.deepEqual(cache.get(DETAIL_URL), DETAIL);
  storage.items.clear();
  assert.deepEqual(cache.get(DETAIL_URL), DETAIL);
});

for (const [label, raw] of [
  ['text that is not JSON', '{no es json'],
  ['null', 'null'],
  ['a number', '42'],
]) {
  test(`detail cache: an entry with ${label} is a miss without throwing`, () => {
    const storage = createFakeStorage({ [DETAIL_KEY]: raw });
    assert.equal(createDetailCache({ storage }).get(DETAIL_URL), undefined);
  });
}

for (const [label, storage] of [
  ['throws', createThrowingStorage()],
  ['is null', null],
]) {
  test(`detail cache: memory keeps working when the storage ${label}`, () => {
    const cache = createDetailCache({ storage });
    assert.equal(cache.get(DETAIL_URL), undefined);
    assert.doesNotThrow(() => cache.set(DETAIL_URL, DETAIL));
    assert.deepEqual(cache.get(DETAIL_URL), DETAIL);
  });
}

test('detail caches do not share memory', () => {
  createDetailCache({ storage: null }).set(DETAIL_URL, DETAIL);
  assert.equal(createDetailCache({ storage: null }).get(DETAIL_URL), undefined);
});

for (const [url, target] of [
  ['https://pokeapi.co/api/v2/pokemon?limit=100000', 'local'],
  ['https://pokeapi.co/api/v2/move?limit=100000', 'local'],
  ['https://pokeapi.co/api/v2/pokemon?limit=18&offset=0', 'session'],
  ['https://pokeapi.co/api/v2/nature?limit=100', 'session'],
  ['https://pokeapi.co/api/v2/pokemon?limit=1000000', 'session'],
  ['https://pokeapi.co/api/v2/pokemon/charmander', 'session'],
]) {
  test(`api cache: ${url} is stored only in ${target}Storage`, () => {
    const local = createFakeStorage();
    const session = createFakeStorage();
    const cache = createApiCache({ local, session, now: () => NOW });
    cache.set(url, LIST);
    const prefix = target === 'local' ? 'pokedex:lista:' : 'pokedex:detalle:';
    assert.deepEqual([...(target === 'local' ? local : session).items.keys()], [prefix + url]);
    assert.equal((target === 'local' ? session : local).items.size, 0);
    assert.deepEqual(cache.get(url), LIST);
  });
}

test('api cache: now defaults to Date.now for lists', (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const local = createFakeStorage({ [LIST_KEY]: storedList(NOW - DAY_MS) });
  assert.equal(createApiCache({ local, session: null }).get(LIST_URL), undefined);
});

function createCountingFetch(bodies) {
  const calls = new Map();
  const fetch = async (url) => {
    calls.set(url, (calls.get(url) ?? 0) + 1);
    return { ok: true, status: 200, json: async () => bodies[url] };
  };
  return { fetch, callsTo: (url) => calls.get(url) ?? 0 };
}

const FRESH_LIST = { count: 2, results: [{ name: 'charmander' }, { name: 'charmeleon' }] };

test('scenario: a search with a 2 h old cached list makes no list request', async () => {
  const local = createFakeStorage({ [LIST_KEY]: storedList(NOW - 2 * HOUR_MS) });
  const network = createCountingFetch({ [LIST_URL]: FRESH_LIST });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({ local, session: createFakeStorage(), now: () => NOW }),
  });
  assert.deepEqual(await fetchJson(LIST_URL), LIST);
  assert.equal(network.callsTo(LIST_URL), 0);
});

test('scenario: a 25 h old list is requested again and overwritten', async () => {
  const local = createFakeStorage({ [LIST_KEY]: storedList(NOW - 25 * HOUR_MS) });
  const network = createCountingFetch({ [LIST_URL]: FRESH_LIST });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({ local, session: createFakeStorage(), now: () => NOW }),
  });
  assert.deepEqual(await fetchJson(LIST_URL), FRESH_LIST);
  assert.equal(network.callsTo(LIST_URL), 1);
  assert.equal(local.items.get(LIST_KEY), storedList(NOW, FRESH_LIST));
});

test('scenario: a corrupt list entry is requested again and overwritten', async () => {
  const local = createFakeStorage({ [LIST_KEY]: '{no es json' });
  const network = createCountingFetch({ [LIST_URL]: FRESH_LIST });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({ local, session: null, now: () => NOW }),
  });
  assert.deepEqual(await fetchJson(LIST_URL), FRESH_LIST);
  assert.equal(local.items.get(LIST_KEY), storedList(NOW, FRESH_LIST));
});

test('scenario: a full storage still resolves with the JSON', async () => {
  const network = createCountingFetch({ [LIST_URL]: FRESH_LIST, [DETAIL_URL]: DETAIL });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({
      local: createThrowingStorage(),
      session: createThrowingStorage(),
      now: () => NOW,
    }),
  });
  assert.deepEqual(await fetchJson(LIST_URL), FRESH_LIST);
  assert.deepEqual(await fetchJson(DETAIL_URL), DETAIL);
});

test('scenario: an inaccessible storage sends every list load to the network', async () => {
  const network = createCountingFetch({ [LIST_URL]: FRESH_LIST });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({ local: null, session: null, now: () => NOW }),
  });
  await fetchJson(LIST_URL);
  await fetchJson(LIST_URL);
  assert.equal(network.callsTo(LIST_URL), 2);
});

test('scenario: a repeated detail makes a single request', async () => {
  const network = createCountingFetch({ [DETAIL_URL]: DETAIL });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({
      local: createFakeStorage(),
      session: createFakeStorage(),
      now: () => NOW,
    }),
  });
  assert.deepEqual(await fetchJson(DETAIL_URL), DETAIL);
  assert.deepEqual(await fetchJson(DETAIL_URL), DETAIL);
  assert.equal(network.callsTo(DETAIL_URL), 1);
});

test('scenario: a detail in sessionStorage after a reload makes no request', async () => {
  const session = createFakeStorage({ [DETAIL_KEY]: JSON.stringify(DETAIL) });
  const network = createCountingFetch({ [DETAIL_URL]: { id: 0 } });
  const fetchJson = createFetchJson({
    fetch: network.fetch,
    cache: createApiCache({ local: createFakeStorage(), session, now: () => NOW }),
  });
  assert.deepEqual(await fetchJson(DETAIL_URL), DETAIL);
  assert.equal(network.callsTo(DETAIL_URL), 0);
});
