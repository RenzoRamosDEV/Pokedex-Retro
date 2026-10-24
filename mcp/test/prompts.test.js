import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conectar } from './support/conectar.js';

async function setup(t) {
  const session = await conectar();
  t.after(session.close);
  const text = async (name, args) => {
    const { messages } = await session.client.getPrompt({ name, arguments: args });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[0].content.type, 'text');
    return messages[0].content.text;
  };
  return { ...session, text };
}

test('lists both prompts with their required arguments', async (t) => {
  const { client } = await setup(t);
  const { prompts } = await client.listPrompts();
  assert.deepEqual(
    prompts.map((p) => [p.name, p.arguments.map((a) => [a.name, a.required])]),
    [
      [
        'comparar_pokemon',
        [
          ['a', true],
          ['b', true],
        ],
      ],
      ['equipo_contra_tipo', [['tipo', true]]],
    ],
  );
  for (const prompt of prompts) {
    assert.ok(prompt.title.length > 0);
    assert.ok(prompt.description.length > 0);
  }
});

test('comparar_pokemon interpolates both Pokémon', async (t) => {
  const { text } = await setup(t);
  assert.equal(
    await text('comparar_pokemon', { a: 'pikachu', b: 'raichu' }),
    'Compara los Pokémon "pikachu" y "raichu". Usa obtener_pokemon con cada uno para conocer sus tipos, estadísticas base y habilidades, y efectividad_tipos para ver cómo se atacan entre sí. Resume en español quién tiene ventaja y por qué. Si alguno no existe, usa buscar_pokemon para encontrar el nombre exacto.',
  );
});

test('equipo_contra_tipo interpolates the type', async (t) => {
  const { text } = await setup(t);
  assert.equal(
    await text('equipo_contra_tipo', { tipo: 'dragon' }),
    'Propón un equipo de 6 Pokémon para enfrentarse a rivales de tipo "dragon". Usa efectividad_tipos para saber qué tipos le hacen daño ×2 y cuáles resisten sus ataques, y buscar_pokemon y obtener_pokemon para elegir Pokémon de esos tipos y comprobar sus estadísticas. Explica en español por qué eliges cada uno. Los tipos van en inglés, como en PokéAPI (p. ej. fire).',
  );
});

test('arguments are trimmed', async (t) => {
  const { text } = await setup(t);
  assert.match(await text('equipo_contra_tipo', { tipo: ' dragon ' }), /tipo "dragon"\./);
  assert.match(
    await text('comparar_pokemon', { a: ' pikachu ', b: ' raichu ' }),
    /^Compara los Pokémon "pikachu" y "raichu"\./,
  );
});

for (const [name, args] of [
  ['comparar_pokemon', { a: 'pikachu' }],
  ['comparar_pokemon', { a: 'pikachu', b: '' }],
  ['equipo_contra_tipo', {}],
  ['equipo_contra_tipo', { tipo: 'a'.repeat(51) }],
]) {
  test(`${name} with ${JSON.stringify(args)} is rejected as invalid params`, async (t) => {
    const { client } = await setup(t);
    await assert.rejects(client.getPrompt({ name, arguments: args }), { code: -32602 });
  });
}
