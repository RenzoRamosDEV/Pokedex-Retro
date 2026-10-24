import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { INITIALIZE, spawnServer } from '../support/spawn-server.js';

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(
    `${signal} after initialize exits with code 0 in under 2 s`,
    { timeout: 5000 },
    async (t) => {
      const server = spawnServer(t);
      server.send(INITIALIZE);
      await server.response(1);
      const start = performance.now();
      server.child.kill(signal);
      const { code, signal: killedBy } = await server.exited;
      const elapsed = performance.now() - start;
      assert.deepEqual({ code, killedBy }, { code: 0, killedBy: null });
      assert.ok(elapsed < 2000, `${elapsed} ms`);
    },
  );
}
