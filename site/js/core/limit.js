// @ts-check

/**
 * @param {number} max
 * @returns {<T>(task: () => Promise<T>) => Promise<T>}
 */
export function createLimit(max) {
  if (!Number.isInteger(max) || max < 1) throw new RangeError(`Invalid limit: ${max}`);
  /** @type {Array<() => void>} */
  const queue = [];
  let active = 0;

  const startNext = () => {
    if (active >= max || queue.length === 0) return;
    active += 1;
    queue.shift()();
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push(() => {
        new Promise((resolveTask) => resolveTask(task())).then(resolve, reject).finally(() => {
          active -= 1;
          startNext();
        });
      });
      startNext();
    });
}
