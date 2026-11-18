// Pruebas del conector de IA con un cliente de Anthropic simulado (sin llamadas reales).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';

import { crearClienteIA } from '../src/asistente/llm.js';
import { cargarConfig } from '../src/config.js';

const config = cargarConfig({});
const servicios = [{ nombre: 'Retoque y pulido', precio: '250000.00', duracion_estimada: '1 a 2 días', descripcion: 'Brillo final' }];

function clienteFalso(implementacion) {
  const llamadas = [];
  return {
    llamadas,
    beta: { messages: { create: async (params) => { llamadas.push(params); return implementacion(params); } } },
  };
}

test('sin ANTHROPIC_API_KEY la IA queda deshabilitada y no se llama', async () => {
  const ia = crearClienteIA(config);
  assert.equal(ia.habilitado, false);
  assert.deepEqual(await ia.responder('hola'), { error: 'sin_configurar' });
});

test('envía la pregunta con las instrucciones del taller y los servicios de Django', async () => {
  const falso = clienteFalso(() => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Te recomiendo un gris mate.' }] }));
  const ia = crearClienteIA(config, falso);

  const resultado = await ia.responder('¿Qué color me recomiendas?', servicios);

  assert.deepEqual(resultado, { texto: 'Te recomiendo un gris mate.' });
  const params = falso.llamadas[0];
  assert.equal(params.model, 'claude-opus-5-5');
  assert.deepEqual(params.output_config, { effort: 'low' });
  assert.equal(params.fallbacks, 'default');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.match(params.system, /DUART-STUDIO/);
  assert.match(params.system, /Retoque y pulido: desde \$250\.000 COP/);
  assert.deepEqual(params.messages, [{ role: 'user', content: '¿Qué color me recomiendas?' }]);
});

test('ignora los bloques de razonamiento y junta solo el texto', async () => {
  const falso = clienteFalso(() => ({
    stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }],
  }));
  assert.deepEqual(await crearClienteIA(config, falso).responder('x'), { texto: 'Hola mundo' });
});

test('si la IA rechaza la pregunta, no devuelve texto', async () => {
  const falso = clienteFalso(() => ({ stop_reason: 'refusal', content: [] }));
  assert.deepEqual(await crearClienteIA(config, falso).responder('x'), { error: 'rechazada' });
});

test('convierte los errores de la API en un código, sin lanzar excepción', async () => {
  const falso = clienteFalso(() => {
    throw new Anthropic.APIConnectionTimeoutError();
  });
  const anterior = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await crearClienteIA(config, falso).responder('x'), { error: 'tiempo' });
  } finally {
    console.error = anterior;
  }
});
