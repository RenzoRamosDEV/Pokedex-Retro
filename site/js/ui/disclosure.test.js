import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectDisclosures } from './disclosure.js';

function createFakeDocument() {
  const listeners = { click: [], keydown: [] };
  const dispatch = (type, event) => listeners[type].forEach((listener) => listener(event));
  const document = {
    activeElement: null,
    addEventListener: (type, listener) => listeners[type]?.push(listener),
    getElementById: (id) => elements[id] ?? null,
    clickOutside: () => dispatch('click', { stopPropagation() {} }),
    press: (key) => dispatch('keydown', { key }),
  };

  function createButton() {
    const attributes = {};
    const clickListeners = [];
    const button = {
      attributes,
      setAttribute: (name, value) => (attributes[name] = value),
      focus: () => (document.activeElement = button),
      addEventListener: (type, listener) => type === 'click' && clickListeners.push(listener),
      click() {
        let stopped = false;
        const event = { stopPropagation: () => (stopped = true) };
        clickListeners.forEach((listener) => listener(event));
        if (!stopped) dispatch('click', event);
      },
    };
    return button;
  }

  function createPanel() {
    const child = { focus: () => (document.activeElement = child) };
    return { hidden: true, child, contains: (element) => element === child };
  }

  const elements = {
    'theme-btn': createButton(),
    'theme-dropdown': createPanel(),
    'info-btn': createButton(),
    'info-dropdown': createPanel(),
  };
  return { document, elements };
}

const PAIRS = [
  { button: 'theme-btn', panel: 'theme-dropdown' },
  { button: 'info-btn', panel: 'info-dropdown' },
];

function connect() {
  const page = createFakeDocument();
  connectDisclosures(page.document, PAIRS);
  const { elements } = page;
  return {
    ...page,
    theme: { button: elements['theme-btn'], panel: elements['theme-dropdown'] },
    info: { button: elements['info-btn'], panel: elements['info-dropdown'] },
  };
}

const expanded = (disclosure) => disclosure.button.attributes['aria-expanded'];

test('connecting reflects the hidden panels as aria-expanded="false"', () => {
  const { theme, info } = connect();
  assert.equal(expanded(theme), 'false');
  assert.equal(expanded(info), 'false');
});

test('connecting reflects an already visible panel as aria-expanded="true"', () => {
  const page = createFakeDocument();
  page.elements['info-dropdown'].hidden = false;
  connectDisclosures(page.document, PAIRS);
  assert.equal(page.elements['info-btn'].attributes['aria-expanded'], 'true');
  assert.equal(page.elements['theme-btn'].attributes['aria-expanded'], 'false');
});

test('the button toggles its panel and aria-expanded', () => {
  const { theme } = connect();
  theme.button.click();
  assert.equal(theme.panel.hidden, false);
  assert.equal(expanded(theme), 'true');
  theme.button.click();
  assert.equal(theme.panel.hidden, true);
  assert.equal(expanded(theme), 'false');
});

test('opening info with the theme panel open closes the theme panel', () => {
  const { theme, info } = connect();
  theme.button.click();
  info.button.click();
  assert.equal(info.panel.hidden, false);
  assert.equal(expanded(info), 'true');
  assert.equal(theme.panel.hidden, true);
  assert.equal(expanded(theme), 'false');
});

test('a click on the document closes every panel', () => {
  const { document, theme, info } = connect();
  info.button.click();
  document.clickOutside();
  assert.equal(info.panel.hidden, true);
  assert.equal(expanded(info), 'false');
  assert.equal(theme.panel.hidden, true);
});

test('a click on the document with focus inside the open panel moves focus to its button', () => {
  const { document, theme } = connect();
  theme.button.click();
  theme.panel.child.focus();
  document.clickOutside();
  assert.equal(theme.panel.hidden, true);
  assert.equal(document.activeElement, theme.button);
});

test('a click on the document with focus elsewhere leaves the focus alone', () => {
  const { document, theme, info } = connect();
  theme.button.click();
  info.panel.child.focus();
  document.clickOutside();
  assert.equal(document.activeElement, info.panel.child);
});

test('Escape closes the open panel and focuses its button', () => {
  const { document, theme, info } = connect();
  info.button.click();
  info.panel.child.focus();
  document.press('Escape');
  assert.equal(info.panel.hidden, true);
  assert.equal(expanded(info), 'false');
  assert.equal(document.activeElement, info.button);
  assert.equal(theme.panel.hidden, true);
});

test('Escape without an open panel changes nothing', () => {
  const { document, theme, info } = connect();
  document.press('Escape');
  assert.equal(document.activeElement, null);
  assert.equal(expanded(theme), 'false');
  assert.equal(expanded(info), 'false');
});

test('another key with an open panel changes nothing', () => {
  const { document, theme } = connect();
  theme.button.click();
  document.press('Enter');
  assert.equal(theme.panel.hidden, false);
  assert.equal(expanded(theme), 'true');
  assert.equal(document.activeElement, null);
});
