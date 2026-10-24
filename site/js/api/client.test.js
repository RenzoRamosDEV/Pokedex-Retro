import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFetchJson, retryAfterMs } from './client.js';

const URL_A = 'https://pokeapi.co/api/v2/pokemon/1';

function createFakeFetch(script) {
  const queue = [...script];
  const calls = [];
  const fakeFetch = (url, { signal } = {}) => {
    calls.push({ url, signal });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) return Promise.reject(next);
    if (next === 'hang') {
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {});
    const response = {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => JSON.parse(text),
    };
    if (next.headers) response.headers = new Headers(next.headers);
    return Promise.resolve(response);
  };
  return { fetch: fakeFetch, calls };
}

async function flush() {
  for (let i = 0; i < 10; i += 1) await new Promise(setImmediate);
}

function useClock(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return async (ms) => {
    await flush();
    t.mock.timers.tick(ms);
    await flush();
  };
}

function track(promise) {
  const state = { settled: false, value: undefined, error: undefined };
  promise.then(
    (value) => Object.assign(state, { settled: true, value }),
    (error) => Object.assign(state, { settled: true, error }),
  );
  return state;
}

test('importing the client in Node has no side effects', async (t) => {
  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
  const spy = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('no debe llamarse');
  });
  await import(`./client.js?import-check=${Date.now()}`);
  assert.equal(spy.mock.callCount(), 0);
});

test('200 resolves with the parsed JSON after one call', async (t) => {
  useClock(t);
  const fake = createFakeFetch([{ status: 200, body: { id: 1 } }]);
  const fetchJson = createFetchJson({ fetch: fake.fetch });
  assert.deepEqual(await fetchJson(URL_A), { id: 1 });
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].url, URL_A);
});

test('defaults to globalThis.fetch resolved at call time', async (t) => {
  useClock(t);
  const fetchJson = createFetchJson({});
  const fake = createFakeFetch([{ status: 200, body: { id: 7 } }]);
  t.mock.method(globalThis, 'fetch', fake.fetch);
  assert.deepEqual(await fetchJson(URL_A), { id: 7 });
  assert.equal(fake.calls.length, 1);
});

test('503 then 200 retries once after exactly 500 ms', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 503 }, { status: 200, body: { id: 2 } }]);
  const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
  await advance(499);
  assert.equal(fake.calls.length, 1);
  assert.equal(result.settled, false);
  await advance(1);
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(result.value, { id: 2 });
});

test('network error then 429 then 200 waits 500 ms and 1000 ms', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([
    new TypeError('fetch failed'),
    { status: 429 },
    { status: 200, body: { id: 3 } },
  ]);
  const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
  await advance(500);
  assert.equal(fake.calls.length, 2);
  await advance(999);
  assert.equal(fake.calls.length, 2);
  assert.equal(result.settled, false);
  await advance(1);
  assert.equal(fake.calls.length, 3);
  assert.deepEqual(result.value, { id: 3 });
});

test('500 on every call rejects with status 500 after 3 calls', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 500 }]);
  const result = track(createFetchJson({ fetch: fake.fetch, retries: 2 })(URL_A));
  await advance(500);
  await advance(1000);
  await advance(5000);
  assert.equal(fake.calls.length, 3);
  assert.equal(result.error.name, 'HttpError');
  assert.equal(result.error.status, 500);
});

test('network errors exhausted rejects with the original error', async (t) => {
  const advance = useClock(t);
  const networkError = new TypeError('fetch failed');
  const fake = createFakeFetch([networkError]);
  const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
  await advance(500);
  await advance(1000);
  assert.equal(fake.calls.length, 3);
  assert.equal(result.error, networkError);
});

test('retries = 0 with 503 rejects after one call', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 503 }]);
  const result = track(createFetchJson({ fetch: fake.fetch, retries: 0 })(URL_A));
  await advance(5000);
  assert.equal(fake.calls.length, 1);
  assert.equal(result.error.status, 503);
});

for (const status of [400, 404, 499]) {
  test(`${status} rejects with HttpError without retrying`, async (t) => {
    const advance = useClock(t);
    const fake = createFakeFetch([{ status }]);
    const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
    await advance(5000);
    assert.equal(fake.calls.length, 1);
    assert.equal(result.error.name, 'HttpError');
    assert.equal(result.error.status, status);
    assert.ok(result.error instanceof Error);
  });
}

