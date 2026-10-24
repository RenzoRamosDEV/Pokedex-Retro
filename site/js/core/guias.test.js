import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIA_COMPARAR, GUIA_EQUIPO } from './guias.js';

describe('GUIA_COMPARAR', () => {
  test('matches the 1.3.0 comparar_pokemon guide byte for byte', () => {
    assert.equal(
      GUIA_COMPARAR,
      'Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí. Resume en español quién tiene ventaja y por qué. Si alguno no existe, usa buscar_pokemon para encontrar el nombre exacto.',
    );
  });

  for (const herramienta of ['obtener_pokemon', 'efectividad_tipos', 'buscar_pokemon']) {
    test(`names ${herramienta}`, () => {
      assert.ok(GUIA_COMPARAR.includes(herramienta));
    });
  }
});

describe('GUIA_EQUIPO', () => {
  test('matches the 1.3.0 equipo_contra_tipo guide byte for byte', () => {
    assert.equal(
      GUIA_EQUIPO,
      'Usa efectividad_tipos para saber qué tipos le hacen daño ×2 y cuáles resisten sus ataques, y buscar_pokemon y obtener_pokemon para elegir Pokémon de esos tipos y comprobar sus estadísticas. Explica en español por qué eliges cada uno. Los tipos van en inglés, como en PokéAPI (p. ej. fire).',
    );
  });

  for (const herramienta of ['efectividad_tipos', 'buscar_pokemon', 'obtener_pokemon']) {
    test(`names ${herramienta}`, () => {
      assert.ok(GUIA_EQUIPO.includes(herramienta));
    });
  }
});
