// @ts-check

/** Block types the API says to leave out when they precede a mid-turn fallback. */
const ANTERIORES_OMITIDOS = ['thinking', 'redacted_thinking', 'tool_use'];

/**
 * Assistant turn as it must be sent back: unchanged except for the documented fallback rule
 * and tool uses whose streamed input did not parse, which go back with an empty object.
 * @param {any[]} content
 * @returns {any[]}
 */
export function bloquesParaHistorial(content) {
  const ultimoFallback = content.map((bloque) => bloque.type).lastIndexOf('fallback');
  return content
    .filter(
      (bloque, index) => index >= ultimoFallback || !ANTERIORES_OMITIDOS.includes(bloque.type),
    )
    .map(sinEntradaInvalida);
}

/** @param {any} bloque */
function sinEntradaInvalida(bloque) {
  if (!('entrada_invalida' in bloque)) return bloque;
  const { entrada_invalida, ...resto } = bloque;
  return { ...resto, input: {} };
}
