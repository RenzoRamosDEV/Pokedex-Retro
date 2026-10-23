import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import { STRINGS } from './strings.js';

const moveStat = (label, value) => `
          <div class="move-stat">
            <span class="move-stat-label">${label}</span>
            <span class="move-stat-value">${escapeHtml(value ?? '—')}</span>
          </div>`;

const moveCard = (move) => `
      <div class="move-card">
        <div class="move-card-top">
          <span class="move-id">#${escapeHtml(move.id)}</span>
          <span class="type-badge type-${escapeHtml(move.moveType)}">${upper(move.moveType)}</span>
          <span class="damage-class ${escapeHtml(move.damageClass)}">${upper(move.damageClass)}</span>
        </div>
        <h3 class="move-name">${upper(move.name)}</h3>
        <div class="move-stats">
          ${moveStat(STRINGS.movimientos.potencia, move.power)}
          ${moveStat(STRINGS.movimientos.precision, move.accuracy)}
          ${moveStat(STRINGS.movimientos.pp, move.pp)}
          ${moveStat(STRINGS.movimientos.prioridad, move.priority)}
        </div>
        ${move.shortEffect ? `<p class="move-effect">${escapeHtml(move.shortEffect)}</p>` : ''}
      </div>`;

export const movesView = {
  title: STRINGS.movimientos.titulo,
  searchable: true,
  renderItems: (moves) => `
  <div class="moves-grid">
    ${moves.map(moveCard).join('')}
  </div>`,
};
