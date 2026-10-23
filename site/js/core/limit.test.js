import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimit } from './limit.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function createTasks(count) {
  const state = { active: 0, maxActive: 0, started: [] };
  const handles = Array.from({ length: count }, () => deferred());
  const tasks = handles.map((handle, index) => () => {
    state.active += 1;
    state.maxActive = Math.max(state.maxActive, state.active);
    state.started.push(index);
    return handle.promise.finally(() => {
      state.active -= 1;
    });
  });
  return { state, handles, tasks };
}

test('18 tasks with a limit of 6 never exceed 6 at once and all complete', async () => {
  const run = createLimit(6);
  const { state, handles, tasks } = createTasks(18);
  const results = Promise.all(tasks.map((task) => run(task)));
  await flush();
  assert.equal(state.active, 6);
  for (const [index, handle] of handles.entries()) {
    handle.resolve(index);
    await flush();
  }
  assert.deepEqual(
    await results,
    Array.from({ length: 18 }, (_, index) => index),
  );
  assert.equal(state.maxActive, 6);
});

test('finishing a task starts exactly the next queued one in FIFO order', async () => {
  const run = createLimit(2);
  const { state, handles, tasks } = createTasks(5);
  tasks.forEach((task) => run(task));
  await flush();
  assert.deepEqual(state.started, [0, 1]);
  handles[1].resolve();
  await flush();
  assert.deepEqual(state.started, [0, 1, 2]);
  handles[0].resolve();
  await flush();
  assert.deepEqual(state.started, [0, 1, 2, 3]);
});

test('a rejected task frees its slot and rejects with the same error', async () => {
  const run = createLimit(1);
  const { state, handles, tasks } = createTasks(2);
  const error = new Error('fallo');
  const first = run(tasks[0]);
  run(tasks[1]);
  await flush();
  assert.deepEqual(state.started, [0]);
  handles[0].reject(error);
  await assert.rejects(first, (thrown) => thrown === error);
  await flush();
  assert.deepEqual(state.started, [0, 1]);
});

test('a limit of 1 runs the tasks in series', async () => {
  const run = createLimit(1);
  const { state, handles, tasks } = createTasks(3);
  tasks.forEach((task) => run(task));
  for (const handle of handles) {
    await flush();
    assert.equal(state.active, 1);
    handle.resolve();
  }
  await flush();
  assert.deepEqual(state.started, [0, 1, 2]);
  assert.equal(state.maxActive, 1);
});

test('fewer tasks than the limit all start at once', async () => {
  const run = createLimit(6);
  const { state, tasks } = createTasks(4);
  tasks.forEach((task) => run(task));
  await flush();
  assert.equal(state.active, 4);
});

test('a task that throws synchronously becomes a rejection and frees its slot', async () => {
  const run = createLimit(1);
  const error = new Error('síncrono');
  const failed = run(() => {
    throw error;
  });
  await assert.rejects(failed, (thrown) => thrown === error);
  assert.equal(await run(async () => 'siguiente'), 'siguiente');
});

for (const max of [0, -1, 1.5, Number.NaN]) {
  test(`createLimit(${max}) throws RangeError`, () => {
    assert.throws(() => createLimit(max), { name: 'RangeError', message: `Invalid limit: ${max}` });
  });
}
