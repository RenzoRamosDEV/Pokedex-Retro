import { test } from 'node:test';
import assert from 'node:assert/strict';

const THEMES = ['normal', 'gb', 'gray'];

function createFakeDocument() {
  const documentListeners = [];
  const dispatch = (listeners, event) => listeners.forEach((listener) => listener(event));

  function createElement(dataset = {}) {
    const classes = new Set();
    const listeners = [];
    return {
      hidden: true,
      dataset,
      classList: {
        toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
        contains: (name) => classes.has(name),
      },
      addEventListener: (type, listener) => {
        if (type === 'click') listeners.push(listener);
      },
      click() {
        let stopped = false;
        const event = { stopPropagation: () => (stopped = true) };
        dispatch(listeners, event);
        if (!stopped) dispatch(documentListeners, event);
      },
    };
  }

  const elements = {
    'theme-btn': createElement(),
    'theme-dropdown': createElement(),
    'info-btn': createElement(),
    'info-dropdown': createElement(),
  };
  const options = THEMES.map((value) => createElement({ value }));
  return {
    body: { dataset: {} },
    options,
    elements,
    getElementById: (id) => elements[id] ?? null,
    querySelectorAll: (selector) => (selector === '.theme-option' ? options : []),
    addEventListener: (type, listener) => {
      if (type === 'click') documentListeners.push(listener);
    },
    clickOutside: () => dispatch(documentListeners, { stopPropagation() {} }),
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

test('choosing gray applies, persists and hides the dropdown', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  const storage = createMapStorage();
  initTheme(doc, storage);
  doc.elements['theme-btn'].click();
  assert.equal(doc.elements['theme-dropdown'].hidden, false);
  doc.options[2].click();
  assert.equal(doc.body.dataset.theme, 'gray');
  assert.equal(storage.map.get('theme'), 'gray');
  assert.deepEqual(activeOptions(doc), ['gray']);
  assert.equal(doc.elements['theme-dropdown'].hidden, true);
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

test('the theme button toggles the dropdown', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage());
  const dropdown = doc.elements['theme-dropdown'];
  assert.equal(dropdown.hidden, true);
  doc.elements['theme-btn'].click();
  assert.equal(dropdown.hidden, false);
  doc.elements['theme-btn'].click();
  assert.equal(dropdown.hidden, true);
});

test('the info button toggles its panel and closes the theme dropdown', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage());
  const panel = doc.elements['info-dropdown'];
  doc.elements['theme-btn'].click();
  doc.elements['info-btn'].click();
  assert.equal(panel.hidden, false);
  assert.equal(doc.elements['theme-dropdown'].hidden, true);
  doc.elements['info-btn'].click();
  assert.equal(panel.hidden, true);
});

test('a click on the document closes both panels', async () => {
  const initTheme = await loadInitTheme();
  const doc = createFakeDocument();
  initTheme(doc, createMapStorage());
  doc.elements['info-btn'].click();
  doc.elements['theme-btn'].click();
  assert.equal(doc.elements['theme-dropdown'].hidden, false);
  doc.clickOutside();
  assert.equal(doc.elements['theme-dropdown'].hidden, true);
  assert.equal(doc.elements['info-dropdown'].hidden, true);
});
