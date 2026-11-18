// Conector con la IA generativa (Claude, de Anthropic).
// Solo se usa cuando el motor de intenciones no reconoce la pregunta.
import Anthropic from '@anthropic-ai/sdk';

function instrucciones(servicios, config) {
  const listaServicios = servicios.length
    ? servicios.map((s) => `- ${s.nombre}: desde $${Math.round(Number(s.precio)).toLocaleString('es-CO')} COP, ${s.duracion_estimada}. ${s.descripcion}`).join('\n')
    : '- (no se pudo consultar la lista de servicios en este momento)';

  return `Eres el asistente virtual de DUART-STUDIO, un taller de pintura y personalización de motocicletas en Tunjuelito, Bogotá (Colombia).

Responde en español de Colombia, con un tono cercano y profesional, en máximo 4 frases cortas. Es un chat dentro del sitio web: no uses títulos ni tablas.

Servicios y precios de referencia del taller (son la única fuente de precios; no inventes otros):
${listaServicios}

Datos del taller:
- Horario: lunes a viernes de 8:00 a. m. a 6:00 p. m.; sábados de 8:00 a. m. a 2:00 p. m.
- Etapas del proceso: alistamiento, lijado, preparación de pintura, detallado y pulido.
- Citas: ${config.sitioUrl}/contacto/
- Para conocer la etapa de una moto, el cliente debe escribir la placa (por ejemplo ABC12D).

Si la pregunta pide una cotización exacta, un diagnóstico o algo que no sabes con certeza, dilo con honestidad y sugiere escribir por WhatsApp al taller. Si la pregunta no tiene relación con motos ni con el taller, explica amablemente que solo puedes ayudar con temas de DUART-STUDIO.`;
}

export function crearClienteIA(config, clienteAnthropic = null) {
  const habilitado = Boolean(config.anthropicApiKey) || Boolean(clienteAnthropic);
  const cliente = clienteAnthropic ?? (habilitado
    ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: config.llmTimeoutMs, maxRetries: 1 })
    : null);

  return {
    habilitado,
    modelo: config.llmModelo,

    /**
     * Pregunta a Claude. Devuelve { texto } o { error } (nunca lanza excepción:
     * el asistente siempre debe poder responder algo al usuario).
     */
    async responder(pregunta, servicios = []) {
      if (!cliente) return { error: 'sin_configurar' };
      try {
        const respuesta = await cliente.beta.messages.create({
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
    },
  };
}
