import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { FUNCIONES, comoFuncion, openai } from './openai.js';
import { DEFINICIONES } from '../herramientas.js';
import { PROFESOR } from '../agentes/profesor.js';
import { SUBAGENTES } from '../agentes/subagentes.js';
import { DELEGAR_SUBAGENTE, USAR_SKILL } from '../agentes/meta.js';
import { MODELOS_OPENAI } from '../modelos.js';
import { DESCRIPCIONES } from '../../core/consultas.js';
import { ENTRADA_NO_JSON } from '../herramientas.js';
import { crearLectorSse } from '../sse.js';
import {
  functionCallItem,
  itemDone,
  itemEvents,
  messageItem,
  reasoningItem,
  respuesta,
  responseCompleted,
  responseCreated,
  responseFailed,
  errorEvent,
  respuestaError,
  responseIncomplete,
  serializar,
  textDelta,
  trocear,
  usage,
} from '../../../../tests/support/openai-sse.js';

const CLAVE = 'sk-proj-prueba';
const HISTORIAL = [{ role: 'user', content: 'hola' }];

const peticion = (modelo = 'gpt-6.1-sol') =>
  openai.construirPeticion({ modelo, clave: CLAVE, historial: HISTORIAL });
const cuerpo = (modelo) => JSON.parse(peticion(modelo).opciones.body);
const funcion = (nombre) => FUNCIONES.find((f) => f.name === nombre);

describe('openai.construirPeticion', () => {
  test('posts to the Responses API', () => {
    const { url, opciones } = peticion();
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(opciones.method, 'POST');
  });

  test('sends exactly content-type and the key as a bearer token', () => {
    assert.deepEqual(peticion().opciones.headers, {
      'content-type': 'application/json',
      authorization: `Bearer ${CLAVE}`,
    });
  });

  test('sends the fields in a fixed order with the documented values', () => {
    const datos = cuerpo('gpt-6.1-sol');
    assert.deepEqual(Object.keys(datos), [
      'model',
      'instructions',
      'input',
      'tools',
      'max_output_tokens',
      'reasoning',
      'store',
      'stream',
    ]);
    assert.deepEqual(datos, {
      model: 'gpt-6.1-sol',
      instructions: PROFESOR.sistema,
      input: HISTORIAL,
      tools: PROFESOR.herramientas.map(comoFuncion),
      max_output_tokens: 8000,
      reasoning: { effort: 'low' },
      store: false,
      stream: true,
    });
  });

  for (const { id } of MODELOS_OPENAI) {
    test(`${id} carries no forbidden parameter and never stores`, () => {
      const datos = cuerpo(id);
      assert.equal(datos.model, id);
      for (const prohibido of [
        'temperature',
        'top_p',
        'previous_response_id',
        'conversation',
        'background',
        'tool_choice',
        'include',
      ]) {
        assert.equal(prohibido in datos, false, prohibido);
      }
      assert.equal(datos.store, false);
    });
  }
});

