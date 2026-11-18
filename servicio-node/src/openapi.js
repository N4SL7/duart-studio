// Especificación OpenAPI 3.0 del microservicio. Se publica en /api-docs (Swagger UI)
// y en /api-docs.json (para importarla en Postman u otras herramientas).

export function crearEspecificacion({ servidorUrl } = {}) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'DUART-STUDIO · Microservicio Node.js',
      version: '1.0.0',
      description:
        'Asistente virtual con IA, notificaciones de cambio de etapa en tiempo real y comunicación con el backend Django.\n\n' +
        '**Flujo del asistente:** 1) si el mensaje trae una placa, consulta el estado de la moto en Django; ' +
        '2) si es una pregunta frecuente, responde el motor de intenciones; 3) si no la reconoce, responde la IA (Claude); ' +
        '4) si la IA no está disponible, deriva a WhatsApp.\n\n' +
        '**WebSocket (Socket.IO):** el navegador emite `chat:mensaje` y recibe `chat:respuesta`; ' +
        'para recibir avisos emite `cliente:unirse` con `{cliente_id, token}` y escucha `etapa:cambio`.',
    },
    servers: [{ url: servidorUrl || '/', description: 'Este servidor' }],
    tags: [
      { name: 'Salud', description: 'Estado del servicio' },
      { name: 'Asistente', description: 'Chat con preguntas frecuentes e IA generativa' },
      { name: 'Notificaciones', description: 'Integración Django → Node.js (cambio de etapa)' },
    ],
    paths: {
      '/api/salud': {
        get: {
          tags: ['Salud'],
          summary: 'Estado del microservicio y de sus dependencias',
          responses: {
            200: {
              description: 'Servicio activo',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Salud' } } },
            },
          },
        },
      },
      '/api/asistente/chat': {
        post: {
          tags: ['Asistente'],
          summary: 'Enviar un mensaje al asistente virtual',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MensajeChat' },
                examples: {
                  precios: { summary: 'Pregunta frecuente', value: { mensaje: '¿Cuánto cuesta pintar la moto?' } },
                  placa: { summary: 'Estado de una moto', value: { mensaje: '¿En qué va mi moto ABC12D?' } },
                  ia: { summary: 'Pregunta abierta (IA)', value: { mensaje: '¿Qué color le queda mejor a una moto negra?' } },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Respuesta del asistente',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/RespuestaChat' } } },
            },
            400: { $ref: '#/components/responses/ErrorValidacion' },
          },
        },
      },
      '/api/asistente/intenciones': {
        get: {
          tags: ['Asistente'],
          summary: 'Preguntas frecuentes que reconoce el motor de intenciones',
          responses: {
            200: {
              description: 'Lista de intenciones',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      intenciones: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', example: 'horario' },
                            descripcion: { type: 'string', example: 'Horario de atención' },
                            palabras_clave: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/asistente/no-reconocidas': {
        get: {
          tags: ['Asistente'],
          summary: 'Preguntas que el motor de intenciones no reconoció (para mejorar las respuestas)',
          security: [{ ClaveServicio: [] }],
          responses: {
            200: {
              description: 'Últimas 100 preguntas no reconocidas',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      preguntas: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: { pregunta: { type: 'string' }, fecha: { type: 'string', format: 'date-time' } },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/NoAutorizado' },
          },
        },
      },
      '/api/notificaciones/etapa': {
        post: {
          tags: ['Notificaciones'],
          summary: 'Webhook: Django avisa que una moto cambió de etapa',
          description: 'Lo llama Django al cambiar la etapa de un vehículo. Node lo reenvía por WebSocket a la sala del cliente.',
          security: [{ SecretoWebhook: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AvisoEtapa' } } },
          },
          responses: {
            202: {
              description: 'Aviso recibido',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      recibido: { type: 'boolean', example: true },
                      entregado_en_vivo: { type: 'boolean', description: 'true si el cliente estaba conectado' },
                      aviso: { $ref: '#/components/schemas/Aviso' },
                    },
                  },
                },
              },
            },
            400: { $ref: '#/components/responses/ErrorValidacion' },
            401: { $ref: '#/components/responses/NoAutorizado' },
          },
        },
      },
      '/api/notificaciones': {
        get: {
          tags: ['Notificaciones'],
          summary: 'Avisos recientes de un cliente',
          parameters: [
            { name: 'cliente_id', in: 'query', required: true, schema: { type: 'string' }, example: '2' },
            { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: 'Token del cliente generado por Django' },
          ],
          responses: {
            200: {
              description: 'Avisos (el más reciente primero)',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { avisos: { type: 'array', items: { $ref: '#/components/schemas/Aviso' } } } },
                },
              },
            },
            401: { $ref: '#/components/responses/NoAutorizado' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        SecretoWebhook: { type: 'apiKey', in: 'header', name: 'X-Webhook-Secret' },
        ClaveServicio: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      responses: {
        ErrorValidacion: {
          description: 'Datos inválidos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NoAutorizado: {
          description: 'Credencial ausente o incorrecta',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Salud: {
          type: 'object',
          properties: {
            estado: { type: 'string', example: 'ok' },
            servicio: { type: 'string', example: 'duart-studio-servicio-node' },
            django_disponible: { type: 'boolean' },
            ia_configurada: { type: 'boolean' },
            modelo_ia: { type: 'string', example: 'claude-opus-5-5' },
            clientes_conectados: { type: 'integer' },
          },
        },
        MensajeChat: {
          type: 'object',
          required: ['mensaje'],
          properties: { mensaje: { type: 'string', maxLength: 500, example: '¿Cuál es el horario?' } },
        },
        RespuestaChat: {
          type: 'object',
          properties: {
            respuesta: { type: 'string' },
            fuente: { type: 'string', enum: ['estado_moto', 'intencion', 'ia', 'respaldo'] },
            intencion: { type: 'string', description: 'Solo si fuente = intencion', example: 'horario' },
            modelo: { type: 'string', description: 'Solo si fuente = ia', example: 'claude-opus-5-5' },
            whatsapp: { type: 'string', description: 'Enlace para continuar por WhatsApp', example: 'https://wa.me/573000000000?text=...' },
            vehiculo: { $ref: '#/components/schemas/EstadoVehiculo' },
          },
        },
        EstadoVehiculo: {
          type: 'object',
          properties: {
            placa: { type: 'string', example: 'ABC12D' },
            marca: { type: 'string', example: 'Yamaha' },
            modelo: { type: 'string', example: 'MT-03' },
            etapa: { type: 'string', example: 'preparacion' },
            etapa_nombre: { type: 'string', example: 'Preparación de pintura' },
            paso: { type: 'integer', example: 3 },
            total_pasos: { type: 'integer', example: 5 },
            actualizado: { type: 'string', format: 'date-time' },
          },
        },
        AvisoEtapa: {
          type: 'object',
          required: ['cliente_id', 'placa', 'etapa', 'etapa_nombre'],
          properties: {
            cliente_id: { type: 'string', example: '2' },
            placa: { type: 'string', example: 'ABC12D' },
            marca: { type: 'string', example: 'Yamaha' },
            modelo: { type: 'string', example: 'MT-03' },
            etapa: { type: 'string', example: 'detallado' },
            etapa_nombre: { type: 'string', example: 'Detallado' },
            etapa_anterior_nombre: { type: 'string', example: 'Preparación de pintura' },
            fecha: { type: 'string', format: 'date-time' },
          },
        },
        Aviso: {
          allOf: [
            { $ref: '#/components/schemas/AvisoEtapa' },
            {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                mensaje: { type: 'string', example: 'Tu moto ABC12D pasó a la etapa: Detallado.' },
              },
            },
          ],
        },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
}
