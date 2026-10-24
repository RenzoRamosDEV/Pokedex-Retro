import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conectar } from './support/conectar.js';

test('identifies itself as pokedex-retro with the given version', async (t) => {
  const { client, close } = await conectar({ version: '1.0.0' });
  t.after(close);
  assert.deepEqual(client.getServerVersion(), { name: 'pokedex-retro', version: '1.0.0' });
});