describe('openai agent requests', () => {
  test('the main agent declares 14 strict functions in the order and names of Claude', () => {
    const { tools } = cuerpo('gpt-6.1-sol');
    assert.equal(tools.length, 14);
    assert.deepEqual(
      tools.map((f) => [f.type, f.name, f.description, f.strict]),
      PROFESOR.herramientas.map((d) => ['function', d.name, d.description, true]),
    );
  });

  test('golden: delegar_subagente is a strict function with every field required', () => {
    assert.deepEqual(comoFuncion(DELEGAR_SUBAGENTE), {
      type: 'function',
      name: 'delegar_subagente',
      description: DELEGAR_SUBAGENTE.description,
      parameters: {
        type: 'object',
        properties: DELEGAR_SUBAGENTE.input_schema.properties,
        required: ['subagente', 'tarea'],
        additionalProperties: false,
      },
      strict: true,
    });
  });

  test('golden: usar_skill is a strict function with its name required', () => {
    assert.deepEqual(comoFuncion(USAR_SKILL), {
      type: 'function',
      name: 'usar_skill',
      description: USAR_SKILL.description,
      parameters: {
        type: 'object',
        properties: USAR_SKILL.input_schema.properties,
        required: ['nombre'],
        additionalProperties: false,
      },
      strict: true,
    });
  });

  test('comoFuncion gives FUNCIONES for every query tool', () => {
    assert.deepEqual(DEFINICIONES.map(comoFuncion), FUNCIONES);
  });

  for (const agente of [PROFESOR, ...SUBAGENTES]) {
    test(`${agente.nombre} sends its own instructions and functions with the scope rule`, () => {
      const datos = JSON.parse(
        openai.construirPeticion({ modelo: 'gpt-6.1-sol', clave: CLAVE, historial: [], agente })
          .opciones.body,
      );
      assert.equal(datos.instructions, agente.sistema);
      assert.deepEqual(datos.tools, agente.herramientas.map(comoFuncion));
      assert.ok(datos.instructions.includes('Solo puedo responder preguntas sobre Pokémon.'));
    });
  }
});

describe('FUNCIONES', () => {
  test('declares the 12 tools as strict functions in the order, names and descriptions of Claude', () => {
    assert.equal(FUNCIONES.length, 12);
    assert.deepEqual(
      FUNCIONES.map((f) => [f.type, f.name, f.description, f.strict]),
      DEFINICIONES.map((d) => ['function', d.name, d.description, true]),
    );
    assert.deepEqual(Object.keys(FUNCIONES[0]), [
      'type',
      'name',
      'description',
      'parameters',
      'strict',
    ]);
  });

  test('every parameters object closes extra properties and requires all of them', () => {
    for (const { name, parameters } of FUNCIONES) {
      assert.equal(parameters.type, 'object', name);
      assert.equal(parameters.additionalProperties, false, name);
      assert.deepEqual(parameters.required, Object.keys(parameters.properties), name);
    }
  });

  test('golden: buscar_pokemon makes its optional fields nullable', () => {
    assert.deepEqual(funcion('buscar_pokemon'), {
      type: 'function',
      name: 'buscar_pokemon',
      description: DESCRIPCIONES.buscar_pokemon,
      parameters: {
        type: 'object',
        properties: {
          consulta: {
            type: 'string',
            description:
              'Texto que debe contener el nombre, en inglés como en PokéAPI (p. ej. "char")',
          },
          pagina: { type: ['integer', 'null'], description: 'Página de resultados, desde 1' },
          tamano_pagina: {
            type: ['integer', 'null'],
            description: 'Resultados por página, de 1 a 50',
          },
        },
        required: ['consulta', 'pagina', 'tamano_pagina'],
        additionalProperties: false,
      },
      strict: true,
    });
  });

  test('golden: obtener_pokemon keeps its required anyOf as is', () => {
    assert.deepEqual(funcion('obtener_pokemon').parameters, {
      type: 'object',
      properties: {
        nombre_o_id: {
          anyOf: [{ type: 'string' }, { type: 'integer' }],
          description: 'Nombre en inglés de PokéAPI (p. ej. "pikachu") o número',
        },
      },
      required: ['nombre_o_id'],
      additionalProperties: false,
    });
  });

  test('golden: efectividad_tipos makes the defender array nullable', () => {
    assert.deepEqual(funcion('efectividad_tipos').parameters, {
      type: 'object',
      properties: {
        atacante: { type: 'string', description: 'Tipo atacante en inglés, p. ej. "electric"' },
        defensor: {
          type: ['array', 'null'],
          description: '1 o 2 tipos defensores distintos, p. ej. ["water", "flying"]',
          items: { type: 'string' },
        },
      },
      required: ['atacante', 'defensor'],
      additionalProperties: false,
    });
  });

  test('golden: naturalezas keeps the enum and makes the stat nullable', () => {
    assert.deepEqual(funcion('naturalezas').parameters, {
      type: 'object',
      properties: {
        estadistica: {
          type: ['string', 'null'],
          description: 'Estadística que la naturaleza sube o baja',
          enum: ['attack', 'defense', 'special-attack', 'special-defense', 'speed', null],
        },
      },
      required: ['estadistica'],
      additionalProperties: false,
    });
  });

  test('leaves the Claude definitions untouched', () => {
    const naturalezas = DEFINICIONES.find((d) => d.name === 'naturalezas');
    assert.deepEqual(naturalezas.input_schema.required, []);
    assert.equal(naturalezas.input_schema.properties.estadistica.type, 'string');
    const buscar = DEFINICIONES.find((d) => d.name === 'buscar_pokemon');
    assert.deepEqual(buscar.input_schema.required, ['consulta']);
    assert.equal(buscar.input_schema.properties.pagina.type, 'integer');
  });
});

