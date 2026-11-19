// Conector con la IA generativa. Solo se usa cuando el motor de intenciones no reconoce la pregunta.
//
// Proveedores soportados (se elige según la clave configurada, o con LLM_PROVIDER):
//   - gemini    -> Google Gemini (GEMINI_API_KEY; tiene plan gratuito en aistudio.google.com)
//   - anthropic -> Claude (ANTHROPIC_API_KEY)
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, GoogleGenAI } from '@google/genai';

export function instrucciones(servicios, config) {
  const listaServicios = servicios.length
    ? servicios.map((s) => `- ${s.nombre}: desde $${Math.round(Number(s.precio)).toLocaleString('es-CO')} COP, ${s.duracion_estimada}. ${s.descripcion}`).join('\n')
    : '- (no se pudo consultar la lista de servicios en este momento)';

  return `Eres el asistente virtual de DUART-STUDIO, un taller de pintura y personalización de motocicletas en Tunjuelito, Bogotá (Colombia).

Responde en español de Colombia, con un tono cercano y profesional, en máximo 4 frases cortas. Es un chat dentro del sitio web: no uses títulos, tablas ni formato Markdown.

Servicios y precios de referencia del taller (son la única fuente de precios; no inventes otros):
${listaServicios}

Datos del taller:
- Horario: lunes a viernes de 8:00 a. m. a 6:00 p. m.; sábados de 8:00 a. m. a 2:00 p. m.
- Etapas del proceso: alistamiento, lijado, preparación de pintura, detallado y pulido.
- Citas: ${config.sitioUrl}/contacto/
- Para conocer la etapa de una moto, el cliente debe escribir la placa (por ejemplo ABC12D).

Si la pregunta pide una cotización exacta, un diagnóstico o algo que no sabes con certeza, dilo con honestidad y sugiere escribir por WhatsApp al taller. Si la pregunta no tiene relación con motos ni con el taller, explica amablemente que solo puedes ayudar con temas de DUART-STUDIO.`;
}

// El chat muestra texto plano: se quitan las marcas de Markdown que a veces devuelve el modelo.
export function limpiarMarkdown(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .trim();
}

// Errores de saturación o caída momentánea: vale la pena probar con el modelo de respaldo.
const ESTADOS_REINTENTABLES = new Set([429, 500, 502, 503, 504]);

// --- Google Gemini ---
function proveedorGemini(config, cliente) {
  const ai = cliente ?? new GoogleGenAI({ apiKey: config.geminiApiKey });
  const modelos = [config.llmModelo, ...config.llmModelosRespaldo.filter((m) => m !== config.llmModelo)];

  async function preguntar(modelo, pregunta, servicios) {
    const respuesta = await ai.models.generateContent({
      model: modelo,
      contents: pregunta,
      config: {
        systemInstruction: instrucciones(servicios, config),
        maxOutputTokens: 2048,
        httpOptions: { timeout: config.llmTimeoutMs },
      },
    });
    const texto = limpiarMarkdown(respuesta.text ?? '');
    if (texto) return { texto };
    // Sin texto: el filtro de seguridad bloqueó la pregunta o la respuesta.
    return { error: respuesta.promptFeedback?.blockReason ? 'rechazada' : 'vacia' };
  }

  return async (pregunta, servicios = []) => {
    let ultimoError = 'desconocido';
    for (const modelo of modelos) {
      try {
        return await preguntar(modelo, pregunta, servicios);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error(`[IA] Error de Gemini con ${modelo} (${error.status}): ${String(error.message).slice(0, 200)}`);
          if (error.status === 400 || error.status === 401 || error.status === 403) return { error: 'autenticacion' };
          ultimoError = error.status === 429 ? 'limite' : 'api';
          if (ESTADOS_REINTENTABLES.has(error.status)) continue; // prueba con el siguiente modelo
          return { error: ultimoError };
        }
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          console.error(`[IA] Tiempo de espera agotado con ${modelo}`);
          ultimoError = 'tiempo';
          continue;
        }
        console.error('[IA] Error inesperado:', error);
        return { error: 'desconocido' };
      }
    }
    return { error: ultimoError };
  };
}

// --- Claude (Anthropic) ---
function proveedorAnthropic(config, cliente) {
  const ai = cliente ?? new Anthropic({ apiKey: config.anthropicApiKey, timeout: config.llmTimeoutMs, maxRetries: 1 });
  return async (pregunta, servicios = []) => {
    try {
      const respuesta = await ai.beta.messages.create({
        model: config.llmModelo,
        max_tokens: 2048,
        output_config: { effort: 'low' }, // chat corto: respuestas rápidas y económicas
        // Si un filtro de seguridad rechaza la pregunta, la API reintenta con el modelo de respaldo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: instrucciones(servicios, config),
        messages: [{ role: 'user', content: pregunta }],
      });
      if (respuesta.stop_reason === 'refusal') return { error: 'rechazada' };
      const texto = respuesta.content
        .filter((bloque) => bloque.type === 'text')
        .map((bloque) => bloque.text)
        .join('')
        .trim();
      return texto ? { texto } : { error: 'vacia' };
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        console.error('[IA] ANTHROPIC_API_KEY inválida');
        return { error: 'autenticacion' };
      }
      if (error instanceof Anthropic.RateLimitError) {
        console.error('[IA] Límite de solicitudes alcanzado');
        return { error: 'limite' };
      }
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        console.error('[IA] Tiempo de espera agotado');
        return { error: 'tiempo' };
      }
      if (error instanceof Anthropic.APIError) {
        console.error(`[IA] Error de la API (${error.status}): ${error.message}`);
        return { error: 'api' };
      }
      console.error('[IA] Error inesperado:', error);
      return { error: 'desconocido' };
    }
  };
}

/**
 * Crea el cliente de IA. `clientes` permite inyectar clientes simulados en las pruebas.
 * responder() nunca lanza excepción: devuelve { texto } o { error }.
 */
export function crearClienteIA(config, clientes = {}) {
  const proveedor = config.llmProveedor;
  const cliente = clientes[proveedor];
  const clave = proveedor === 'gemini' ? config.geminiApiKey : config.anthropicApiKey;
  const habilitado = Boolean(clave) || Boolean(cliente);

  let responder = async () => ({ error: 'sin_configurar' });
  if (habilitado) {
    responder = proveedor === 'gemini' ? proveedorGemini(config, cliente) : proveedorAnthropic(config, cliente);
  }

  return { habilitado, proveedor, modelo: config.llmModelo, responder };
}