test('already aborted signal rejects with AbortError without calling fetch', async (t) => {
  useClock(t);
  const fake = createFakeFetch([{ status: 200 }]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    createFetchJson({ fetch: fake.fetch })(URL_A, { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(fake.calls.length, 0);
});

test('abort during the backoff wait rejects with AbortError after one call', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 503 }, { status: 200 }]);
  const controller = new AbortController();
  const result = track(
    createFetchJson({ fetch: fake.fetch })(URL_A, { signal: controller.signal }),
  );
  await advance(100);
  controller.abort();
  await advance(5000);
  assert.equal(fake.calls.length, 1);
  assert.equal(result.error.name, 'AbortError');
});

test('abort during the request rejects with AbortError, not TimeoutError', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch(['hang']);
  const controller = new AbortController();
  const result = track(
    createFetchJson({ fetch: fake.fetch })(URL_A, { signal: controller.signal }),
  );
  await advance(100);
  controller.abort();
  await flush();
  assert.equal(result.error.name, 'AbortError');
  assert.equal(fake.calls[0].signal.aborted, true);
  assert.equal(fake.calls.length, 1);
});

test('a request that never answers rejects with TimeoutError at timeoutMs', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch(['hang']);
  const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
  await advance(9999);
  assert.equal(result.settled, false);
  assert.equal(fake.calls[0].signal.aborted, false);
  await advance(1);
  assert.equal(result.error.name, 'TimeoutError');
  assert.equal(fake.calls[0].signal.aborted, true);
});

test('the timeout covers retries and waits as a whole', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 503 }]);
  const result = track(createFetchJson({ fetch: fake.fetch, timeoutMs: 1000 })(URL_A));
  await advance(999);
  assert.equal(result.settled, false);
  await advance(1);
  assert.equal(fake.calls.length, 2);
  assert.equal(result.error.name, 'TimeoutError');
});

test('a completed call does not abort its signal later', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 200, body: { id: 1 } }]);
  await createFetchJson({ fetch: fake.fetch })(URL_A);
  await advance(20000);
  assert.equal(fake.calls[0].signal.aborted, false);
});

test('invalid JSON rejects with SyntaxError without retrying', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 200, body: 'no es json' }]);
  const result = track(createFetchJson({ fetch: fake.fetch })(URL_A));
  await advance(5000);
  assert.equal(fake.calls.length, 1);
  assert.ok(result.error instanceof SyntaxError);
});

test('with a Map cache, a second call is served without fetch', async (t) => {
  useClock(t);
  const fake = createFakeFetch([{ status: 200, body: { id: 4 } }]);
  const fetchJson = createFetchJson({ fetch: fake.fetch, cache: new Map() });
  const first = await fetchJson(URL_A);
  const second = await fetchJson(URL_A);
  assert.deepEqual(first, { id: 4 });
  assert.equal(second, first);
  assert.equal(fake.calls.length, 1);
});

test('without cache every call goes to the network', async (t) => {
  useClock(t);
  const fake = createFakeFetch([{ status: 200, body: { id: 5 } }]);
  const fetchJson = createFetchJson({ fetch: fake.fetch });
  await fetchJson(URL_A);
  await fetchJson(URL_A);
  assert.equal(fake.calls.length, 2);
});

test('error responses are not stored in the cache', async (t) => {
  useClock(t);
  const fake = createFakeFetch([{ status: 404 }]);
  const cache = new Map();
  await assert.rejects(createFetchJson({ fetch: fake.fetch, cache })(URL_A), {
    status: 404,
  });
  assert.equal(cache.size, 0);
});

test('an abort with a custom reason still rejects with AbortError', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch(['hang']);
  const controller = new AbortController();
  const result = track(
    createFetchJson({ fetch: fake.fetch })(URL_A, { signal: controller.signal }),
  );
  await advance(100);
  controller.abort(new Error('motivo propio'));
  await flush();
  assert.equal(result.error.name, 'AbortError');
  assert.match(result.error.message, /cancelada/);
});

