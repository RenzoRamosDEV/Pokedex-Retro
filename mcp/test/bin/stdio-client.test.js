import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BIN, PRELOAD } from '../support/spawn-server.js';

test('a real stdio session with the SDK client', { timeout: 5000 }, async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', PRELOAD, BIN],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'tests', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);

  const { tools } = await client.listTools();
  const result = await client.callTool({
    name: 'efectividad_tipos',
    arguments: { atacante: 'electric', defensor: ['water', 'flying'] },
  });

  assert.equal(tools.length, 12);
  assert.equal(result.structuredContent.multiplicador, 4);
});
