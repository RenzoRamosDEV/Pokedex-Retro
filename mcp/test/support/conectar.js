import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPokeApiClient } from '../../src/client.js';
import { createLogger } from '../../src/log.js';
import { createServer } from '../../src/server.js';
import { createFakePokeApi } from './pokeapi-falsa.js';

/**
 * Connects an SDK client to a fresh server over an in-memory transport, backed by the fake PokéAPI.
 * The log level is `debug` unless `level` is given, even as `undefined` (no POKEDEX_MCP_LOG).
 * @param {{ respuestas?: object, level?: string, version?: string }} [options]
 */
export async function conectar(options = {}) {
  const { respuestas, version = '1.0.0' } = options;
  const level = 'level' in options ? options.level : 'debug';
  const logs = [];
  const log = createLogger({ level, write: (line) => logs.push(line) });
  const fake = createFakePokeApi({ respuestas });
  const { port } = createPokeApiClient({
    fetch: fake.fetch,
    env: {},
    homedir: tmpdir(),
    log,
    version,
  });
  const server = createServer({ port, log, version });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tests', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server, calls: fake.calls, logs, close: () => client.close() };
}

/** Text of the first content block of a tool result. */
export const textOf = (result) => result.content[0].text;

async function flush() {
  for (let i = 0; i < 20; i += 1) await new Promise(setImmediate);
}

/**
 * Runs `promise` while advancing mocked timers, so retry backoffs take no real time.
 * Requires `t.mock.timers.enable({ apis: ['setTimeout'] })`.
 */
export async function withTimers(t, promise, totalMs = 20000, stepMs = 250) {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let elapsed = 0; elapsed < totalMs && !settled; elapsed += stepMs) {
    await flush();
    t.mock.timers.tick(stepMs);
  }
  await flush();
  return promise;
}