/** Feeds SSE events to a fresh reading and returns the visible texts and the reading. */
function leer(eventos) {
  const lectura = openai.crearLectura();
  const textos = eventos.map(({ event, data }) => lectura.aplicar({ evento: event, datos: data }));
  return { textos, lectura };
}

/** Same as `leer`, but through the wire format cut at the given byte offsets. */
function leerTrozos(eventos, cortes) {
  const lector = crearLectorSse();
  const lectura = openai.crearLectura();
  let texto = '';
  for (const trozo of trocear(serializar(eventos), cortes)) {
    for (const evento of lector.leer(trozo)) texto += lectura.aplicar(evento);
  }
  return { texto, turno: lectura.terminar() };
}

const turno = (opciones) => leer(respuesta(opciones)).lectura.terminar();

const RAZONAMIENTO = reasoningItem({ cifrado: 'gAAAAB-cifrado' });
const MENSAJE = messageItem({ texto: 'Gyarádos ⚡ es ×4' });
const LLAMADA = functionCallItem({
  callId: 'call_9',
  name: 'efectividad_tipos',
  args: { atacante: 'electric', defensor: ['water', 'flying'] },
});
const MUESTRA = respuesta({
  items: [RAZONAMIENTO, MENSAJE, LLAMADA],
  final: responseCompleted(usage({ entrada: 12, salida: 7 })),
});

