// Aplicación Express + Socket.IO. Se construye con sus dependencias inyectadas
// para poder probarla sin Django ni la API de IA reales.
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';

import { crearAsistente } from './asistente/index.js';
import { INTENCIONES } from './asistente/intenciones.js';
import { crearClienteIA } from './asistente/llm.js';
import { cargarConfig } from './config.js';
import { crearClienteDjango } from './django.js';
import { crearCentroNotificaciones, secretoValido, validarAviso, verificarToken } from './notificaciones.js';
import { crearEspecificacion } from './openapi.js';

export function crearServidor({ config = cargarConfig(), django, ia } = {}) {
  django ??= crearClienteDjango(config);
  ia ??= crearClienteIA(config);
  const asistente = crearAsistente({ config, django, ia });
  const notificaciones = crearCentroNotificaciones();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', cors({ origin: config.origenesPermitidos }));

  // --- Documentación (Swagger) ---
  const especificacion = crearEspecificacion();
  app.get('/api-docs.json', (_req, res) => res.json(especificacion));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(especificacion, {
    customSiteTitle: 'DUART-STUDIO · API Node.js',
  }));
  app.get('/', (_req, res) => res.redirect('/api-docs'));

  // --- Salud ---
  app.get('/api/salud', async (_req, res) => {
    res.json({
      estado: 'ok',
      servicio: 'duart-studio-servicio-node',
      django_disponible: await django.disponible(),
      ia_configurada: ia.habilitado,
      proveedor_ia: ia.proveedor,
      modelo_ia: ia.modelo,
      clientes_conectados: io.engine.clientsCount,
    });
  });

  // --- Asistente ---
  app.post('/api/asistente/chat', async (req, res, next) => {
    try {
      const { mensaje } = req.body ?? {};
      if (typeof mensaje !== 'string' || !mensaje.trim()) {
        return res.status(400).json({ error: 'El campo "mensaje" es obligatorio.' });
      }
      res.json(await asistente.responder(mensaje));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/asistente/intenciones', (_req, res) => {
    res.json({
      intenciones: INTENCIONES.map((i) => ({ id: i.id, descripcion: i.descripcion, palabras_clave: i.palabras })),
    });
  });

  app.get('/api/asistente/no-reconocidas', (req, res) => {
    if (!secretoValido(req.get('X-API-Key'), config.servicioApiKey)) {
      return res.status(401).json({ error: 'Clave de servicio inválida.' });
    }
    res.json({ preguntas: asistente.preguntasNoReconocidas() });
  });

  // --- Notificaciones (Django -> Node) ---
  app.post('/api/notificaciones/etapa', (req, res) => {
    if (!secretoValido(req.get('X-Webhook-Secret'), config.webhookSecret)) {
      return res.status(401).json({ error: 'Secreto del webhook inválido.' });
    }
    const error = validarAviso(req.body);
    if (error) return res.status(400).json({ error });
    const { aviso, entregado } = notificaciones.registrar(req.body);
    console.log(`[Webhook] ${aviso.placa} → ${aviso.etapa_nombre} (cliente ${aviso.cliente_id}, en vivo: ${entregado})`);
    res.status(202).json({ recibido: true, entregado_en_vivo: entregado, aviso });
  });

  app.get('/api/notificaciones', (req, res) => {
    const { cliente_id: clienteId, token } = req.query;
    if (!verificarToken(clienteId, token, config.webhookSecret)) {
      return res.status(401).json({ error: 'Token de cliente inválido.' });
    }
    res.json({ avisos: notificaciones.recientes(clienteId) });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error('[Servidor]', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  // --- WebSocket (Socket.IO) ---
  const servidorHttp = http.createServer(app);
  const io = new Server(servidorHttp, { cors: { origin: config.origenesPermitidos } });
  notificaciones.conectarSocket(io);

  io.on('connection', (socket) => {
    socket.on('chat:mensaje', async (datos, responderAck) => {
      const mensaje = typeof datos === 'string' ? datos : datos?.mensaje;
      let resultado;
      try {
        resultado = await asistente.responder(mensaje);
      } catch (error) {
        console.error('[Socket] Error en el asistente:', error);
        resultado = { respuesta: 'Tuve un problema para responder. Intenta de nuevo.', fuente: 'respaldo' };
      }
      socket.emit('chat:respuesta', resultado);
      if (typeof responderAck === 'function') responderAck(resultado);
    });

    socket.on('cliente:unirse', ({ cliente_id: clienteId, token } = {}, responderAck) => {
      const valido = verificarToken(clienteId, token, config.webhookSecret);
      if (valido) socket.join(`cliente:${clienteId}`);
      if (typeof responderAck === 'function') responderAck({ unido: valido });
    });
  });

  return { app, servidorHttp, io, asistente, notificaciones };
}
