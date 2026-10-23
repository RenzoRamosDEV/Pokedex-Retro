import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';

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
          ${moveStat('POW', move.power)}
          ${moveStat('ACC', move.accuracy)}
          ${moveStat('PP', move.pp)}
          ${moveStat('PRI', move.priority)}
        </div>
        ${move.shortEffect ? `<p class="move-effect">${escapeHtml(move.shortEffect)}</p>` : ''}
      </div>`;

export const movesView = {
  title: 'MOVIMIENTOS',
  searchable: true,
  renderItems: (moves) => `
  <div class="moves-grid">
    ${moves.map(moveCard).join('')}
  </div>`,
};
