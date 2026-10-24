import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installShutdown } from '../src/lifecycle.js';

async function flush() {
  for (let i = 0; i < 10; i += 1) await new Promise(setImmediate);
}

function setup(t, close) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const target = new EventEmitter();
  const exit = t.mock.fn();
  const closeSpy = t.mock.fn(close);
  const lines = [];
  const record = (level) => (message) => lines.push(`${level}: ${message}`);
  const log = { error: record('error'), info: record('info'), debug: record('debug') };
  installShutdown({ target, close: closeSpy, exit, log, graceMs: 1500 });
  return { target, exit, close: closeSpy, lines };
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`${signal} closes once and exits with 0 when close resolves`, async (t) => {
    const { target, exit, close, lines } = setup(t, async () => {});
    target.emit(signal);
    await flush();
    assert.equal(close.mock.callCount(), 1);
    assert.deepEqual(
      exit.mock.calls.map((c) => c.arguments),
      [[0]],
    );
    assert.deepEqual(lines, [`info: cerrando por ${signal}`]);
  });
}

test('exit waits for close to resolve', async (t) => {
  let resolveClose;
  const { target, exit } = setup(t, () => new Promise((resolve) => (resolveClose = resolve)));
  target.emit('SIGTERM');
  await flush();
  assert.equal(exit.mock.callCount(), 0);
  resolveClose();
  await flush();
  assert.equal(exit.mock.callCount(), 1);
});

test('a rejecting close still exits with 0 and logs one error', async (t) => {
  const { target, exit, lines } = setup(t, async () => {
    throw new Error('transporte roto');
  });
  target.emit('SIGTERM');
  await flush();
  assert.deepEqual(
    exit.mock.calls.map((c) => c.arguments),
    [[0]],
  );
  assert.deepEqual(lines, [
    'info: cerrando por SIGTERM',
    'error: cierre incompleto: transporte roto',
  ]);
});

test('a hanging close forces exit(0) at 1500 ms and not at 1499', async (t) => {
  const { target, exit } = setup(t, () => new Promise(() => {}));
  target.emit('SIGINT');
  await flush();
  t.mock.timers.tick(1499);
  await flush();
  assert.equal(exit.mock.callCount(), 0);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(
    exit.mock.calls.map((c) => c.arguments),
    [[0]],
  );
});

test('a resolved close cancels the forced exit', async (t) => {
  const { target, exit } = setup(t, async () => {});
  target.emit('SIGTERM');
  await flush();
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(exit.mock.callCount(), 1);
});

test('a second signal neither closes nor exits again', async (t) => {
  const { target, exit, close } = setup(t, async () => {});
  target.emit('SIGTERM');
  target.emit('SIGINT');
  target.emit('SIGTERM');
  await flush();
  assert.equal(close.mock.callCount(), 1);
  assert.equal(exit.mock.callCount(), 1);
});

test('nothing happens before a signal', async (t) => {
  const { exit, close } = setup(t, async () => {});
  t.mock.timers.tick(5000);
  await flush();
  assert.deepEqual([close.mock.callCount(), exit.mock.callCount()], [0, 0]);
});
