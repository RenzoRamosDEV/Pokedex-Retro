import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';

const abilityCard = (ability) => `
      <div class="ability-card">
        <div class="ability-card-left">
          <span class="ability-id">#${escapeHtml(ability.id)}</span>
          <h3 class="ability-card-name">${upper(ability.name)}</h3>
          <span class="ability-pokemon-count">${escapeHtml(ability.pokemonCount)} POKEMON</span>
        </div>
        <div class="ability-card-right">
          <p class="ability-card-effect">${escapeHtml(ability.shortEffect)}</p>
        </div>
      </div>`;

export const abilitiesView = {
  title: 'HABILIDADES',
  searchable: true,
  renderItems: (abilities) => `
  <div class="abilities-list">
    ${abilities.map(abilityCard).join('')}
  </div>`,
};