describe('openai.crearLectura', () => {
  test('rebuilds the sample stream into its turn', () => {
    assert.deepEqual(leerTrozos(MUESTRA, []), {
      texto: 'Gyarádos ⚡ es ×4',
      turno: {
        motivo: 'herramientas',
        historial: [RAZONAMIENTO, MENSAJE, LLAMADA],
        llamadas: [
          {
            id: 'call_9',
            nombre: 'efectividad_tipos',
            entrada: { atacante: 'electric', defensor: ['water', 'flying'] },
          },
        ],
        uso: { entrada: 12, salida: 7 },
      },
    });
  });

  test('every cut point of the sample stream gives the same text and turn', () => {
    const esperado = leerTrozos(MUESTRA, []);
    const longitud = new TextEncoder().encode(serializar(MUESTRA)).length;
    for (let corte = 1; corte < longitud; corte += 1) {
      assert.deepEqual(leerTrozos(MUESTRA, [corte]), esperado, `corte ${corte}`);
    }
  });

  test('a text delta split in three, once inside a multibyte character, reads the same', () => {
    const eventos = [responseCreated(), textDelta(0, '⚡ Gyarádos'), responseCompleted()];
    const serie = serializar(eventos);
    const inicio = new TextEncoder().encode(serie.slice(0, serie.indexOf('⚡'))).length;
    const { texto } = leerTrozos(eventos, [inicio + 1, inicio + 20]);
    assert.equal(texto, '⚡ Gyarádos');
  });

  test('returns each output_text delta as visible text, in order', () => {
    const { textos } = leer([responseCreated(), textDelta(0, 'Gyara'), textDelta(0, 'dos')]);
    assert.deepEqual(textos, ['', 'Gyara', 'dos']);
  });

  test('ignores unknown and intermediate events', () => {
    const { textos, lectura } = leer([
      { event: 'response.reasoning_summary_text.delta', data: { type: 'x', delta: 'no' } },
      { event: 'response.function_call_arguments.delta', data: { delta: '{"a"' } },
      { event: 'response.desconocido', data: { delta: 'no' } },
      responseCompleted(),
    ]);
    assert.deepEqual(textos, ['', '', '', '']);
    assert.deepEqual(lectura.terminar().historial, []);
  });

  test('keeps the output_index order even when the done events arrive out of order', () => {
    const { lectura } = leer([
      itemDone(2, LLAMADA),
      itemDone(0, RAZONAMIENTO),
      itemDone(1, MENSAJE),
      responseCompleted(),
    ]);
    assert.deepEqual(lectura.terminar().historial, [RAZONAMIENTO, MENSAJE, LLAMADA]);
  });

  test('drops created_by and keeps the rest of every item identical', () => {
    const conAutor = [
      reasoningItem({ cifrado: 'gAAAA-x', createdBy: 'resp_1' }),
      messageItem({ texto: 'Hola', phase: 'final_answer', createdBy: 'resp_1' }),
      functionCallItem({ name: 'naturalezas', createdBy: 'resp_1' }),
    ];
    const { historial } = turno({ items: conAutor });
    assert.deepEqual(historial, [
      reasoningItem({ cifrado: 'gAAAA-x' }),
      messageItem({ texto: 'Hola', phase: 'final_answer' }),
      functionCallItem({ name: 'naturalezas' }),
    ]);
    assert.equal(historial[1].phase, 'final_answer');
    assert.equal(historial[0].encrypted_content, 'gAAAA-x');
  });

  test('completed without calls ends as fin', () => {
    assert.equal(turno({ items: [MENSAJE] }).motivo, 'fin');
  });

  test('incomplete by max_output_tokens ends as cortada, keeping its calls', () => {
    const resultado = turno({
      items: [LLAMADA],
      final: responseIncomplete('max_output_tokens'),
    });
    assert.equal(resultado.motivo, 'cortada');
    assert.equal(resultado.llamadas.length, 1);
  });

  test('incomplete by content_filter ends as rechazo', () => {
    assert.equal(
      turno({ items: [MENSAJE], final: responseIncomplete('content_filter') }).motivo,
      'rechazo',
    );
  });

  test('a refusal part ends as rechazo even with calls', () => {
    assert.equal(
      turno({ items: [messageItem({ rechazo: 'No puedo.' }), LLAMADA] }).motivo,
      'rechazo',
    );
  });

  test('a stream without a final event is a lost connection', () => {
    const { lectura } = leer([responseCreated(), ...itemEvents(0, MENSAJE)]);
    assert.throws(() => lectura.terminar(), {
      name: 'ErrorDeOpenAI',
      codigo: 'red',
      estado: 0,
      detalle: 'stream incompleto',
    });
  });

  test('drops top-level nulls from the parsed arguments', () => {
    const { llamadas } = turno({
      items: [
        functionCallItem({
          callId: 'call_1',
          name: 'buscar_pokemon',
          json: '{"consulta":"char","pagina":null,"tamano_pagina":null}',
        }),
      ],
    });
    assert.deepEqual(llamadas, [
      { id: 'call_1', nombre: 'buscar_pokemon', entrada: { consulta: 'char' } },
    ]);
  });

  test('keeps nested nulls and falsy values', () => {
    const { llamadas } = turno({
      items: [functionCallItem({ name: 'x', json: '{"a":0,"b":"","c":false,"d":[null]}' })],
    });
    assert.deepEqual(llamadas[0].entrada, { a: 0, b: '', c: false, d: [null] });
  });

  test('arguments that do not parse are called with ENTRADA_NO_JSON and go back unchanged', () => {
    const roto = functionCallItem({ callId: 'call_2', name: 'naturalezas', json: '{"estad' });
    const resultado = turno({ items: [roto] });
    assert.deepEqual(resultado.llamadas, [
      { id: 'call_2', nombre: 'naturalezas', entrada: ENTRADA_NO_JSON },
    ]);
    assert.deepEqual(resultado.historial, [roto]);
  });

  test('arguments that parse to null are called with ENTRADA_NO_JSON', () => {
    const resultado = turno({ items: [functionCallItem({ name: 'naturalezas', json: 'null' })] });
    assert.equal(resultado.llamadas[0].entrada, ENTRADA_NO_JSON);
  });

  test('arguments that parse to a non-object are called with ENTRADA_NO_JSON', () => {
    for (const json of ['5', '"char"', 'true']) {
      const resultado = turno({ items: [functionCallItem({ name: 'naturalezas', json })] });
      assert.equal(resultado.llamadas[0].entrada, ENTRADA_NO_JSON, json);
    }
  });

  test('a message with text and a refusal part ends as rechazo', () => {
    const mixto = {
      ...messageItem({ texto: 'Hola' }),
      content: [
        { type: 'output_text', text: 'Hola', annotations: [] },
        { type: 'refusal', refusal: 'No.' },
      ],
    };
    assert.equal(turno({ items: [mixto] }).motivo, 'rechazo');
  });

  test('incomplete without details ends as cortada', () => {
    const final = responseIncomplete('max_output_tokens');
    delete final.data.response.incomplete_details;
    assert.equal(turno({ items: [MENSAJE], final }).motivo, 'cortada');
  });

  test('a missing output index leaves no gap in the history', () => {
    const { lectura } = leer([itemDone(1, MENSAJE), responseCompleted()]);
    assert.deepEqual(lectura.terminar().historial, [MENSAJE]);
  });

  test('the usage is input_tokens and output_tokens, adding up to the spec scenario', () => {
    const primero = turno({
      items: [LLAMADA],
      final: responseCompleted(usage({ entrada: 100, cache: 40, salida: 20 })),
    });
    const segundo = turno({
      items: [MENSAJE],
      final: responseCompleted(usage({ entrada: 200, cache: 150, salida: 30 })),
    });
    assert.deepEqual(primero.uso, { entrada: 100, salida: 20 });
    assert.deepEqual(segundo.uso, { entrada: 200, salida: 30 });
    assert.equal(primero.uso.entrada + segundo.uso.entrada, 300);
    assert.equal(primero.uso.salida + segundo.uso.salida, 50);
  });

  test('a missing usage counts as zero', () => {
    const final = responseCompleted();
    delete final.data.response.usage;
    assert.deepEqual(turno({ items: [MENSAJE], final }).uso, { entrada: 0, salida: 0 });
  });
});

