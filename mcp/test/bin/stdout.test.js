import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIALIZE, isJsonRpcLine, spawnServer } from '../support/spawn-server.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

test('stdout only carries JSON-RPC and logs go to stderr', { timeout: 5000 }, async (t) => {
  const server = spawnServer(t, { env: { POKEDEX_MCP_LOG: 'debug' } });
  server.send(INITIALIZE);
  const response = await server.response(1);
  server.child.stdin.end();
  await server.exited;

  assert.deepEqual(response.result.serverInfo, { name: 'pokedex-retro', version });
  assert.ok(server.lines.length > 0);
  for (const line of server.lines) assert.ok(isJsonRpcLine(line), `línea no JSON-RPC: ${line}`);
  assert.match(server.stderr(), /\[pokedex-mcp\] info: servidor iniciado \(v1\.0\.0\)/);
});
