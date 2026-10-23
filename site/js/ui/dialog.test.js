import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectPokemonDialogs, dialogIdFromHash } from './dialog.js';

test('dialogIdFromHash turns #pokemon-25 into pokemon-25', () => {
  assert.equal(dialogIdFromHash('#pokemon-25'), 'pokemon-25');
  assert.equal(dialogIdFromHash('#pokemon-1'), 'pokemon-1');
});

for (const hash of [
  '',
  '#',
  '#pokemon-',
  '#pokemon-2a',
  '#otra-25',
  '#pokemon-25x',
  'pokemon-25',
  'x#pokemon-25',
]) {
  test(`dialogIdFromHash(${JSON.stringify(hash)}) is null`, () => {
    assert.equal(dialogIdFromHash(hash), null);
  });
}

function fakeElement({ tagName = 'DIV', id = '', closest = {} } = {}) {
  const element = {
    tagName,
    id,
    focusCount: 0,
    focus() {
      element.focusCount += 1;
    },
    closest: (selector) => closest[selector] ?? null,
  };
  return element;
}

function fakePage({ withDialog = true, withCard = true, hash = '' } = {}) {
  const listeners = [];
  const root = {
    addEventListener: (type, handler, capture = false) =>
      listeners.push({ type, handler, capture }),
  };
  const closeButton = fakeElement({ tagName: 'BUTTON' });
  const dialog = fakeElement({ tagName: 'DIALOG', id: 'pokemon-25' });
  dialog.calls = [];
  dialog.showModal = () => dialog.calls.push('showModal');
  dialog.close = () => {
    dialog.calls.push('close');
    dispatch('close', { target: dialog });
  };
  dialog.querySelector = (selector) => (selector === '[data-cerrar]' ? closeButton : null);
  closeButton.closest = (selector) =>
    ({ '[data-cerrar]': closeButton, dialog: dialog })[selector] ?? null;
  const card = fakeElement({ tagName: 'A' });
  card.getAttribute = (name) => (name === 'href' ? '#pokemon-25' : null);
  card.closest = (selector) => (selector === 'a.card-link' ? card : null);
  const insidePanel = fakeElement({ closest: { dialog } });
  const document = {
    getElementById: (id) => (withDialog && id === 'pokemon-25' ? dialog : null),
    querySelector: (selector) =>
      withCard && selector === 'a.card-link[href="#pokemon-25"]' ? card : null,
  };
  const history = { calls: [], replaceState: (...args) => history.calls.push(args) };
  const location = { pathname: '/index.html', search: '?q=pika', hash };

  function dispatch(type, event) {
    for (const listener of listeners.filter((candidate) => candidate.type === type)) {
      listener.handler(event);
    }
  }
  function click(target) {
    const event = {
      target,
      prevented: false,
      preventDefault() {
        event.prevented = true;
      },
    };
    dispatch('click', event);
    return event;
  }

  const connection = connectPokemonDialogs({ root, document, location, history });
  return { connection, listeners, dialog, closeButton, card, insidePanel, history, click };
}

test('a click on a card opens its dialog modally, focuses close and sets the hash', () => {
  const page = fakePage();
  const event = page.click(page.card);
  assert.equal(event.prevented, true);
  assert.deepEqual(page.dialog.calls, ['showModal']);
  assert.equal(page.closeButton.focusCount, 1);
  assert.deepEqual(page.history.calls, [[null, '', '#pokemon-25']]);
});

test('a click on the close button closes the dialog', () => {
  const page = fakePage();
  page.click(page.card);
  page.click(page.closeButton);
  assert.deepEqual(page.dialog.calls, ['showModal', 'close']);
});

test('a click whose target is the dialog itself (the backdrop) closes it', () => {
  const page = fakePage();
  page.click(page.card);
  page.click(page.dialog);
  assert.deepEqual(page.dialog.calls, ['showModal', 'close']);
});

test('a click inside the panel does not close the dialog nor prevent default', () => {
  const page = fakePage();
  page.click(page.card);
  const event = page.click(page.insidePanel);
  assert.deepEqual(page.dialog.calls, ['showModal']);
  assert.equal(event.prevented, false);
});

test('closing (Escape included) returns focus to the card and removes the hash', () => {
  const page = fakePage();
  page.click(page.card);
  page.dialog.close();
  assert.equal(page.card.focusCount, 1);
  assert.deepEqual(page.history.calls, [
    [null, '', '#pokemon-25'],
    [null, '', '/index.html?q=pika'],
  ]);
});

test('the close listener is registered in capture, since close does not bubble', () => {
  const page = fakePage();
  const close = page.listeners.filter((listener) => listener.type === 'close');
  assert.equal(close.length, 1);
  assert.equal(close[0].capture, true);
});

test('openFromHash opens the dialog named by a valid hash', () => {
  const page = fakePage({ hash: '#pokemon-25' });
  page.connection.openFromHash();
  assert.deepEqual(page.dialog.calls, ['showModal']);
  assert.equal(page.closeButton.focusCount, 1);
  assert.deepEqual(page.history.calls, [[null, '', '#pokemon-25']]);
});

for (const [label, options] of [
  ['the dialog is not on the page', { withDialog: false, hash: '#pokemon-25' }],
  ['the hash is invalid', { hash: '#pokemon-25x' }],
  ['there is no hash', { hash: '' }],
]) {
  test(`openFromHash does nothing when ${label}`, () => {
    const page = fakePage(options);
    assert.doesNotThrow(() => page.connection.openFromHash());
    assert.deepEqual(page.dialog.calls, []);
    assert.deepEqual(page.history.calls, []);
  });
}

test('closing when the card is gone still removes the hash without throwing', () => {
  const page = fakePage({ withCard: false });
  page.click(page.card);
  assert.doesNotThrow(() => page.dialog.close());
  assert.equal(page.card.focusCount, 0);
  assert.deepEqual(page.history.calls.at(-1), [null, '', '/index.html?q=pika']);
});
