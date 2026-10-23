import { test } from 'node:test';
import assert from 'node:assert/strict';

const THEMES = ['normal', 'gb', 'gray'];

function createFakeDocument() {
  function createOption(value) {
    const classes = new Set();
    const listeners = [];
    return {
      dataset: { value },
      classList: {
        toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
        contains: (name) => classes.has(name),
      },
      addEventListener: (type, listener) => {
        if (type === 'click') listeners.push(listener);
      },
      click: () => listeners.forEach((listener) => listener({})),
    };
  }

  const options = THEMES.map(createOption);
  return {
    body: { dataset: {} },
    options,
    querySelectorAll: (selector) => (selector === '.theme-option' ? options : []),
  };
}

function createMapStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const throwingStorage = {
  getItem() {
    throw new DOMException('denegado', 'SecurityError');
  },
  setItem() {
    throw new DOMException('cuota', 'QuotaExceededError');
  },
};

const activeOptions = (doc) =>
  doc.options.filter((option) => option.classList.contains('active')).map((o) => o.dataset.value);

async function loadInitTheme() {
  const { initTheme } = await import('./theme.js');
  return initTheme;
}

test('importing theme.js without a DOM does not throw', async () => {
  assert.equal(globalThis.document, undefined);
  await assert.doesNotReject(import('./theme.js'));
});

test('a saved theme is applied and only its option is active', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage({ theme: 'gb' }));
  assert.equal(doc.body.dataset.theme, 'gb');
  assert.deepEqual(activeOptions(doc), ['gb']);
});

test('an empty storage falls back to normal', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage());
  assert.equal(doc.body.dataset.theme, 'normal');
  assert.deepEqual(activeOptions(doc), ['normal']);
});

test('an empty saved value falls back to normal', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage({ theme: '' }));
  assert.equal(doc.body.dataset.theme, 'normal');
});

test('a null storage falls back to normal', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, null);
  assert.equal(doc.body.dataset.theme, 'normal');
});

test('choosing gray applies and persists it', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  const storage = createMapStorage();
  initTheme(doc, storage);
  doc.options[2].click();
  assert.equal(doc.body.dataset.theme, 'gray');
  assert.equal(storage.map.get('theme'), 'gray');
  assert.deepEqual(activeOptions(doc), ['gray']);
});

test('a throwing storage still applies the chosen theme', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  assert.doesNotThrow(() => initTheme(doc, throwingStorage));
  assert.equal(doc.body.dataset.theme, 'normal');
  assert.doesNotThrow(() => doc.options[2].click());
  assert.equal(doc.body.dataset.theme, 'gray');
});

test('a null storage still applies the chosen theme', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, null);
  assert.doesNotThrow(() => doc.options[1].click());
  assert.equal(doc.body.dataset.theme, 'gb');
});