describe('openai history items', () => {
  test('mensajeUsuario is a user input message', () => {
    assert.deepEqual(openai.mensajeUsuario('hola'), { role: 'user', content: 'hola' });
  });

  test('resultados is one function_call_output per call, in order', () => {
    assert.deepEqual(
      openai.resultados([
        { id: 'call_1', contenido: 'Pokémon gyarados (#130).', esError: false },
        { id: 'call_2', contenido: 'No existe.', esError: true },
      ]),
      [
        { type: 'function_call_output', call_id: 'call_1', output: 'Pokémon gyarados (#130).' },
        { type: 'function_call_output', call_id: 'call_2', output: 'No existe.' },
      ],
    );
  });
});

const SALDO = [
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
];

/** Name, code, status and detail of a classified error, plus its retry flag when present. */
const forma = (error) => [
  error.name,
  error.codigo,
  error.estado,
  error.detalle,
  error.reintentable,
];

describe('openai.errorDeRespuesta', () => {
  const casos = [
    [
      400,
      { type: 'invalid_request_error', message: 'Bad schema' },
      'peticion',
      'Bad schema',
      false,
    ],
    [
      401,
      { code: 'invalid_api_key', message: 'Incorrect API key' },
      'clave_invalida',
      'Incorrect API key',
      false,
    ],
    [403, { message: 'denied' }, 'permiso', 'denied', false],
    [404, { message: 'no model' }, 'servidor', 'no model', false],
    [
      429,
      { type: 'requests', code: 'rate_limit_exceeded', message: 'slow' },
      'limite_uso',
      'slow',
      true,
    ],
    [499, { message: 'closed' }, 'servidor', 'closed', false],
    [500, { message: 'oops' }, 'servidor', 'oops', true],
    [502, { message: 'bad gateway' }, 'servidor', 'bad gateway', true],
    [503, { message: 'busy' }, 'saturado', 'busy', true],
    [599, { message: 'edge' }, 'servidor', 'edge', true],
  ];
  for (const [estado, error, codigo, detalle, reintentable] of casos) {
    test(`${estado} ${error.code ?? error.type ?? ''} is ${codigo}`, async () => {
      assert.deepEqual(forma(await openai.errorDeRespuesta(respuestaError(estado, error))), [
        'ErrorDeOpenAI',
        codigo,
        estado,
        detalle,
        reintentable,
      ]);
    });
  }

  for (const saldo of SALDO) {
    test(`429 with type ${saldo} is sin_saldo and not retried`, async () => {
      const error = await openai.errorDeRespuesta(
        respuestaError(429, { type: saldo, message: 'm' }),
      );
      assert.deepEqual(forma(error), ['ErrorDeOpenAI', 'sin_saldo', 429, 'm', false]);
    });

    test(`429 with code ${saldo} is sin_saldo and not retried`, async () => {
      const error = await openai.errorDeRespuesta(
        respuestaError(429, { type: 'requests', code: saldo, message: 'm' }),
      );
      assert.deepEqual(forma(error), ['ErrorDeOpenAI', 'sin_saldo', 429, 'm', false]);
    });
  }

  test('a quota code outside a 429 keeps the code of its status', async () => {
    const error = await openai.errorDeRespuesta(
      respuestaError(403, { type: 'insufficient_quota', code: 'insufficient_quota', message: 'm' }),
    );
    assert.deepEqual(forma(error), ['ErrorDeOpenAI', 'permiso', 403, 'm', false]);
  });

  test('429 without a body is limite_uso and retried', async () => {
    const error = await openai.errorDeRespuesta(new Response('', { status: 429 }));
    assert.deepEqual(forma(error), ['ErrorDeOpenAI', 'limite_uso', 429, 'HTTP 429', true]);
  });

  test('400 with a body that is not JSON is detailed as HTTP 400', async () => {
    const error = await openai.errorDeRespuesta(new Response('<html>', { status: 400 }));
    assert.deepEqual(forma(error), ['ErrorDeOpenAI', 'peticion', 400, 'HTTP 400', false]);
  });

  test('a JSON body without error is detailed with the status', async () => {
    const error = await openai.errorDeRespuesta(new Response('{}', { status: 500 }));
    assert.equal(error.detalle, 'HTTP 500');
  });
});

