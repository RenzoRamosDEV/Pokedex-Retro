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
    modelOpenai: fakeElement('select'),
    provider: fakeElement('select'),
  };
  elements.stop.disabled = true;
  const { model, modelOpenai, provider, ...rest } = elements;
  const selectors = [provider, model, modelOpenai];
  return { elements, view: createChatView({ document, ...rest, selectors }) };
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
    view.showKeyError('formato');
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

  test('busy mode also disables the provider and both model selectors', () => {
    const { elements, view } = setup();
    view.setBusy(true);
    assert.deepEqual(
      ['provider', 'model', 'modelOpenai'].map((name) => elements[name].disabled),
      [true, true, true],
    );
    view.setBusy(false);
    assert.deepEqual(
      ['provider', 'model', 'modelOpenai'].map((name) => elements[name].disabled),
      [false, false, false],
    );
  });

  for (const [proveedor, motivo, expected] of [
    ['anthropic', 'formato', 'La clave debe empezar por sk-ant-.'],
    ['anthropic', 'otro_proveedor', 'Esa clave parece de OpenAI. Elige OpenAI en PROVEEDOR.'],
    ['openai', 'formato', 'La clave de OpenAI debe empezar por sk-.'],
    [
      'openai',
      'otro_proveedor',
      'Esa clave es de Anthropic. Elige Claude (Anthropic) en PROVEEDOR.',
    ],
  ]) {
    test(`shows the ${motivo} key error for ${proveedor}`, () => {
      const { elements, view } = setup();
      view.setProvider(proveedor);
      view.showKeyError(motivo);
      assert.equal(elements.status.textContent, expected);
    });
  }

  test('labels the OpenAI replies OPENAI and shows its refusal', () => {
    const { elements, view } = setup();
    view.setProvider('openai');
    view.startReply();
    view.appendText('<b>hola</b>');
    assert.deepEqual(message(elements.log.children[0]), {
      tagName: 'div',
      className: 'chat-message chat-message--openai',
      author: 'OPENAI',
      text: '<b>hola</b>',
    });
    view.showRefusal();
    assert.equal(elements.status.textContent, 'OpenAI no puede responder a esta petición.');
  });

  for (const [error, expected] of [
    [{ codigo: 'clave_invalida' }, 'Clave de OpenAI no válida. Revísala en platform.openai.com.'],
    [{ codigo: 'sin_saldo' }, 'Tu cuenta de OpenAI no tiene saldo.'],
    [
      { codigo: 'rechazada', estado: 0 },
      'OpenAI rechazó la petición. Revisa el saldo y los límites de tu cuenta en platform.openai.com.',
    ],
    [{ codigo: 'saturado' }, 'OpenAI está saturado. Inténtalo en unos minutos.'],
    [{ codigo: 'red' }, 'Sin conexión con OpenAI.'],
    [{ codigo: 'servidor', estado: 500, detalle: 'fallo' }, 'Error de OpenAI (500): fallo'],
    [{ codigo: 'permiso' }, 'Tu clave no tiene permiso para este modelo.'],
    [{ codigo: 'peticion', detalle: 'Bad schema' }, 'Petición no válida: Bad schema'],
    [{ codigo: 'limite_uso' }, 'Límite de uso alcanzado. Espera un momento.'],
  ]) {
    test(`shows the OpenAI ${error.codigo} error`, () => {
      const { elements, view } = setup();
      view.setProvider('openai');
      view.showError(error);
      assert.equal(elements.status.textContent, expected);
    });
  }

  test('OpenAI keeps the shared limit, cut and token texts', () => {
    const { elements, view } = setup();
    view.setProvider('openai');
    view.startReply();
    view.showCut();
    assert.equal(message(elements.log.children[0]).text, ' (respuesta cortada por longitud)');
    view.showUsage({ entrada: 300, salida: 50 });
    assert.equal(elements.log.children[1].textContent, 'Tokens: 300 entrada · 50 salida');
    view.showLimit();
    assert.equal(
      elements.status.textContent,
      'He alcanzado el límite de consultas para esta pregunta.',
    );
  });

  test('going back to anthropic restores the Claude texts', () => {
    const { elements, view } = setup();
    view.setProvider('openai');
    view.setProvider('anthropic');
    view.startReply();
    assert.deepEqual(
      [message(elements.log.children[0]).author, elements.log.children[0].className],
      ['CLAUDE', 'chat-message chat-message--claude'],
    );
    view.showError({ codigo: 'clave_invalida' });
    assert.equal(
      elements.status.textContent,
      'Clave no válida. Revísala en console.anthropic.com.',
    );
    view.showError({ codigo: 'servidor', estado: 502 });
    assert.equal(elements.status.textContent, 'Error de Claude (502). Inténtalo de nuevo.');
    view.showRefusal();
    assert.equal(elements.status.textContent, 'Claude no puede responder a esta petición.');
  });

  test('shows the subagent at work in the status region', () => {
    const { elements, view } = setup();
    view.showSubagent('estratega-tipos');
    assert.equal(elements.status.textContent, 'SUBAGENTE: estratega-tipos');
    view.clearStatus();
    assert.equal(elements.status.textContent, '');
  });

  test('shows the loaded skill in the status region', () => {
    const { elements, view } = setup();
    view.showSkill('comparar-pokemon');
    assert.equal(elements.status.textContent, 'SKILL: comparar-pokemon');
    view.clearStatus();
    assert.equal(elements.status.textContent, '');
  });
});
