import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import { effectiveness } from '../mappers/type.js';

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
  title: 'TABLA DE TIPOS',
  searchable: false,
  renderItems: (types) => `
  <div class="matrix-legend">
    <span class="matrix-legend-item eff-2x-cell">×2</span>
    <span class="matrix-legend-label">Súper efectivo</span>
    <span class="matrix-legend-item eff-half-cell">½</span>
    <span class="matrix-legend-label">No muy efectivo</span>
    <span class="matrix-legend-item eff-0-cell">✕</span>
    <span class="matrix-legend-label">Inmune</span>
    <span class="matrix-legend-item eff-1-cell">—</span>
    <span class="matrix-legend-label">Normal</span>
  </div>

  <div class="matrix-scroll">
    <table class="type-matrix">
      <thead>
        <tr>
          <th class="matrix-corner">ATK ╲ DEF</th>
          ${types.map((t) => `<th class="matrix-col-header">${typeBadge(t)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${types.map((attacker) => matrixRow(attacker, types)).join('')}
      </tbody>
    </table>
  </div>`,
};
