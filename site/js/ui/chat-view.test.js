import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatView } from './chat-view.js';

/** Minimal DOM: elements keep their children and refuse any innerHTML write. */
function fakeElement(tagName) {
  const element = {
    tagName,
    className: '',
    textContent: '',
    disabled: false,
    children: [],
    append(...nodes) {
      element.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      element.children = nodes;
    },
  };
  Object.defineProperty(element, 'innerHTML', {
    get: () => '',
    set: () => {
      throw new Error('innerHTML no se usa');
    },
  });
  return element;
}

function setup() {
  const document = { createElement: fakeElement };
  const elements = {
    log: fakeElement('div'),
    status: fakeElement('p'),
    send: fakeElement('button'),
    stop: fakeElement('button'),
    reset: fakeElement('button'),
    model: fakeElement('select'),
  };
  elements.stop.disabled = true;
  return { elements, view: createChatView({ document, ...elements }) };
}

const message = (element) => ({
  tagName: element.tagName,
  className: element.className,
  author: element.children[0].textContent,
  text: element.children[1].textContent,
});

describe('createChatView', () => {
  test('adds the user message with the TÚ label', () => {
    const { elements, view } = setup();
    view.addUserMessage('¿Qué tipos le hacen x4 a Gyarados?');
    assert.deepEqual(message(elements.log.children[0]), {
      tagName: 'div',
      className: 'chat-message chat-message--user',
      author: 'TÚ',
      text: '¿Qué tipos le hacen x4 a Gyarados?',
    });
    assert.deepEqual(
      elements.log.children[0].children.map((child) => [child.tagName, child.className]),
      [
        ['p', 'chat-author'],
        ['p', 'chat-text'],
      ],
    );
  });

  test('writes the model text literally, without interpreting HTML or Markdown', () => {
    const { elements, view } = setup();
    view.startReply();
    view.appendText('<img src=x onerror=alert(1)> **negrita**');
    assert.deepEqual(message(elements.log.children[0]), {
      tagName: 'div',
      className: 'chat-message chat-message--claude',
      author: 'CLAUDE',
      text: '<img src=x onerror=alert(1)> **negrita**',
    });
  });

  test('shows the reply text as it arrives', () => {
    const { elements, view } = setup();
    view.startReply();
    view.appendText('Gyara');
    assert.equal(message(elements.log.children[0]).text, 'Gyara');
    view.appendText('dos');
    assert.equal(message(elements.log.children[0]).text, 'Gyarados');
  });

  test('appends text to the latest reply only', () => {
    const { elements, view } = setup();
    view.startReply();
    view.appendText('uno');
    view.startReply();
    view.appendText('dos');
    assert.deepEqual(
      elements.log.children.map((child) => message(child).text),
      ['uno', 'dos'],
    );
  });

  test('shows the tool being consulted in the status region', () => {
    const { elements, view } = setup();
    view.showTool('efectividad_tipos');
    assert.equal(elements.status.textContent, 'CONSULTANDO: efectividad_tipos');
    view.clearStatus();
    assert.equal(elements.status.textContent, '');
  });

  for (const [error, expected] of [
    [{ codigo: 'clave_invalida' }, 'Clave no válida. Revísala en console.anthropic.com.'],
    [{ codigo: 'permiso' }, 'Tu clave no tiene permiso para este modelo.'],
    [
      { codigo: 'peticion', detalle: 'max_tokens: too large' },
      'Petición no válida: max_tokens: too large',
    ],
    [{ codigo: 'demasiado_larga' }, 'La conversación es demasiado larga. Empieza una nueva.'],
    [{ codigo: 'limite_uso' }, 'Límite de uso alcanzado. Espera un momento.'],
    [{ codigo: 'saturado' }, 'Claude está saturado. Inténtalo en unos minutos.'],
    [{ codigo: 'red' }, 'Sin conexión con Claude.'],
    [{ codigo: 'servidor', estado: 500 }, 'Error de Claude (500). Inténtalo de nuevo.'],
  ]) {
    test(`shows the ${error.codigo} error`, () => {
      const { elements, view } = setup();
      view.showError(error);
      assert.equal(elements.status.textContent, expected);
    });
  }

  test('marks a reply cut by length', () => {
    const { elements, view } = setup();
    view.startReply();
    view.appendText('Larga');
    view.showCut();
    assert.equal(message(elements.log.children[0]).text, 'Larga (respuesta cortada por longitud)');
  });

  test('shows the iteration limit, the refusal and the key format error', () => {
    const { elements, view } = setup();
    view.showLimit();
    assert.equal(
      elements.status.textContent,
      'He alcanzado el límite de consultas para esta pregunta.',
    );
    view.showRefusal();
    assert.equal(elements.status.textContent, 'Claude no puede responder a esta petición.');
    view.showKeyFormatError();
    assert.equal(elements.status.textContent, 'La clave debe empezar por sk-ant-.');
  });

  test('adds the token usage line to the log', () => {
    const { elements, view } = setup();
    view.showUsage({ entrada: 310, salida: 50 });
    const [line] = elements.log.children;
    assert.deepEqual(
      [line.tagName, line.className, line.textContent],
      ['p', 'chat-usage', 'Tokens: 310 entrada · 50 salida'],
    );
  });

  test('busy mode disables sending, the model and a new conversation and enables stopping', () => {
    const { elements, view } = setup();
    view.setBusy(true);
    assert.deepEqual(
      ['send', 'model', 'reset', 'stop'].map((name) => elements[name].disabled),
      [true, true, true, false],
    );
    view.setBusy(false);
    assert.deepEqual(
      ['send', 'model', 'reset', 'stop'].map((name) => elements[name].disabled),
      [false, false, false, true],
    );
  });

  test('clears the log and the status', () => {
    const { elements, view } = setup();
    view.addUserMessage('hola');
    view.showRefusal();
    view.clear();
    assert.deepEqual(elements.log.children, []);
    assert.equal(elements.status.textContent, '');
  });
});
