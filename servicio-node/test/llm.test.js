// Pruebas del conector de IA con clientes simulados (sin llamadas reales a Gemini ni a Claude).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '@google/genai';

import { crearClienteIA } from '../src/asistente/llm.js';
import { cargarConfig } from '../src/config.js';

const servicios = [{ nombre: 'Retoque y pulido', precio: '250000.00', duracion_estimada: '1 a 2 días', descripcion: 'Brillo final' }];

function silenciarErrores(fn) {
  const anterior = console.error;
  console.error = () => {};
  return fn().finally(() => { console.error = anterior; });
}

// --- Elección del proveedor ---

test('elige Gemini si hay GEMINI_API_KEY y Claude si solo hay ANTHROPIC_API_KEY', () => {
  assert.equal(cargarConfig({ GEMINI_API_KEY: 'g' }).llmProveedor, 'gemini');
  assert.equal(cargarConfig({ GEMINI_API_KEY: 'g' }).llmModelo, 'gemini-3.8-flash');
  assert.equal(cargarConfig({ ANTHROPIC_API_KEY: 'a' }).llmProveedor, 'anthropic');
  assert.equal(cargarConfig({ ANTHROPIC_API_KEY: 'a' }).llmModelo, 'claude-opus-5-5');
  assert.equal(cargarConfig({ GEMINI_API_KEY: 'g', LLM_MODEL: 'otro-modelo' }).llmModelo, 'otro-modelo');
});

test('sin ninguna clave la IA queda deshabilitada y no se llama', async () => {
  const ia = crearClienteIA(cargarConfig({}));
  assert.equal(ia.habilitado, false);
  assert.deepEqual(await ia.responder('hola'), { error: 'sin_configurar' });
});

// --- Gemini ---

function geminiFalso(implementacion) {
  const llamadas = [];
  return {
    llamadas,
    models: { generateContent: async (params) => { llamadas.push(params); return implementacion(params); } },
  };
}

const configGemini = cargarConfig({ GEMINI_API_KEY: 'clave-falsa' });

test('Gemini: envía la pregunta con las instrucciones del taller y los servicios de Django', async () => {
  const falso = geminiFalso(() => ({ text: 'Te recomiendo un gris mate.' }));
  const resultado = await crearClienteIA(configGemini, { gemini: falso }).responder('¿Qué color me recomiendas?', servicios);

  assert.deepEqual(resultado, { texto: 'Te recomiendo un gris mate.' });
  const params = falso.llamadas[0];
  assert.equal(params.model, 'gemini-3.8-flash');
  assert.equal(params.contents, '¿Qué color me recomiendas?');
  assert.match(params.config.systemInstruction, /DUART-STUDIO/);
  assert.match(params.config.systemInstruction, /Retoque y pulido: desde \$250\.000 COP/);
  assert.equal(params.config.httpOptions.timeout, 30000);
});

test('Gemini: si el filtro de seguridad bloquea la pregunta, no devuelve texto', async () => {
  const falso = geminiFalso(() => ({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } }));
  assert.deepEqual(await crearClienteIA(configGemini, { gemini: falso }).responder('x'), { error: 'rechazada' });
});

test('Gemini: convierte los errores de la API en un código, sin lanzar excepción', async () => {
  const limite = geminiFalso(() => { throw new ApiError({ message: 'cuota agotada', status: 429 }); });
  const clave = geminiFalso(() => { throw new ApiError({ message: 'API key not valid', status: 400 }); });
  await silenciarErrores(async () => {
    assert.deepEqual(await crearClienteIA(configGemini, { gemini: limite }).responder('x'), { error: 'limite' });
    assert.deepEqual(await crearClienteIA(configGemini, { gemini: clave }).responder('x'), { error: 'autenticacion' });
  });
});

// --- Claude (Anthropic) ---

function anthropicFalso(implementacion) {
  const llamadas = [];
  return {
    llamadas,
    beta: { messages: { create: async (params) => { llamadas.push(params); return implementacion(params); } } },
  };
}

const configClaude = cargarConfig({ ANTHROPIC_API_KEY: 'clave-falsa' });

test('Claude: envía la pregunta con las instrucciones, effort bajo y modelo de respaldo', async () => {
  const falso = anthropicFalso(() => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Hola' }] }));
  const resultado = await crearClienteIA(configClaude, { anthropic: falso }).responder('¿Qué color?', servicios);

  assert.deepEqual(resultado, { texto: 'Hola' });
  const params = falso.llamadas[0];
  assert.equal(params.model, 'claude-opus-5-5');
  assert.deepEqual(params.output_config, { effort: 'low' });
  assert.equal(params.fallbacks, 'default');
  assert.match(params.system, /Retoque y pulido/);
});

test('Claude: rechazo y errores se convierten en códigos', async () => {
  const rechazo = anthropicFalso(() => ({ stop_reason: 'refusal', content: [] }));
  const tiempo = anthropicFalso(() => { throw new Anthropic.APIConnectionTimeoutError(); });
  assert.deepEqual(await crearClienteIA(configClaude, { anthropic: rechazo }).responder('x'), { error: 'rechazada' });
  await silenciarErrores(async () => {
    assert.deepEqual(await crearClienteIA(configClaude, { anthropic: tiempo }).responder('x'), { error: 'tiempo' });
  });
});