test('error messages describe the cause', async (t) => {
  const advance = useClock(t);
  const notFound = track(
    createFetchJson({ fetch: createFakeFetch([{ status: 404 }]).fetch })(URL_A),
  );
  const timedOut = track(createFetchJson({ fetch: createFakeFetch(['hang']).fetch })(URL_A));
  await advance(10000);
  assert.equal(notFound.error.message, 'HTTP 404');
  assert.match(timedOut.error.message, /agotado/);
});

const NOW_MS = Date.UTC(2026, 9, 24, 12, 0, 0);
const fixedNow = () => NOW_MS;

async function expectSecondCallAt(t, retryAfter, ms, options = {}) {
  const advance = useClock(t);
  const fake = createFakeFetch([
    { status: options.status ?? 429, headers: { 'Retry-After': retryAfter } },
    { status: 200, body: { id: 9 } },
  ]);
  const result = track(createFetchJson({ fetch: fake.fetch, now: fixedNow })(URL_A));
  if (ms > 0) {
    await advance(ms - 1);
    assert.equal(fake.calls.length, 1);
    assert.equal(result.settled, false);
    await advance(1);
  } else {
    await advance(0);
  }
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(result.value, { id: 9 });
}

test('429 with Retry-After: 1 retries at 1000 ms and not at 999', async (t) => {
  await expectSecondCallAt(t, '1', 1000);
});

test('429 with Retry-After: 0 retries without waiting', async (t) => {
  await expectSecondCallAt(t, '0', 0);
});

test('429 with an HTTP date 2 s ahead retries at 2000 ms', async (t) => {
  await expectSecondCallAt(t, new Date(NOW_MS + 2000).toUTCString(), 2000);
});

test('429 with an HTTP date in the past retries without waiting', async (t) => {
  await expectSecondCallAt(t, new Date(NOW_MS - 5000).toUTCString(), 0);
});

for (const value of ['pronto', '1pronto', 'pronto1']) {
  test(`429 with Retry-After: ${value} falls back to 500 ms`, async (t) => {
    await expectSecondCallAt(t, value, 500);
  });
}

test('429 without headers falls back to 500 ms without throwing', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 429 }, { status: 200, body: { id: 9 } }]);
  const result = track(createFetchJson({ fetch: fake.fetch, now: fixedNow })(URL_A));
  await advance(499);
  assert.equal(fake.calls.length, 1);
  await advance(1);
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(result.value, { id: 9 });
});

test('503 ignores Retry-After and waits 500 ms', async (t) => {
  await expectSecondCallAt(t, '5', 500, { status: 503 });
});

test('Retry-After longer than the timeout rejects with TimeoutError after 1 call', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 429, headers: { 'Retry-After': '60' } }]);
  const result = track(
    createFetchJson({ fetch: fake.fetch, timeoutMs: 10000, now: fixedNow })(URL_A),
  );
  await advance(9999);
  assert.equal(result.settled, false);
  await advance(1);
  assert.equal(result.error.name, 'TimeoutError');
  assert.equal(fake.calls.length, 1);
});

test('abort during a Retry-After wait rejects with AbortError', async (t) => {
  const advance = useClock(t);
  const fake = createFakeFetch([{ status: 429, headers: { 'Retry-After': '5' } }]);
  const controller = new AbortController();
  const result = track(
    createFetchJson({ fetch: fake.fetch, now: fixedNow })(URL_A, { signal: controller.signal }),
  );
  await advance(100);
  controller.abort();
  await advance(10000);
  assert.equal(fake.calls.length, 1);
  assert.equal(result.error.name, 'AbortError');
});

test('retryAfterMs reads whole seconds', () => {
  assert.equal(retryAfterMs(new Headers({ 'Retry-After': '3' }), fixedNow), 3000);
});

test('retryAfterMs reads an HTTP date relative to now', () => {
  const now = () => Date.parse('Sat, 24 Oct 2026 10:00:00 GMT');
  const headers = new Headers({ 'Retry-After': 'Sat, 24 Oct 2026 10:00:04 GMT' });
  assert.equal(retryAfterMs(headers, now), 4000);
});

test('retryAfterMs is null without the header', () => {
  assert.equal(retryAfterMs(new Headers(), fixedNow), null);
  assert.equal(retryAfterMs(undefined, fixedNow), null);
});