describe('openai stream errors', () => {
  const casos = [
    ['invalid_api_key', 'clave_invalida', 401],
    ...SALDO.map((saldo) => [saldo, 'sin_saldo', 429]),
    ['rate_limit_exceeded', 'limite_uso', 429],
    ['slow_down', 'limite_uso', 429],
    ['server_is_overloaded', 'saturado', 503],
    ['server_error', 'servidor', 500],
    ['algo_nuevo', 'servidor', 500],
  ];
  for (const [code, codigo, estado] of casos) {
    test(`an error event with ${code} throws ${codigo}`, () => {
      const { event, data } = errorEvent(code, `mensaje ${code}`);
      const lectura = openai.crearLectura();
      assert.throws(
        () => lectura.aplicar({ evento: event, datos: data }),
        (error) => {
          assert.deepEqual(forma(error), [
            'ErrorDeOpenAI',
            codigo,
            estado,
            `mensaje ${code}`,
            undefined,
          ]);
          return true;
        },
      );
    });

    test(`response.failed with ${code} throws ${codigo}`, () => {
      const { event, data } = responseFailed(code, `fallo ${code}`);
      const lectura = openai.crearLectura();
      assert.throws(
        () => lectura.aplicar({ evento: event, datos: data }),
        (error) => {
          assert.deepEqual(forma(error), [
            'ErrorDeOpenAI',
            codigo,
            estado,
            `fallo ${code}`,
            undefined,
          ]);
          return true;
        },
      );
    });
  }
});

