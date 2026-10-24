// @ts-check

/** Models offered in the chat; `fallback` marks those that accept server-side fallbacks. */
export const MODELOS = [
  { id: 'claude-opus-5-5', fallback: true },
  { id: 'claude-sonnet-5-5', fallback: true },
  { id: 'claude-haiku-5-5', fallback: false },
];

export const MODELO_POR_DEFECTO = 'claude-opus-5-5';
