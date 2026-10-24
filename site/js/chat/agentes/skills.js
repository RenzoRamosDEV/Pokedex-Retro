// @ts-check
import { GUIA_COMPARAR, GUIA_EQUIPO } from '../../core/guias.js';

/**
 * Skills load on demand: the main prompt only lists `nombre` and `descripcion`.
 * @typedef {{ nombre: string, descripcion: string, instrucciones: string }} Skill
 */

/** @type {Skill[]} */
export const SKILLS = [
  {
    nombre: 'comparar-pokemon',
    descripcion: 'Compara dos Pokémon por tipos, estadísticas base y habilidades.',
    instrucciones: `Compara los dos Pokémon que indique el usuario. ${GUIA_COMPARAR}`,
  },
  {
    nombre: 'equipo-contra-tipo',
    descripcion: 'Propone un equipo de 6 Pokémon para enfrentarse a rivales de un tipo.',
    instrucciones: `Propón un equipo de 6 Pokémon contra el tipo que indique el usuario. ${GUIA_EQUIPO}`,
  },
  {
    nombre: 'analizar-debilidades',
    descripcion: 'Analiza las debilidades y resistencias de un Pokémon según sus tipos.',
    instrucciones:
      'Analiza las debilidades y resistencias del Pokémon que indique el usuario. Usa obtener_pokemon para conocer sus tipos y efectividad_tipos con cada tipo atacante contra esos tipos defensores. Agrupa los tipos atacantes por multiplicador (×4, ×2, ×0,5, ×0,25 y ×0) y explica en español de qué tipos debe protegerse. Si no existe, usa buscar_pokemon para encontrar el nombre exacto.',
  },
  {
    nombre: 'recomendar-naturaleza',
    descripcion: 'Recomienda una naturaleza según las estadísticas base de un Pokémon.',
    instrucciones:
      'Recomienda una naturaleza para el Pokémon que indique el usuario. Usa obtener_pokemon para conocer sus estadísticas base y naturalezas para ver qué estadística sube y cuál baja cada una. Elige una que suba su mejor estadística ofensiva o la velocidad y baje una que no aproveche, y explica en español por qué. Si no existe, usa buscar_pokemon para encontrar el nombre exacto.',
  },
];
