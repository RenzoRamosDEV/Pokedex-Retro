// @ts-check

/**
 * The visitor's key of each provider in the browser: `sessionStorage` by default, `localStorage` when
 * remembered. Storage may be missing or throw (privacy modes); that never breaks the chat.
 * @typedef {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void }} Almacen
 * @typedef {{ session: Almacen | null, local: Almacen | null }} Almacenes
 */

export const CLAVE_ALMACENAMIENTO = 'pokedex:chat:apikey';

/** The Anthropic key keeps its 1.2.0 storage key, so remembered keys still work. */
export const CLAVES_ALMACENAMIENTO = {
  anthropic: CLAVE_ALMACENAMIENTO,
  openai: 'pokedex:chat:apikey:openai',
};

const PREFIJO = 'sk-ant-';
const PREFIJO_OPENAI = 'sk-';

/** @param {string} texto */
export const esClaveValida = (texto) => texto.trim().startsWith(PREFIJO);

/**
 * Anthropic keys also start with `sk-`, so each provider tells a key of the other one apart.
 * @param {'anthropic' | 'openai'} proveedor
 * @param {string} texto
 * @returns {'ok' | 'formato' | 'otro_proveedor'}
 */
export function validarClave(proveedor, texto) {
  const limpia = texto.trim();
  if (!limpia.startsWith(PREFIJO_OPENAI)) return 'formato';
  const deAnthropic = limpia.startsWith(PREFIJO);
  return deAnthropic === (proveedor === 'anthropic') ? 'ok' : 'otro_proveedor';
}

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

/**
 * @param {Almacenes} almacenes
 * @param {string} [nombre] storage key, the Anthropic one by default
 */
export function leerClave({ session, local }, nombre = CLAVE_ALMACENAMIENTO) {
  return seguro(() => session.getItem(nombre)) ?? seguro(() => local.getItem(nombre));
}

/**
 * Writes one storage and clears the other, so unchecking «remember» drops the lasting copy.
 * @param {Almacenes} almacenes
 * @param {string} clave
 * @param {boolean} recordar
 * @param {string} [nombre] storage key, the Anthropic one by default
 */
export function guardarClave({ session, local }, clave, recordar, nombre = CLAVE_ALMACENAMIENTO) {
  const [destino, otro] = recordar ? [local, session] : [session, local];
  seguro(() => destino.setItem(nombre, clave));
  seguro(() => otro.removeItem(nombre));
}

/**
 * @param {Almacenes} almacenes
 * @param {string} [nombre] storage key, the Anthropic one by default
 */
export function olvidarClave({ session, local }, nombre = CLAVE_ALMACENAMIENTO) {
  seguro(() => session.removeItem(nombre));
  seguro(() => local.removeItem(nombre));
}
