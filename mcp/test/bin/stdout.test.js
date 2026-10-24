import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIALIZE, isJsonRpcLine, spawnServer } from '../support/spawn-server.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

test('stdout only carries JSON-RPC and logs go to stderr', { timeout: 5000 }, async (t) => {
  const server = spawnServer(t, { env: { POKEDEX_MCP_LOG: 'debug' }, preload: true });
  server.send(INITIALIZE);
  const response = await server.response(1);
  server.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  server.send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'buscar_pokemon', arguments: { consulta: 'char' } },
  });
  const search = await server.response(2);
  server.child.stdin.end();
  await server.exited;

  assert.deepEqual(response.result.serverInfo, { name: 'pokedex-retro', version });
  assert.deepEqual(Object.keys(response.result.capabilities).sort(), [
    'prompts',
    'resources',
    'tools',
  ]);
  assert.equal(search.result.structuredContent.total, 12);
  assert.ok(server.lines.length >= 2);
  for (const line of server.lines) assert.ok(isJsonRpcLine(line), `línea no JSON-RPC: ${line}`);
  assert.match(server.stderr(), /\[pokedex-mcp\] info: servidor iniciado \(v1\.0\.0\)/);
  assert.ok(
    server
      .stderr()
      .includes('[pokedex-mcp] debug: GET https://pokeapi.co/api/v2/pokemon?limit=100000'),
  );
});
