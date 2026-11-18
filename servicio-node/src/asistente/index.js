// Asistente virtual de DUART-STUDIO.
// Orden de resolución:
//   1) ¿Trae una placa?            -> consulta el estado de la moto en Django.
//   2) ¿Es una pregunta frecuente? -> motor de intenciones (sin costo de IA).
//   3) Si no la reconoce           -> IA generativa (Claude).
//   4) Si la IA no está disponible -> respuesta de respaldo con enlace a WhatsApp.
import { detectarIntencion, extraerPlaca } from './intenciones.js';

const MAX_LARGO = 500;
const MAX_NO_RECONOCIDAS = 100;

export function crearAsistente({ config, django, ia }) {
  const noReconocidas = []; // preguntas que el motor no entendió (para mejorar las intenciones)

  function enlaceWhatsapp(texto) {
    return `https://wa.me/${config.whatsappNumero}?text=${encodeURIComponent(texto)}`;
  }

  async function estadoMoto(placa) {
    let vehiculo;
    try {
      vehiculo = await django.estadoVehiculo(placa);
    } catch (error) {
      console.error('[Asistente] No se pudo consultar Django:', error.message);
      return {
        respuesta: 'No pude consultar el estado de tu moto en este momento. Intenta de nuevo en unos minutos.',
        fuente: 'estado_moto',
      };
    }
    if (!vehiculo) {
      return {
        respuesta: `No encontré ninguna moto con la placa ${placa}. Revisa que esté bien escrita o regístrala desde "Mi Proceso".`,
        fuente: 'estado_moto',
      };
    }
    const avance = vehiculo.etapa === 'finalizado'
      ? '¡Ya está lista para recoger! 🎉'
      : vehiculo.etapa === 'pendiente'
        ? 'Todavía no ha ingresado al taller.'
        : `Va en la etapa ${vehiculo.paso} de ${vehiculo.total_pasos}.`;
    return {
      respuesta: `Tu ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}) está en: ${vehiculo.etapa_nombre}. ${avance}`,
      fuente: 'estado_moto',
      vehiculo,
    };
  }

  async function responder(mensajeOriginal) {
    const mensaje = String(mensajeOriginal ?? '').trim().slice(0, MAX_LARGO);
    if (!mensaje) {
      return { respuesta: 'Escríbeme tu pregunta y con gusto te ayudo.', fuente: 'intencion', intencion: 'vacio' };
    }

    // 1) Estado de la moto por placa
    const placa = extraerPlaca(mensaje);
    if (placa) return estadoMoto(placa);

    // 2) Preguntas frecuentes
    const intencion = detectarIntencion(mensaje);
    if (intencion) {
      const respuesta = await intencion.responder({ config, django });
      return {
        respuesta,
        fuente: 'intencion',
        intencion: intencion.id,
        ...(intencion.derivarWhatsapp && { whatsapp: enlaceWhatsapp(`Hola DUART-STUDIO, ${mensaje}`) }),
      };
    }

    // 3) IA generativa
    noReconocidas.unshift({ pregunta: mensaje, fecha: new Date().toISOString() });
    noReconocidas.length = Math.min(noReconocidas.length, MAX_NO_RECONOCIDAS);

    let servicios = [];
    try {
      servicios = await django.servicios();
    } catch {
      // Sin la lista de servicios la IA igual puede responder; solo no citará precios.
    }
    const resultado = await ia.responder(mensaje, servicios);
    if (resultado.texto) {
      return { respuesta: resultado.texto, fuente: 'ia', modelo: ia.modelo };
    }

    // 4) Respaldo
    return {
      respuesta: 'No tengo una respuesta para eso en este momento. Te comunico con el equipo del taller por WhatsApp.',
      fuente: 'respaldo',
      motivo: resultado.error,
      whatsapp: enlaceWhatsapp(`Hola DUART-STUDIO, tengo una pregunta: ${mensaje}`),
    };
  }

  return {
    responder,
    preguntasNoReconocidas: () => [...noReconocidas],
  };
}
