import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLogger } from '../../src/log.js';
import { createServer } from '../../src/server.js';

/**
 * Connects an SDK client to a fresh server over an in-memory transport.
 * @param {{ port?: Function, level?: string, version?: string }} [options]
 */
export async function conectar({ port, level = 'debug', version = '1.0.0' } = {}) {
  const logs = [];
  const log = createLogger({ level, write: (line) => logs.push(line) });
  const server = createServer({ port, log, version });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tests', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server, logs, close: () => client.close() };
}
