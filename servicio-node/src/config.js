// Configuración del microservicio, leída de variables de entorno.
// Ver .env.example en la raíz del repositorio.

function lista(valor, porDefecto) {
  return (valor || porDefecto)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// Gemini: se usa el modelo "lite" porque responde en 1-2 s y tiene más cupo en el plan gratuito
// (los modelos grandes suelen estar saturados). Si el principal falla, se prueba el de respaldo.
const MODELO_POR_DEFECTO = { gemini: 'gemini-3.5-flash-lite', anthropic: 'claude-opus-5-5' };
const RESPALDO_POR_DEFECTO = { gemini: 'gemini-3.1-flash-lite', anthropic: '' };

// Proveedor de IA: el indicado en LLM_PROVIDER, o el de la clave que esté configurada (Gemini primero).
function elegirProveedor(env) {
  const pedido = (env.LLM_PROVIDER || '').toLowerCase();
  if (pedido in MODELO_POR_DEFECTO) return pedido;
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'gemini';
}

export function cargarConfig(env = process.env) {
  const llmProveedor = elegirProveedor(env);
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

    // IA generativa. Sin clave, el asistente responde solo con preguntas frecuentes y WhatsApp.
    llmProveedor,
    geminiApiKey: env.GEMINI_API_KEY || '',
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    llmModelo: env.LLM_MODEL || MODELO_POR_DEFECTO[llmProveedor],
    llmModelosRespaldo: lista(env.LLM_MODELOS_RESPALDO, RESPALDO_POR_DEFECTO[llmProveedor]),
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS || 20000),

    // WhatsApp del taller para cotizaciones y atención humana (formato internacional sin "+").
    whatsappNumero: env.WHATSAPP_NUMERO || '573000000000',
    sitioUrl: (env.SITIO_PUBLICO_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
  };
}
