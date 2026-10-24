import { responder } from '../chat/bucle.js';
import {
  CLAVES_ALMACENAMIENTO,
  guardarClave,
  leerClave,
  olvidarClave,
  validarClave,
} from '../chat/clave.js';
import { PROVEEDORES, PROVEEDOR_POR_DEFECTO } from '../chat/proveedores/index.js';
import { createChatView } from './chat-view.js';
import { STRINGS } from './strings.js';
import { createPokeApiPort, startPage, storageOrNull } from './arranque.js';

const byId = (id) => document.getElementById(id);
const keyForm = document.querySelector('[data-clave-form]');
const chat = document.querySelector('[data-chat]');
const questionForm = document.querySelector('[data-pregunta-form]');
const keyInput = byId('chat-clave');
const remember = byId('chat-recordar');
const providerSelect = byId('chat-proveedor');
const models = { anthropic: byId('chat-modelo'), openai: byId('chat-modelo-openai') };
const modelGroups = {
  anthropic: document.querySelector('[data-modelos="anthropic"]'),
  openai: document.querySelector('[data-modelos="openai"]'),
};
const keyLabel = document.querySelector('[data-clave-etiqueta]');
const KEY_LABELS = { anthropic: STRINGS.chat.claveAnthropic, openai: STRINGS.chat.claveOpenai };
const question = byId('chat-mensaje');
const stopButton = byId('chat-detener');

const storages = {
  session: storageOrNull('sessionStorage'),
  local: storageOrNull('localStorage'),
};
const view = createChatView({
  document,
  log: document.querySelector('[data-registro]'),
  status: document.querySelector('[data-estado]'),
  send: byId('chat-enviar'),
  stop: stopButton,
  reset: byId('chat-nueva'),
  selectors: [providerSelect, models.anthropic, models.openai],
});
const pokeApiPort = createPokeApiPort();

let provider = PROVEEDOR_POR_DEFECTO;
/** Keys also live in memory, per provider, so the chat works when storage throws. */
const apiKeys = {
  anthropic: leerClave(storages, CLAVES_ALMACENAMIENTO.anthropic),
  openai: leerClave(storages, CLAVES_ALMACENAMIENTO.openai),
};
let conversation = [];
let controller = null;
let replyStarted = false;

function showChat(hasKey) {
  keyForm.hidden = hasKey;
  chat.hidden = !hasKey;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

function ensureReply() {
  if (!replyStarted) view.startReply();
  replyStarted = true;
}

function onEvent(event) {
  if (event.tipo === 'texto') {
    view.clearStatus();
    ensureReply();
    view.appendText(event.texto);
  } else if (event.tipo === 'herramienta') {
    view.showTool(event.nombre);
  } else {
    view.showUsage(event.uso);
  }
}

const OUTCOMES = {
  fin: () => view.clearStatus(),
  cortada: () => {
    view.clearStatus();
    ensureReply();
    view.showCut();
  },
  rechazo: () => view.showRefusal(),
  limite: () => view.showLimit(),
  error: (result) => view.showError(result.error),
  abortada: () => view.clearStatus(),
};

async function ask(text) {
  controller = new AbortController();
  const { signal } = controller;
  replyStarted = false;
  view.clearStatus();
  view.addUserMessage(text);
  view.setBusy(true);
  const result = await responder({
    mensajes: conversation,
    pregunta: text,
    modelo: models[provider].value,
    clave: apiKeys[provider],
    proveedor: PROVEEDORES[provider],
    fetch: (url, init) => window.fetch(url, init),
    port: pokeApiPort(signal),
    signal,
    esperar: (ms) => wait(ms, signal),
    alEvento: onEvent,
  });
  if (controller?.signal === signal) {
    conversation = result.mensajes;
    OUTCOMES[result.estado](result);
    controller = null;
    view.setBusy(false);
    question.focus();
  }
}

function send() {
  const text = question.value.trim();
  if (controller !== null || text === '') return;
  question.value = '';
  ask(text);
}

function resetConversation() {
  conversation = [];
  view.clear();
}

keyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  const validity = validarClave(provider, key);
  if (validity !== 'ok') {
    view.showKeyError(validity);
    return;
  }
  guardarClave(storages, key, remember.checked, CLAVES_ALMACENAMIENTO[provider]);
  apiKeys[provider] = key;
  keyInput.value = '';
  view.clearStatus();
  showChat(true);
  question.focus();
});

questionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  send();
});

question.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

stopButton.addEventListener('click', () => controller?.abort());
byId('chat-nueva').addEventListener('click', () => {
  resetConversation();
  question.focus();
});
Object.values(models).forEach((select) => select.addEventListener('change', resetConversation));

function showProvider() {
  Object.entries(modelGroups).forEach(([id, group]) => {
    group.hidden = id !== provider;
  });
  keyLabel.textContent = KEY_LABELS[provider];
  view.setProvider(provider);
  showChat(apiKeys[provider] !== null);
}

providerSelect.addEventListener('change', () => {
  provider = providerSelect.value;
  resetConversation();
  showProvider();
});
byId('chat-olvidar').addEventListener('click', () => {
  controller?.abort();
  controller = null;
  olvidarClave(storages, CLAVES_ALMACENAMIENTO[provider]);
  apiKeys[provider] = null;
  resetConversation();
  view.setBusy(false);
  showChat(false);
  keyInput.focus();
});

startPage();
providerSelect.value = provider;
showProvider();
