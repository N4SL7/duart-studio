// Configuración del microservicio, leída de variables de entorno.
// Ver .env.example en la raíz del repositorio.

function lista(valor, porDefecto) {
  return (valor || porDefecto)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function cargarConfig(env = process.env) {
  return {
    puerto: Number(env.PORT || 3000),

    // Dirección de Django vista DESDE Node (en Docker Compose: http://django:8000).
    djangoUrl: (env.DJANGO_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
    // Clave compartida para leer la API interna de Django (estado de motos).
    servicioApiKey: env.SERVICIO_API_KEY || 'clave-servicio-desarrollo',
    // Secreto compartido: Django lo envía en el webhook y lo usa para firmar los tokens de Socket.IO.
    webhookSecret: env.WEBHOOK_SECRET || 'secreto-webhook-desarrollo',

    // Orígenes del navegador que pueden usar el chat y las notificaciones (CORS).
    origenesPermitidos: lista(env.CORS_ORIGINS, 'http://127.0.0.1:8000,http://localhost:8000'),

    // IA generativa (Claude). Sin ANTHROPIC_API_KEY el asistente responde solo con preguntas frecuentes.
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    llmModelo: env.LLM_MODEL || 'claude-opus-5-5',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS || 30000),

    // WhatsApp del taller para cotizaciones y atención humana (formato internacional sin "+").
    whatsappNumero: env.WHATSAPP_NUMERO || '573000000000',
    sitioUrl: (env.SITIO_PUBLICO_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
  };
}
