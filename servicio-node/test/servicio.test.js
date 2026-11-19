// Pruebas del microservicio con Django y la IA simulados (no hacen llamadas reales).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { io as clienteSocket } from 'socket.io-client';

import { detectarIntencion, extraerPlaca } from '../src/asistente/intenciones.js';
import { crearServidor } from '../src/app.js';
import { cargarConfig } from '../src/config.js';
import { firmarCliente } from '../src/notificaciones.js';

const config = cargarConfig({ WEBHOOK_SECRET: 'secreto-prueba', SERVICIO_API_KEY: 'clave-prueba', WHATSAPP_NUMERO: '573001112233' });

const djangoFalso = {
  async servicios() {
    return [{ nombre: 'Pintura completa', precio: '850000.00', duracion_estimada: '5 a 7 días', descripcion: 'Pintura total' }];
  },
  async estadoVehiculo(placa) {
    if (placa !== 'ABC12D') return null;
    return { placa, marca: 'Yamaha', modelo: 'MT-03', etapa: 'preparacion', etapa_nombre: 'Preparación de pintura', paso: 3, total_pasos: 5 };
  },
  async disponible() {
    return true;
  },
};

const preguntasIA = [];
const iaFalsa = {
  habilitado: true,
  modelo: 'modelo-de-prueba',
  async responder(pregunta, servicios) {
    preguntasIA.push({ pregunta, servicios });
    return pregunta.includes('falla') ? { error: 'api' } : { texto: 'Respuesta generada por la IA.' };
  },
};

let base;
let servidor;

before(async () => {
  servidor = crearServidor({ config, django: djangoFalso, ia: iaFalsa });
  await new Promise((resolve) => servidor.servidorHttp.listen(0, resolve));
  base = `http://127.0.0.1:${servidor.servidorHttp.address().port}`;
});

after(() => {
  servidor.io.close();
  servidor.servidorHttp.close();
});

async function chat(mensaje) {
  const r = await fetch(`${base}/api/asistente/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje }),
  });
  return { status: r.status, cuerpo: await r.json() };
}

function webhook(cuerpo, secreto = 'secreto-prueba') {
  return fetch(`${base}/api/notificaciones/etapa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secreto },
    body: JSON.stringify(cuerpo),
  });
}

describe('Motor de intenciones', () => {
  test('detecta placas colombianas escritas de varias formas', () => {
    assert.equal(extraerPlaca('mi moto es abc12d'), 'ABC12D');
    assert.equal(extraerPlaca('placa ABC-12-D por favor'), 'ABC12D');
    assert.equal(extraerPlaca('hola, ¿cuánto cuesta?'), null);
  });

  test('reconoce preguntas frecuentes sin importar tildes ni mayúsculas', () => {
    assert.equal(detectarIntencion('¿Cuál es el HORARIO?').id, 'horario');
    assert.equal(detectarIntencion('cuanto cuesta pintar').id, 'servicios');
    assert.equal(detectarIntencion('quiero una cotización con diseño').id, 'cotizacion');
    assert.equal(detectarIntencion('Hola').id, 'saludo');
    assert.equal(detectarIntencion('¿qué color combina con el negro mate?'), null);
    assert.equal(detectarIntencion('¿Cada cuánto debo encerar la moto?'), null);
    assert.equal(detectarIntencion('¿Cuánto vale una pintura completa?').id, 'servicios');
    assert.equal(detectarIntencion('¿Cuánto tiempo se demoran?').id, 'tiempo');
  });
});

