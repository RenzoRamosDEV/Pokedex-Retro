// @ts-check
import { z } from 'zod';
import { MENSAJES_ENTRADA } from '../../site/js/core/mensajes.js';

/** @param {string} error */
const rules = (error) => ({ error });

const {
  consulta: MSG_CONSULTA,
  pagina: MSG_PAGINA,
  tamano_pagina: MSG_TAMANO,
  nombre_o_id: MSG_NOMBRE_O_ID,
  atacante: MSG_ATACANTE,
  defensor: MSG_DEFENSOR,
  estadistica: MSG_ESTADISTICA,
} = MENSAJES_ENTRADA;

export const ENTRADA_BUSQUEDA = {
  consulta: z
    .string(rules(MSG_CONSULTA))
    .trim()
    .min(1, rules(MSG_CONSULTA))
    .max(50, rules(MSG_CONSULTA))
    .describe('Texto que debe contener el nombre, en inglés como en PokéAPI (p. ej. "char")'),
  pagina: z
    .number(rules(MSG_PAGINA))
    .int(rules(MSG_PAGINA))
    .min(1, rules(MSG_PAGINA))
    .default(1)
    .describe('Página de resultados, desde 1'),
  tamano_pagina: z
    .number(rules(MSG_TAMANO))
    .int(rules(MSG_TAMANO))
    .min(1, rules(MSG_TAMANO))
    .max(50, rules(MSG_TAMANO))
    .default(10)
    .describe('Resultados por página, de 1 a 50'),
};

/** Restricted to PokéAPI name characters so the value cannot escape the request path. */
export const ENTRADA_DETALLE = {
  nombre_o_id: z
    .union(
      [
        z
          .string(rules(MSG_NOMBRE_O_ID))
          .trim()
          .min(1, rules(MSG_NOMBRE_O_ID))
          .max(50, rules(MSG_NOMBRE_O_ID))
          .regex(/^[A-Za-z0-9 -]+$/, rules(MSG_NOMBRE_O_ID)),
        z.number(rules(MSG_NOMBRE_O_ID)).int(rules(MSG_NOMBRE_O_ID)).min(1, rules(MSG_NOMBRE_O_ID)),
      ],
      rules(MSG_NOMBRE_O_ID),
    )
    .describe('Nombre en inglés de PokéAPI (p. ej. "pikachu") o número'),
};

const entero = z.number().int();

export const POKEMON = {
  id: entero,
  name: z.string(),
  baseExperience: entero.nullable(),
  height: entero,
  weight: entero,
  abilities: z.array(z.strictObject({ name: z.string(), isHidden: z.boolean(), slot: entero })),
  stats: z.array(z.strictObject({ name: z.string(), baseStat: entero, effort: entero })),
  types: z.array(z.strictObject({ slot: entero, typeName: z.string() })),
  sprite: z.string().nullable(),
};

export const MOVIMIENTO = {
  id: entero,
  name: z.string(),
  accuracy: entero.nullable(),
  pp: entero.nullable(),
  priority: entero,
  power: entero.nullable(),
  damageClass: z.string(),
  moveType: z.string(),
  shortEffect: z.string(),
};

export const HABILIDAD = {
  id: entero,
  name: z.string(),
  shortEffect: z.string(),
  pokemonCount: entero,
};

export const OBJETO = {
  id: entero,
  name: z.string(),
  cost: entero.nullable(),
  category: z.string(),
  sprite: z.string().nullable(),
  shortEffect: z.string(),
};

export const BAYA = {
  id: entero,
  name: z.string(),
  growthTime: entero,
  maxHarvest: entero,
  naturalGiftPower: entero,
  naturalGiftType: z.string(),
  smoothness: entero,
  firmness: z.string(),
  flavors: z.array(z.strictObject({ potency: entero, flavor: z.string() })),
};

/** @param {Record<string, z.ZodType>} item */
export const busqueda = (item) => ({
  resultados: z.array(z.strictObject(item)),
  pagina: entero,
  total_paginas: entero,
  total: entero,
});

/** Free text rather than an enum, so an unknown type can be answered with the valid list. */
const tipo = (/** @type {string} */ message) =>
  z.string(rules(message)).trim().toLowerCase().min(1, rules(message)).max(20, rules(message));

export const ENTRADA_EFECTIVIDAD = {
  atacante: tipo(MSG_ATACANTE).describe('Tipo atacante en inglés, p. ej. "electric"'),
  defensor: z
    .array(tipo(MSG_DEFENSOR), rules(MSG_DEFENSOR))
    .min(1, rules(MSG_DEFENSOR))
    .max(2, rules(MSG_DEFENSOR))
    .refine((tipos) => new Set(tipos).size === tipos.length, rules(MSG_DEFENSOR))
    .optional()
    .describe('1 o 2 tipos defensores distintos, p. ej. ["water", "flying"]'),
};

/** One schema for both answers: with defender (`multiplicador`) or without (`multiplicadores`). */
export const EFECTIVIDAD = {
  atacante: z.string(),
  defensor: z.array(z.string()).optional(),
  multiplicador: z.number().optional(),
  multiplicadores: z.record(z.string(), z.number()).optional(),
};

export const ENTRADA_NATURALEZAS = {
  estadistica: z
    .enum(
      ['attack', 'defense', 'special-attack', 'special-defense', 'speed'],
      rules(MSG_ESTADISTICA),
    )
    .optional()
    .describe('Estadística que la naturaleza sube o baja'),
};

export const NATURALEZA = {
  id: entero,
  name: z.string(),
  increasedStat: z.string().nullable(),
  decreasedStat: z.string().nullable(),
  likesFlavor: z.string().nullable(),
  hatesFlavor: z.string().nullable(),
};

export const NATURALEZAS = { naturalezas: z.array(z.strictObject(NATURALEZA)) };
