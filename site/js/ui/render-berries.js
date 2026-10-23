import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';

const berryStat = (label, value) => `
          <div class="berry-stat">
            <span class="berry-stat-label">${label}</span>
            <span class="berry-stat-value">${value}</span>
          </div>`;

function berryFlavors(berry) {
  const flavors = berry.flavors.filter((f) => f.potency > 0);
  if (flavors.length === 0) return '';
  const badges = flavors
    .map(
      (f) =>
        `<span class="berry-flavor flavor-${escapeHtml(f.flavor)}">${upper(f.flavor)} ${escapeHtml(f.potency)}</span>`,
    )
    .join('\n');
  return `<div class="berry-flavors">${badges}</div>`;
}

const berryCard = (berry) => `
      <div class="berry-card">
        <div class="berry-card-top">
          <span class="berry-id">#${escapeHtml(berry.id)}</span>
          <span class="type-badge type-${escapeHtml(berry.naturalGiftType)}">${upper(berry.naturalGiftType)}</span>
        </div>
        <h3 class="berry-name">${upper(berry.name)} BERRY</h3>
        <div class="berry-stats">
          ${berryStat('CRECIM.', `${escapeHtml(berry.growthTime)} H`)}
          ${berryStat('COSECHA', `x${escapeHtml(berry.maxHarvest)}`)}
          ${berryStat('POD.NAT.', escapeHtml(berry.naturalGiftPower))}
          ${berryStat('SUAVIDAD', escapeHtml(berry.smoothness))}
          ${berryStat('FIRMEZA', upper(berry.firmness))}
        </div>
        ${berryFlavors(berry)}
      </div>`;

export const berriesView = {
  title: 'BAYAS',
  searchable: true,
  renderItems: (berries) => `
  <div class="berries-grid">
    ${berries.map(berryCard).join('')}
  </div>`,
};
