// @ts-check
import { DEFINICIONES } from './herramientas.js';
import { MODELOS } from './modelos.js';

const URL_MENSAJES = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2026-10-21';
const BETA_FALLBACK = 'server-side-fallback-2026-07-01';
const MAX_TOKENS = 8000;

/** Fixed text, with no date or other variable data, so the cached prefix stays stable. */
export const SISTEMA =
  'Eres el asistente de la Pokédex Retro, una web con datos de PokéAPI sobre Pokémon, movimientos, habilidades, objetos, bayas, tipos y naturalezas. Usa siempre las herramientas para obtener cualquier dato de la Pokédex y no respondas de memoria; los nombres van en inglés, como en PokéAPI. Responde en español y en texto plano, sin Markdown ni HTML.';

/**
 * Streaming Messages API request; the key goes only in the `x-api-key` header.
 * @param {{ modelo: string, clave: string, mensajes: object[] }} datos
 */
export function construirPeticion({ modelo, clave, mensajes }) {
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
    system: SISTEMA,
    tools: DEFINICIONES,
    messages: mensajes,
    output_config: { effort: 'low' },
    cache_control: { type: 'ephemeral' },
    ...(conFallback ? { fallbacks: 'default' } : {}),
  };
  return { url: URL_MENSAJES, opciones: { method: 'POST', headers, body: JSON.stringify(cuerpo) } };
}
