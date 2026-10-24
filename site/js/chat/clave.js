// @ts-check

/**
 * The visitor's Anthropic key in the browser: `sessionStorage` by default, `localStorage` when
 * remembered. Storage may be missing or throw (privacy modes); that never breaks the chat.
 * @typedef {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void }} Almacen
 * @typedef {{ session: Almacen | null, local: Almacen | null }} Almacenes
 */

export const CLAVE_ALMACENAMIENTO = 'pokedex:chat:apikey';
const PREFIJO = 'sk-ant-';

/** @param {string} texto */
export const esClaveValida = (texto) => texto.trim().startsWith(PREFIJO);

/**
 * @template T
 * @param {() => T} operacion
 * @returns {T | null}
 */
function seguro(operacion) {
  try {
    return operacion();
  } catch {
    return null;
  }
}

/** @param {Almacenes} almacenes */
export function leerClave({ session, local }) {
  return (
    seguro(() => session.getItem(CLAVE_ALMACENAMIENTO)) ??
    seguro(() => local.getItem(CLAVE_ALMACENAMIENTO))
  );
}

/**
 * Writes one storage and clears the other, so unchecking «remember» drops the lasting copy.
 * @param {Almacenes} almacenes
 * @param {string} clave
 * @param {boolean} recordar
 */
export function guardarClave({ session, local }, clave, recordar) {
  const [destino, otro] = recordar ? [local, session] : [session, local];
  seguro(() => destino.setItem(CLAVE_ALMACENAMIENTO, clave));
  seguro(() => otro.removeItem(CLAVE_ALMACENAMIENTO));
}

/** @param {Almacenes} almacenes */
export function olvidarClave({ session, local }) {
  seguro(() => session.removeItem(CLAVE_ALMACENAMIENTO));
  seguro(() => local.removeItem(CLAVE_ALMACENAMIENTO));
}
