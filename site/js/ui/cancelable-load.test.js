import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUntilPageHide } from './cancelable-load.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('a load that finishes without pagehide returns its result', async () => {
  const target = new EventTarget();
  let received;
  const result = await loadUntilPageHide(target, async (signal) => {
    received = signal;
    return { status: 'ok', items: [] };
  });
  assert.deepEqual(result, { status: 'ok', items: [] });
  assert.equal(received.aborted, false);
});

test('pagehide during the load aborts the signal and returns null', async () => {
  const target = new EventTarget();
  const pending = deferred();
  let received;
  const loading = loadUntilPageHide(target, (signal) => {
    received = signal;
    return pending.promise;
  });
  target.dispatchEvent(new Event('pagehide'));
  assert.equal(received.aborted, true);
  pending.resolve({ status: 'error' });
  assert.equal(await loading, null);
});

test('pagehide after the load finished does not abort', async () => {
  const target = new EventTarget();
  let received;
  await loadUntilPageHide(target, async (signal) => {
    received = signal;
    return 'hecho';
  });
  target.dispatchEvent(new Event('pagehide'));
  assert.equal(received.aborted, false);
});

test('the pagehide listener is removed once the load ends', async () => {
  const target = new EventTarget();
  const added = [];
  const removed = [];
  const spyTarget = {
    addEventListener: (type, listener) => {
      added.push({ type, listener });
      target.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) => {
      removed.push({ type, listener });
      target.removeEventListener(type, listener);
    },
  };
  await loadUntilPageHide(spyTarget, async () => 'hecho');
  assert.equal(added.length, 1);
  assert.equal(added[0].type, 'pagehide');
  assert.deepEqual(removed, [{ type: 'pagehide', listener: added[0].listener }]);
});

test('a load that rejects without abort propagates the error', async () => {
  const target = new EventTarget();
  const failure = new Error('fallo');
  await assert.rejects(
    loadUntilPageHide(target, async () => {
      throw failure;
    }),
    failure,
  );
});

test('a load that rejects after pagehide returns null', async () => {
  const target = new EventTarget();
  const pending = deferred();
  const loading = loadUntilPageHide(target, () => pending.promise);
  target.dispatchEvent(new Event('pagehide'));
  pending.reject(new DOMException('cancelada', 'AbortError'));
  assert.equal(await loading, null);
});