describe('API REST', () => {
  test('salud informa el estado de Django y de la IA', async () => {
    const r = await fetch(`${base}/api/salud`);
    const cuerpo = await r.json();
    assert.equal(r.status, 200);
    assert.equal(cuerpo.estado, 'ok');
    assert.equal(cuerpo.django_disponible, true);
    assert.equal(cuerpo.ia_configurada, true);
  });

  test('Swagger publica la especificación OpenAPI', async () => {
    const especificacion = await (await fetch(`${base}/api-docs.json`)).json();
    assert.equal(especificacion.openapi, '3.0.3');
    assert.ok(especificacion.paths['/api/asistente/chat']);
    assert.ok(especificacion.paths['/api/notificaciones/etapa']);
    const ui = await fetch(`${base}/api-docs/`);
    assert.equal(ui.status, 200);
    assert.match(await ui.text(), /swagger-ui/i);
  });

  test('el chat responde preguntas frecuentes con precios leídos de Django', async () => {
    const { cuerpo } = await chat('¿Cuánto cuesta pintar mi moto?');
    assert.equal(cuerpo.fuente, 'intencion');
    assert.equal(cuerpo.intencion, 'servicios');
    assert.match(cuerpo.respuesta, /Pintura completa: desde \$850\.000/);
  });

  test('el chat consulta el estado de una moto por placa', async () => {
    const { cuerpo } = await chat('¿En qué va mi moto abc12d?');
    assert.equal(cuerpo.fuente, 'estado_moto');
    assert.match(cuerpo.respuesta, /Preparación de pintura/);
    assert.match(cuerpo.respuesta, /etapa 3 de 5/);
  });

  test('una placa inexistente da un mensaje claro', async () => {
    const { cuerpo } = await chat('estado de ZZZ99Z');
    assert.match(cuerpo.respuesta, /No encontré ninguna moto con la placa ZZZ99Z/);
  });

  test('las preguntas no reconocidas van a la IA con los servicios como contexto', async () => {
    const { cuerpo } = await chat('¿Qué color le queda mejor a una moto negra?');
    assert.equal(cuerpo.fuente, 'ia');
    assert.equal(cuerpo.respuesta, 'Respuesta generada por la IA.');
    assert.equal(preguntasIA.at(-1).servicios[0].nombre, 'Pintura completa');
  });

  test('si la IA falla, deriva a WhatsApp', async () => {
    const { cuerpo } = await chat('esto provoca una falla en la IA');
    assert.equal(cuerpo.fuente, 'respaldo');
    assert.match(cuerpo.whatsapp, /^https:\/\/wa\.me\/573001112233\?text=/);
  });

  test('registra las preguntas no reconocidas solo con la clave de servicio', async () => {
    const sinClave = await fetch(`${base}/api/asistente/no-reconocidas`);
    assert.equal(sinClave.status, 401);
    const conClave = await fetch(`${base}/api/asistente/no-reconocidas`, { headers: { 'X-API-Key': 'clave-prueba' } });
    const { preguntas } = await conClave.json();
    assert.ok(preguntas.some((p) => p.pregunta.includes('moto negra')));
  });

  test('valida el mensaje del chat', async () => {
    assert.equal((await chat('')).status, 400);
  });
});

describe('Integración Django → Node.js', () => {
  const aviso = { cliente_id: '7', placa: 'ABC12D', marca: 'Yamaha', modelo: 'MT-03', etapa: 'detallado', etapa_nombre: 'Detallado' };

  test('rechaza el webhook sin el secreto correcto', async () => {
    assert.equal((await webhook(aviso, 'otro')).status, 401);
  });

  test('rechaza un aviso incompleto', async () => {
    const r = await webhook({ placa: 'ABC12D' });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /cliente_id/);
  });

  test('el aviso llega en tiempo real al cliente dueño de la moto, y solo a él', async () => {
    const dueno = clienteSocket(base, { transports: ['websocket'] });
    const intruso = clienteSocket(base, { transports: ['websocket'] });
    try {
      const unido = await dueno.emitWithAck('cliente:unirse', { cliente_id: '7', token: firmarCliente('7', 'secreto-prueba') });
      const rechazado = await intruso.emitWithAck('cliente:unirse', { cliente_id: '7', token: 'token-falso' });
      assert.deepEqual(unido, { unido: true });
      assert.deepEqual(rechazado, { unido: false });

      let intrusoRecibio = false;
      intruso.on('etapa:cambio', () => { intrusoRecibio = true; });
      const recibido = new Promise((resolve) => dueno.once('etapa:cambio', resolve));

      const r = await webhook(aviso);
      assert.equal(r.status, 202);
      assert.equal((await r.json()).entregado_en_vivo, true);

      const enVivo = await recibido;
      assert.equal(enVivo.etapa_nombre, 'Detallado');
      assert.match(enVivo.mensaje, /ABC12D pasó a la etapa: Detallado/);
      assert.equal(intrusoRecibio, false);
    } finally {
      dueno.close();
      intruso.close();
    }
  });

  test('los avisos recientes se consultan con el token del cliente', async () => {
    const sinToken = await fetch(`${base}/api/notificaciones?cliente_id=7&token=x`);
    assert.equal(sinToken.status, 401);
    const conToken = await fetch(`${base}/api/notificaciones?cliente_id=7&token=${firmarCliente('7', 'secreto-prueba')}`);
    const { avisos } = await conToken.json();
    assert.equal(avisos[0].placa, 'ABC12D');
  });
});

describe('Chat por WebSocket', () => {
  test('chat:mensaje devuelve chat:respuesta', async () => {
    const socket = clienteSocket(base, { transports: ['websocket'] });
    try {
      const respuesta = await socket.emitWithAck('chat:mensaje', { mensaje: '¿Qué horario tienen?' });
      assert.equal(respuesta.intencion, 'horario');
    } finally {
      socket.close();
    }
  });
});
