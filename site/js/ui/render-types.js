import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import { effectiveness } from '../mappers/type.js';
import { STRINGS } from './strings.js';

const CELL_SYMBOLS = { '2x': '×2', half: '½', 0: '✕', 1: '' };

const typeBadge = (type) =>
  `<span class="type-badge type-${escapeHtml(type.name)}">${upper(type.name)}</span>`;

function matrixRow(attacker, types) {
  const cells = types.map((defender) => {
    const eff = effectiveness(attacker, defender.name);
    return `<td class="matrix-cell eff-${eff}-cell">${CELL_SYMBOLS[eff]}</td>`;
  });
  return `
          <tr>
            <td class="matrix-row-header">
              ${typeBadge(attacker)}
            </td>
            ${cells.join('')}
          </tr>`;
}

export const typesView = {
  title: STRINGS.tipos.titulo,
  searchable: false,
  renderItems: (types) => `
  <div class="matrix-legend">
    <span class="matrix-legend-item eff-2x-cell">×2</span>
    <span class="matrix-legend-label">${STRINGS.tipos.superEfectivo}</span>
    <span class="matrix-legend-item eff-half-cell">½</span>
    <span class="matrix-legend-label">${STRINGS.tipos.noMuyEfectivo}</span>
    <span class="matrix-legend-item eff-0-cell">✕</span>
    <span class="matrix-legend-label">${STRINGS.tipos.inmune}</span>
    <span class="matrix-legend-item eff-1-cell">—</span>
    <span class="matrix-legend-label">${STRINGS.tipos.normal}</span>
  </div>

  <div class="matrix-scroll" tabindex="0" role="region" aria-label="${STRINGS.tipos.titulo}">
    <table class="type-matrix">
      <thead>
        <tr>
          <th class="matrix-corner">${STRINGS.tipos.esquina}</th>
          ${types.map((t) => `<th class="matrix-col-header">${typeBadge(t)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${types.map((attacker) => matrixRow(attacker, types)).join('')}
      </tbody>
    </table>
  </div>`,
};
