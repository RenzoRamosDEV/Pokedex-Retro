import { responder } from '../chat/bucle.js';
import { esClaveValida, guardarClave, leerClave, olvidarClave } from '../chat/clave.js';
import { createChatView } from './chat-view.js';
import { createPokeApiPort, startPage, storageOrNull } from './arranque.js';

const byId = (id) => document.getElementById(id);
const keyForm = document.querySelector('[data-clave-form]');
const chat = document.querySelector('[data-chat]');
const questionForm = document.querySelector('[data-pregunta-form]');
const keyInput = byId('chat-clave');
const remember = byId('chat-recordar');
const model = byId('chat-modelo');
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
  selectors: [model],
});
const pokeApiPort = createPokeApiPort();

/** The key also lives in this variable, so the chat works when storage throws. */
let apiKey = leerClave(storages);
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
    modelo: model.value,
    clave: apiKey,
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
  if (!esClaveValida(key)) {
    view.showKeyError('formato');
    return;
  }
  guardarClave(storages, key, remember.checked);
  apiKey = key;
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
model.addEventListener('change', resetConversation);
byId('chat-olvidar').addEventListener('click', () => {
  controller?.abort();
  controller = null;
  olvidarClave(storages);
  apiKey = null;
  resetConversation();
  view.setBusy(false);
  showChat(false);
  keyInput.focus();
});

startPage();
showChat(apiKey !== null);
