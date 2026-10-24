// @ts-check
import { PROFESOR } from './agentes/profesor.js';
import { MODELOS } from './modelos.js';

const URL_MENSAJES = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2026-10-21';
const BETA_FALLBACK = 'server-side-fallback-2026-07-01';
const MAX_TOKENS = 8000;

/**
 * Streaming Messages API request; the key goes only in the `x-api-key` header.
 * @param {{ modelo: string, clave: string, mensajes: object[], sistema?: string, herramientas?: object[] }} datos
 */
export function construirPeticion({
  modelo,
  clave,
  mensajes,
  sistema = PROFESOR.sistema,
  herramientas = PROFESOR.herramientas,
}) {
  const conFallback = MODELOS.some((m) => m.id === modelo && m.fallback);
  /** @type {Record<string, string>} */
  const headers = {
    'content-type': 'application/json',
    'x-api-key': clave,
    'anthropic-version': VERSION_API,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (conFallback) headers['anthropic-beta'] = BETA_FALLBACK;
  const cuerpo = {
    model: modelo,
    max_tokens: MAX_TOKENS,
    stream: true,
    system: sistema,
    tools: herramientas,
    messages: mensajes,
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    ...(conFallback ? { fallbacks: 'default' } : {}),
  };
  return { url: URL_MENSAJES, opciones: { method: 'POST', headers, body: JSON.stringify(cuerpo) } };
}
