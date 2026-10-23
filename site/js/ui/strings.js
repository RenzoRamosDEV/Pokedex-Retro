function deepFreeze(object) {
  Object.values(object).forEach((value) => {
    if (typeof value === 'object') deepFreeze(value);
  });
  return Object.freeze(object);
}

export const STRINGS = deepFreeze({
  comun: {
    cargando: 'CARGANDO...',
    sinResultados: 'SIN RESULTADOS',
    errorCarga: 'No se pudieron cargar los datos. Inténtalo de nuevo más tarde.',
    buscar: 'BUSCAR...',
    etiquetaBusqueda: 'Buscar por nombre',
    enviarBusqueda: 'Buscar',
    anterior: '◀ ANT.',
    siguiente: 'SIG. ▶',
    elementoNoCargado: '1 ELEMENTO NO SE PUDO CARGAR',
    elementosNoCargados: 'ELEMENTOS NO SE PUDIERON CARGAR',
  },
  pokedex: {
    titulo: 'POKEDEX',
    cerrar: 'Cerrar',
    oculta: 'OCULTA',
    info: 'INFO',
    altura: 'HEIGHT',
    peso: 'WEIGHT',
    experienciaBase: 'BASE EXP',
    habilidades: 'ABILITIES',
    estadisticasBase: 'BASE STATS',
    metros: 'm',
    kilos: 'kg',
  },
  movimientos: {
    titulo: 'MOVIMIENTOS',
    potencia: 'POW',
    precision: 'ACC',
    pp: 'PP',
    prioridad: 'PRI',
  },
  tipos: {
    titulo: 'TABLA DE TIPOS',
    esquina: 'ATK ╲ DEF',
    superEfectivo: 'Súper efectivo',
    noMuyEfectivo: 'No muy efectivo',
    inmune: 'Inmune',
    normal: 'Normal',
  },
  naturalezas: {
    titulo: 'NATURALEZAS',
    sube: 'SUBE',
    baja: 'BAJA',
    sinCambio: 'SIN CAMBIO DE STATS',
    neutral: 'NEUTRAL',
    naturales: 'naturales',
  },
  objetos: {
    titulo: 'OBJETOS',
    objeto: 'OBJETO',
    categoria: 'CATEGORÍA',
    precio: 'PRECIO',
    efecto: 'EFECTO',
  },
  bayas: {
    titulo: 'BAYAS',
    baya: 'BERRY',
    crecimiento: 'CRECIM.',
    cosecha: 'COSECHA',
    poderNatural: 'POD.NAT.',
    suavidad: 'SUAVIDAD',
    firmeza: 'FIRMEZA',
    horas: 'H',
    multiplicador: 'x',
  },
  habilidades: {
    titulo: 'HABILIDADES',
    pokemon: 'POKEMON',
  },
});
