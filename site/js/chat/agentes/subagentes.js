// @ts-check
import { DEFINICIONES } from '../herramientas.js';
import { BASE, REGLA_ALCANCE } from './alcance.js';

/**
 * @typedef {(typeof DEFINICIONES)[number]} Definicion
 * @typedef {{ nombre: string, sistema: string, herramientas: Definicion[], maxIteraciones: number }} Agente
 * @typedef {Agente & { descripcion: string }} Subagente
 */

const MAX_ITERACIONES = 6;

/** @param {string[]} nombres */
const delCatalogo = (nombres) => DEFINICIONES.filter((d) => nombres.includes(d.name));

/**
 * @param {string} nombre
 * @param {string} descripcion
 * @param {string} rol
 * @param {string[]} herramientas
 * @returns {Subagente}
 */
const subagente = (nombre, descripcion, rol, herramientas) => ({
  nombre,
  descripcion,
  sistema: `${rol} Te escribe el profesor, el asistente principal: responde a su tarea con un resumen breve y concreto. ${REGLA_ALCANCE} ${BASE}`,
  herramientas: delCatalogo(herramientas),
  maxIteraciones: MAX_ITERACIONES,
});

/** @type {Subagente[]} */
export const SUBAGENTES = [
  subagente(
    'estratega-tipos',
    'Debilidades, resistencias y cobertura de movimientos de un Pokémon o de un tipo.',
    'Eres el estratega de tipos de la Pokédex Retro: analizas debilidades, resistencias y la cobertura de los movimientos.',
    ['obtener_pokemon', 'buscar_movimientos', 'obtener_movimiento', 'efectividad_tipos'],
  ),
  subagente(
    'entrenador-equipos',
    'Equipos de Pokémon con sus habilidades y naturalezas para un objetivo concreto.',
    'Eres el entrenador de equipos de la Pokédex Retro: eliges Pokémon, habilidades y naturalezas para un objetivo.',
    ['buscar_pokemon', 'obtener_pokemon', 'obtener_habilidad', 'efectividad_tipos', 'naturalezas'],
  ),
  subagente(
    'investigador-pokedex',
    'Búsquedas y fichas de Pokémon, movimientos, habilidades, objetos y bayas.',
    'Eres el investigador de la Pokédex Retro: buscas y reúnes los datos de Pokémon, movimientos, habilidades, objetos y bayas.',
    [
      'buscar_pokemon',
      'obtener_pokemon',
      'buscar_movimientos',
      'obtener_movimiento',
      'buscar_habilidades',
      'obtener_habilidad',
      'buscar_objetos',
      'obtener_objeto',
      'buscar_bayas',
      'obtener_baya',
    ],
  ),
];
