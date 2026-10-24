import { STRINGS } from './strings.js';

const ERROR_TEXTS = {
  clave_invalida: STRINGS.chat.errorClave,
  permiso: STRINGS.chat.errorPermiso,
  peticion: STRINGS.chat.errorPeticion,
  demasiado_larga: STRINGS.chat.errorLongitud,
  limite_uso: STRINGS.chat.errorLimiteUso,
  saturado: STRINGS.chat.errorSaturado,
  red: STRINGS.chat.errorRed,
  servidor: STRINGS.chat.errorServidor,
};

/**
 * Chat conversation view. Every text goes through `textContent`, so nothing from the model,
 * the user or a tool is ever parsed as HTML.
 */
export function createChatView({ document, log, status, send, stop, reset, model }) {
  let replyText = null;

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
    addUserMessage(text) {
      addMessage('user', STRINGS.chat.tu).textContent = text;
    },
    startReply() {
      replyText = addMessage('claude', STRINGS.chat.claude);
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
        ERROR_TEXTS[codigo].replace('{detalle}', detalle).replace('{estado}', String(estado)),
      );
    },
    showLimit: () => showStatus(STRINGS.chat.limite),
    showRefusal: () => showStatus(STRINGS.chat.rechazo),
    showKeyFormatError: () => showStatus(STRINGS.chat.claveFormato),
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
      model.disabled = busy;
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
