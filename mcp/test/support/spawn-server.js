import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BIN = fileURLToPath(new URL('../../bin/pokedex-mcp.js', import.meta.url));
export const PRELOAD = fileURLToPath(new URL('./preload-pokeapi-falsa.js', import.meta.url));

export const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'tests', version: '1' },
  },
};

/**
 * Spawns the binary and collects its stdout lines and stderr; the child is killed after the test.
 * @param {import('node:test').TestContext} t
 * @param {{ env?: Record<string, string>, preload?: boolean }} [options]
 */
export function spawnServer(t, { env = {}, preload = false } = {}) {
  const args = preload ? ['--import', PRELOAD, BIN] : [BIN];
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = [];
  const waiters = [];
  let buffer = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const line of parts) {
      lines.push(line);
      for (const waiter of [...waiters]) waiter();
    }
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
  const exited = new Promise((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal })),
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  return {
    child,
    lines,
    exited,
    stderr: () => stderr,
    send: (message) => child.stdin.write(`${JSON.stringify(message)}\n`),
    /** Resolves with the JSON-RPC response for `id`; rejects if the process exits first. */
    response(id) {
      return new Promise((resolve, reject) => {
        exited.then(({ code, signal }) =>
          reject(new Error(`el servidor terminó (${code ?? signal}): ${stderr}`)),
        );
        const check = () => {
          const found = lines.map((line) => JSON.parse(line)).find((m) => m.id === id);
          if (!found) return;
          waiters.splice(waiters.indexOf(check), 1);
          resolve(found);
        };
        waiters.push(check);
        check();
      });
    },
  };
}

/** @param {string} line */
export function isJsonRpcLine(line) {
  try {
    const message = JSON.parse(line);
    return message.jsonrpc === '2.0' && ('id' in message || 'method' in message);
  } catch {
    return false;
  }
}
