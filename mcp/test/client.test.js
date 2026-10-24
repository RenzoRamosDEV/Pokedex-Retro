import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPokeApiClient } from '../src/client.js';
import { API, createFakePokeApi } from './support/pokeapi-falsa.js';

const PIKACHU = `${API}/pokemon/pikachu`;
const DAY_MS = 86_400_000;
const T0 = Date.UTC(2026, 9, 24, 12, 0, 0);

function recorder() {
  const lines = [];
  const record = (level) => (message) => lines.push(`${level}: ${message}`);
  return { lines, log: { error: record('error'), info: record('info'), debug: record('debug') } };
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pokedex-mcp-client-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function setup(t, { respuestas, env = {}, homedir, fetch } = {}) {
  const fake = createFakePokeApi({ respuestas });
  const clock = { now: T0 };
  const { lines, log } = recorder();
  const client = createPokeApiClient({
    fetch: fetch ?? fake.fetch,
    env,
    homedir: homedir ?? tempDir(t),
    now: () => clock.now,
    log,
    version: '1.0.0',
  });
  return { ...client, calls: fake.calls, clock, lines };
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
  const state = { settled: false };
  promise.then(
    (value) => Object.assign(state, { settled: true, value }),
    (error) => Object.assign(state, { settled: true, error }),
  );
  return state;
}

test('the port answers { ok, status, json } with the PokéAPI body', async (t) => {
  const { port } = setup(t);
  const response = await port(PIKACHU);
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.equal(response.json.name, 'pikachu');
});

test('every request carries the exact User-Agent', async (t) => {
  const { port, calls } = setup(t);
  await port(PIKACHU);
  assert.equal(
    calls[0].userAgent,
    'pokedex-retro-mcp/1.0.0 (+https://github.com/RenzoRamosDEV/Pokedex-Retro)',
  );
});

test('two equal requests make a single call', async (t) => {
  const { port, calls } = setup(t);
  await port(PIKACHU);
  await port(PIKACHU);
  assert.equal(calls.length, 1);
});

test('the memory cache lasts 24 h: 24 h − 1 ms is a hit, 24 h is a miss', async (t) => {
  const { port, calls, clock } = setup(t);
  await port(PIKACHU);
  clock.now = T0 + DAY_MS - 1;
  await port(PIKACHU);
  assert.equal(calls.length, 1);
  clock.now = T0 + DAY_MS;
  await port(PIKACHU);
  assert.equal(calls.length, 2);
});

test('a 404 is neither retried nor stored', async (t) => {
  const { port, calls } = setup(t);
  await assert.rejects(port(`${API}/pokemon/xyz`), { status: 404 });
  assert.equal(calls.length, 1);
  await assert.rejects(port(`${API}/pokemon/xyz`), { status: 404 });
  assert.equal(calls.length, 2);
});

test('503, 503, 200 makes 3 calls waiting 500 ms and 1000 ms', async (t) => {
  const advance = useClock(t);
  const { port, calls } = setup(t, {
    respuestas: {
      [PIKACHU]: [{ status: 503 }, { status: 503 }, { status: 200, body: { id: 25 } }],
    },
  });
  const result = track(port(PIKACHU));
  await advance(499);
  assert.equal(calls.length, 1);
  await advance(1);
  assert.equal(calls.length, 2);
  await advance(999);
  assert.equal(calls.length, 2);
  await advance(1);
  assert.equal(calls.length, 3);
  assert.deepEqual(result.value.json, { id: 25 });
});

test('429 with Retry-After: 1 waits at least 1000 ms', async (t) => {
  const advance = useClock(t);
  const { port, calls } = setup(t, {
    respuestas: {
      [PIKACHU]: [
        { status: 429, headers: { 'Retry-After': '1' } },
        { status: 200, body: { id: 25 } },
      ],
    },
  });
  const result = track(port(PIKACHU));
  await advance(999);
  assert.equal(calls.length, 1);
  await advance(1);
  assert.equal(calls.length, 2);
  assert.deepEqual(result.value.json, { id: 25 });
});

test('a permanent 503 rejects after 3 calls', async (t) => {
  const advance = useClock(t);
  const { port, calls } = setup(t, { respuestas: { [PIKACHU]: [{ status: 503 }] } });
  const result = track(port(PIKACHU));
  await advance(500);
  await advance(1000);
  assert.equal(calls.length, 3);
  assert.equal(result.error.status, 503);
});

test('at most 4 requests are in flight; the 5th starts when one finishes', async (t) => {
  useClock(t);
  const pending = [];
  let started = 0;
  const fetch = (url) =>
    new Promise((resolve) => {
      started += 1;
      pending.push(() => resolve(new Response(JSON.stringify({ url }), { status: 200 })));
    });
  const { port } = setup(t, { fetch });
  const results = Array.from({ length: 10 }, (_, i) => port(`${API}/pokemon/${i + 1}`));
  await flush();
  assert.deepEqual([started, pending.length], [4, 4]);
  pending.shift()();
  await flush();
  assert.deepEqual([started, pending.length], [5, 4]);
  while (pending.length) {
    pending.shift()();
    await flush();
  }
  assert.equal((await Promise.all(results)).length, 10);
});

for (const value of [undefined, '0', 'true']) {
  test(`POKEDEX_MCP_DISK_CACHE=${value} writes no file`, async (t) => {
    const home = tempDir(t);
    const xdg = tempDir(t);
    const env = { XDG_CACHE_HOME: xdg };
    if (value !== undefined) env.POKEDEX_MCP_DISK_CACHE = value;
    const { port } = setup(t, { env, homedir: home });
    await port(PIKACHU);
    assert.deepEqual([readdirSync(home), readdirSync(xdg)], [[], []]);
  });
}

test('with the disk cache on, an absolute XDG_CACHE_HOME holds pokedex-mcp/', async (t) => {
  const xdg = tempDir(t);
  const { port } = setup(t, { env: { POKEDEX_MCP_DISK_CACHE: '1', XDG_CACHE_HOME: xdg } });
  await port(PIKACHU);
  assert.equal(readdirSync(join(xdg, 'pokedex-mcp')).length, 1);
});

for (const xdg of ['relativa/cache', undefined]) {
  test(`with XDG_CACHE_HOME ${xdg ?? 'unset'} the cache lives in ~/.cache/pokedex-mcp/`, async (t) => {
    const home = tempDir(t);
    const env = { POKEDEX_MCP_DISK_CACHE: '1' };
    if (xdg) env.XDG_CACHE_HOME = xdg;
    const { port } = setup(t, { env, homedir: home });
    await port(PIKACHU);
    assert.equal(readdirSync(join(home, '.cache', 'pokedex-mcp')).length, 1);
    assert.equal(existsSync('relativa'), false);
  });
}

test('a second client on the same directory does not call fetch', async (t) => {
  const xdg = tempDir(t);
  const env = { POKEDEX_MCP_DISK_CACHE: '1', XDG_CACHE_HOME: xdg };
  await setup(t, { env }).port(PIKACHU);
  const second = setup(t, { env });
  const response = await second.port(PIKACHU);
  assert.equal(response.json.name, 'pikachu');
  assert.equal(second.calls.length, 0);
  assert.deepEqual(second.lines, [`debug: caché ${PIKACHU}`]);
});

test('debug logs GET <url> per call and caché <url> per hit', async (t) => {
  const { port, lines } = setup(t);
  await port(PIKACHU);
  await port(PIKACHU);
  assert.deepEqual(lines, [`debug: GET ${PIKACHU}`, `debug: caché ${PIKACHU}`]);
});