describe('openai other errors', () => {
  test('errorDeRed is red with status 0', () => {
    assert.deepEqual(forma(openai.errorDeRed('Failed to fetch')), [
      'ErrorDeOpenAI',
      'red',
      0,
      'Failed to fetch',
      undefined,
    ]);
  });

  test('errorDesconocido is a 500 server error', () => {
    assert.deepEqual(forma(openai.errorDesconocido('roto')), [
      'ErrorDeOpenAI',
      'servidor',
      500,
      'roto',
      undefined,
    ]);
  });

  test('is an Error with the detail as message', () => {
    const error = openai.errorDesconocido('roto');
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'roto');
  });
});

describe('openai.errorDeConexion', () => {
  /** Fake fetch answering the diagnostic GET with one response or error. */
  function diagnostico(respuesta) {
    const llamadas = [];
    const fetch = async (url, init) => {
      llamadas.push([url, init]);
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    };
    return { fetch, llamadas };
  }
  const conexion = (fetch, signal) =>
    openai.errorDeConexion({ fetch, clave: CLAVE, detalle: 'Failed to fetch', signal });

  test('makes one bodiless GET to /v1/models with the bearer key and the signal', async () => {
    const { fetch, llamadas } = diagnostico(new Response('{}', { status: 401 }));
    const signal = new AbortController().signal;
    await conexion(fetch, signal);
    assert.deepEqual(llamadas, [
      [
        'https://api.openai.com/v1/models',
        { method: 'GET', headers: { authorization: `Bearer ${CLAVE}` }, signal },
      ],
    ]);
  });

  for (const [estado, esperado] of [
    [401, ['ErrorDeOpenAI', 'clave_invalida', 401, 'Failed to fetch']],
    [200, ['ErrorDeOpenAI', 'rechazada', 0, 'Failed to fetch']],
    [201, ['ErrorDeOpenAI', 'red', 0, 'Failed to fetch']],
    [400, ['ErrorDeOpenAI', 'red', 0, 'Failed to fetch']],
    [403, ['ErrorDeOpenAI', 'red', 0, 'Failed to fetch']],
    [429, ['ErrorDeOpenAI', 'red', 0, 'Failed to fetch']],
    [500, ['ErrorDeOpenAI', 'red', 0, 'Failed to fetch']],
  ]) {
    test(`a ${estado} diagnosis is ${esperado[1]}`, async () => {
      const { fetch } = diagnostico(new Response('{}', { status: estado }));
      const error = await conexion(fetch);
      assert.deepEqual([error.name, error.codigo, error.estado, error.detalle], esperado);
      assert.equal(error.message, 'Failed to fetch');
    });
  }

  test('a diagnosis without connection is red', async () => {
    const { fetch } = diagnostico(new TypeError('Failed to fetch'));
    const error = await conexion(fetch);
    assert.deepEqual([error.codigo, error.estado], ['red', 0]);
  });

  test('an abort during the diagnosis propagates', async () => {
    const { fetch } = diagnostico(new DOMException('abortado', 'AbortError'));
    await assert.rejects(conexion(fetch), { name: 'AbortError' });
  });
});
