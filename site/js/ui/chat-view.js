import { STRINGS } from './strings.js';

const TEXTS = {
  anthropic: STRINGS.chat,
  openai: { ...STRINGS.chat, ...STRINGS.chatOpenai },
};

const REPLY_MODIFIERS = { anthropic: 'claude', openai: 'openai' };

const ERROR_KEYS = {
  clave_invalida: 'errorClave',
  permiso: 'errorPermiso',
  peticion: 'errorPeticion',
  demasiado_larga: 'errorLongitud',
  limite_uso: 'errorLimiteUso',
  sin_saldo: 'errorSinSaldo',
  rechazada: 'errorRechazada',
  saturado: 'errorSaturado',
  red: 'errorRed',
  servidor: 'errorServidor',
};

const KEY_ERROR_KEYS = { formato: 'claveFormato', otro_proveedor: 'otroProveedor' };

/**
 * Chat conversation view. Every text goes through `textContent`, so nothing from the model,
 * the user or a tool is ever parsed as HTML.
 */
export function createChatView({ document, log, status, send, stop, reset, selectors }) {
  let replyText = null;
  let providerId = 'anthropic';
  const texts = () => TEXTS[providerId];

  function addMessage(modifier, author) {
    const message = document.createElement('div');
    message.className = `chat-message chat-message--${modifier}`;
    const authorLine = document.createElement('p');
    authorLine.className = 'chat-author';
    authorLine.textContent = author;
    const text = document.createElement('p');
    text.className = 'chat-text';
    message.append(authorLine, text);
    log.append(message);
    return text;
  }

  const showStatus = (text) => {
    status.textContent = text;
  };

  return {
    setProvider(id) {
      providerId = id;
    },
    addUserMessage(text) {
      addMessage('user', STRINGS.chat.tu).textContent = text;
    },
    startReply() {
      replyText = addMessage(REPLY_MODIFIERS[providerId], texts().asistente);
    },
    appendText(text) {
      replyText.textContent += text;
    },
    showCut() {
      replyText.textContent += STRINGS.chat.cortada;
    },
    showTool(name) {
      showStatus(STRINGS.chat.consultando.replace('{nombre}', name));
    },
    showError({ codigo, detalle, estado }) {
      showStatus(
        texts()
          [ERROR_KEYS[codigo]].replace('{detalle}', detalle)
          .replace('{estado}', String(estado)),
      );
    },
    showLimit: () => showStatus(STRINGS.chat.limite),
    showRefusal: () => showStatus(texts().rechazo),
    showKeyError: (motivo) => showStatus(texts()[KEY_ERROR_KEYS[motivo]]),
    clearStatus: () => showStatus(''),
    showUsage({ entrada, salida }) {
      const line = document.createElement('p');
      line.className = 'chat-usage';
      line.textContent = STRINGS.chat.tokens
        .replace('{entrada}', String(entrada))
        .replace('{salida}', String(salida));
      log.append(line);
    },
    setBusy(busy) {
      send.disabled = busy;
      selectors.forEach((selector) => {
        selector.disabled = busy;
      });
      reset.disabled = busy;
      stop.disabled = !busy;
    },
    clear() {
      log.replaceChildren();
      replyText = null;
      showStatus('');
    },
  };
}
