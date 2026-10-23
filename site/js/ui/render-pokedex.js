import { escapeHtml } from '../core/html.js';
import { upper } from './layout.js';
import {
  typesBySlot,
  abilitiesBySlot,
  heightMeters,
  weightKilograms,
  primaryType,
  statBarWidth,
} from '../mappers/pokemon.js';

const typeBadges = (pokemon) => typesBySlot(pokemon)
  .map((t) => `<span class="type-badge type-${escapeHtml(t.typeName)}">${upper(t.typeName)}</span>`)
  .join('\n');

function sprite(pokemon, imageClass, missingClass, lazy) {
  if (pokemon.sprite === null) return `<div class="${missingClass}">?</div>`;
  const loading = lazy ? ' loading="lazy"' : '';
  return `<img src="${escapeHtml(pokemon.sprite)}" alt="${escapeHtml(pokemon.name)}" class="${imageClass}"${loading}>`;
}

const card = (pokemon) => `
<a href="#pokemon-${escapeHtml(pokemon.id)}" class="card-link" aria-label="Ver detalles de ${escapeHtml(pokemon.name)}">
  <article class="poke-card">
    <div class="card-top">
      <span class="card-number">#${escapeHtml(pokemon.id)}</span>
      <div class="card-sprite-wrap">
        ${sprite(pokemon, 'card-sprite', 'card-sprite-missing', true)}
      </div>
    </div>
    <div class="card-bottom">
      <h2 class="card-name">${upper(pokemon.name)}</h2>
      <div class="card-types">
        ${typeBadges(pokemon)}
      </div>
    </div>
  </article>
</a>`;

const abilityItem = (ability) => `
              <li class="ability-item${ability.isHidden ? ' hidden' : ''}">
                ${upper(ability.name)}
                ${ability.isHidden ? '<span class="hidden-tag">HIDDEN</span>' : ''}
              </li>`;

const statRow = (stat, typeName) => `
                <div class="stat-row">
                  <span class="stat-label">${upper(stat.name)}</span>
                  <span class="stat-value">${escapeHtml(stat.baseStat)}</span>
                  <div class="stat-bar-track">
                    <div class="stat-bar-fill type-${escapeHtml(typeName)}"
                         style="width: ${statBarWidth(stat.baseStat)}%"></div>
                  </div>
                </div>`;

const modal = (pokemon) => `
<div id="pokemon-${escapeHtml(pokemon.id)}" class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(pokemon.name)}">
  <div class="modal-backdrop">
    <a href="#" class="modal-close-area" aria-label="Cerrar"></a>
  </div>
  <div class="modal-panel">
    <a href="#" class="modal-close" aria-label="Cerrar">✕</a>

    <div class="modal-header">
      <span class="modal-number">#${escapeHtml(pokemon.id)}</span>
      <h2 class="modal-name">${upper(pokemon.name)}</h2>
    </div>

    <div class="modal-body">
      <div class="modal-sprite-col">
        ${sprite(pokemon, 'modal-sprite', 'modal-sprite-missing', false)}
        <div class="modal-types">
          ${typeBadges(pokemon)}
        </div>
      </div>

      <div class="modal-data-col">
        <section class="modal-section">
          <h3 class="section-title">INFO</h3>
          <table class="data-table">
            <tr>
              <td class="data-label">HEIGHT</td>
              <td class="data-value">${heightMeters(pokemon)} m</td>
            </tr>
            <tr>
              <td class="data-label">WEIGHT</td>
              <td class="data-value">${weightKilograms(pokemon)} kg</td>
            </tr>
            <tr>
              <td class="data-label">BASE EXP</td>
              <td class="data-value">${escapeHtml(pokemon.baseExperience ?? '—')}</td>
            </tr>
          </table>
        </section>

        <section class="modal-section">
          <h3 class="section-title">ABILITIES</h3>
          <ul class="ability-list">
            ${abilitiesBySlot(pokemon).map(abilityItem).join('')}
          </ul>
        </section>

        <section class="modal-section">
          <h3 class="section-title">BASE STATS</h3>
          <div class="stats-list">
            ${pokemon.stats.map((stat) => statRow(stat, primaryType(pokemon))).join('')}
          </div>
        </section>
      </div>
    </div>
  </div>
</div>`;

export const pokedexView = {
  title: 'POKEDEX',
  searchable: true,
  renderItems: (pokemons) => `
  <div class="pokedex-grid">
    ${pokemons.map(card).join('')}
  </div>`,
  renderOverlays: (pokemons) => pokemons.map(modal).join(''),
};
