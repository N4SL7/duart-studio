// Motor de intenciones: responde las preguntas frecuentes sin gastar llamadas a la IA.
// Cada intención tiene palabras clave; gana la que más coincidencias tenga.

export function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Placas de moto en Colombia: tres letras, dos números y una letra (ej. ABC12D).
const PATRON_PLACA = /\b([a-z]{3})\s*-?\s*(\d{2})\s*-?\s*([a-z])\b/i;

export function extraerPlaca(texto) {
  const coincidencia = (texto || '').match(PATRON_PLACA);
  return coincidencia ? `${coincidencia[1]}${coincidencia[2]}${coincidencia[3]}`.toUpperCase() : null;
}

function formatoPesos(valor) {
  return `$${Math.round(Number(valor)).toLocaleString('es-CO')}`;
}

export const INTENCIONES = [
  {
    id: 'saludo',
    descripcion: 'Saludo inicial',
    palabras: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'saludos'],
    soloSiEsCorto: true,
    responder: () =>
      '¡Hola! Soy el asistente de DUART-STUDIO 🏍. Puedo contarte de nuestros servicios y precios, ' +
      'el horario, cómo agendar una cita o en qué etapa va tu moto (escríbeme la placa).',
  },
  {
    id: 'horario',
    descripcion: 'Horario de atención',
    palabras: ['horario', 'hora', 'abren', 'cierran', 'atienden', 'abierto', 'domingo', 'sabado', 'festivo'],
    responder: () =>
      'Atendemos de lunes a viernes de 8:00 a. m. a 6:00 p. m. y los sábados de 8:00 a. m. a 2:00 p. m. ' +
      'Domingos y festivos está cerrado.',
  },
  {
    id: 'ubicacion',
    descripcion: 'Dirección del taller',
    palabras: ['donde', 'ubicacion', 'direccion', 'quedan', 'ubicados', 'llegar', 'barrio', 'tunjuelito'],
    responder: () =>
      'Estamos en la localidad de Tunjuelito, en el sur de Bogotá. Si quieres la dirección exacta o la ' +
      'ubicación en el mapa, escríbenos por WhatsApp y te la enviamos.',
  },
  {
    id: 'servicios',
    descripcion: 'Servicios y precios de referencia (consulta la API de Django)',
    palabras: ['precio', 'precios', 'cuesta', 'cuestan', 'vale', 'valor', 'servicio', 'servicios', 'ofrecen', 'tarifa', 'cobran'],
    responder: async ({ django }) => {
      const servicios = await django.servicios();
      if (!servicios.length) return 'En este momento no pude consultar los servicios. Intenta de nuevo en un momento.';
      const lineas = servicios.map(
        (s) => `• ${s.nombre}: desde ${formatoPesos(s.precio)} (${s.duracion_estimada})`,
      );
      return `Estos son nuestros servicios y precios de referencia:\n${lineas.join('\n')}\n` +
        'El valor final depende del modelo y del estado de la moto. ¿Quieres una cotización?';
    },
  },
  {
    id: 'cita',
    descripcion: 'Cómo agendar una cita',
    palabras: ['cita', 'agendar', 'reservar', 'turno', 'agenda', 'separar'],
    responder: ({ config }) =>
      `Puedes agendar tu cita en ${config.sitioUrl}/contacto/ : eliges el servicio y la fecha, y te ` +
      'confirmamos por teléfono.',
  },
  {
    id: 'tiempo',
    descripcion: 'Cuánto se demora un trabajo',
    palabras: ['demora', 'demoran', 'tarda', 'tardan', 'cuanto tiempo', 'cuando esta lista', 'entregan'],
    responder: () =>
      'Depende del trabajo: un retoque y pulido toma de 1 a 2 días, una pintura completa de 5 a 7 días y ' +
      'una personalización con diseño de 7 a 10 días. Si ya dejaste tu moto, escríbeme la placa y te digo en qué etapa va.',
  },
  {
    id: 'etapas',
    descripcion: 'Etapas del proceso de pintura',
    palabras: ['etapa', 'etapas', 'proceso', 'pasos', 'como pintan', 'lijado', 'alistamiento'],
    responder: () =>
      'Cada moto pasa por cinco etapas: 1) alistamiento, 2) lijado, 3) preparación de pintura, ' +
      '4) detallado y 5) pulido. Si tienes cuenta, en "Mi Proceso" ves la etapa de tu moto en tiempo real.',
  },
  {
    id: 'pagos',
    descripcion: 'Formas de pago',
    palabras: ['pago', 'pagar', 'nequi', 'daviplata', 'efectivo', 'tarjeta', 'transferencia', 'abono', 'anticipo'],
    responder: () =>
      'Recibimos efectivo, Nequi, Daviplata y transferencia bancaria. Para iniciar el trabajo se pide un abono ' +
      'y el saldo se paga al entregar la moto.',
  },
  {
    id: 'garantia',
    descripcion: 'Garantía del trabajo',
    palabras: ['garantia', 'garantias', 'respaldo', 'si se daña', 'se pela'],
    responder: () =>
      'Todos nuestros trabajos de pintura tienen garantía por defectos de aplicación. Si notas algún problema, ' +
      'tráenos la moto y la revisamos sin costo.',
  },
  {
    id: 'cotizacion',
    descripcion: 'Cotización personalizada (deriva a WhatsApp)',
    palabras: ['cotizacion', 'cotizar', 'presupuesto', 'diseño', 'personalizar', 'aerografia', 'calcomania'],
    derivarWhatsapp: true,
    responder: () =>
      'Para una cotización exacta necesitamos ver tu moto y tu idea. Escríbenos por WhatsApp con fotos y te ' +
      'respondemos con el valor.',
  },
  {
    id: 'humano',
    descripcion: 'Hablar con una persona (deriva a WhatsApp)',
    palabras: ['persona', 'humano', 'asesor', 'hablar con alguien', 'llamar', 'telefono', 'whatsapp', 'contacto'],
    derivarWhatsapp: true,
    responder: () => 'Claro, te comunico con el equipo del taller por WhatsApp.',
  },
];

/** Devuelve la intención que mejor coincide con el mensaje, o null. */
export function detectarIntencion(mensaje) {
  const texto = normalizar(mensaje);
  if (!texto) return null;
  const palabrasMensaje = texto.split(' ');

  let mejor = null;
  let mejorPuntaje = 0;
  for (const intencion of INTENCIONES) {
    if (intencion.soloSiEsCorto && palabrasMensaje.length > 4) continue;
    let puntaje = 0;
    for (const palabra of intencion.palabras) {
      const clave = normalizar(palabra);
      const coincide = clave.includes(' ') ? texto.includes(clave) : palabrasMensaje.includes(clave);
      if (coincide) puntaje += clave.includes(' ') ? 2 : 1;
    }
    if (puntaje > mejorPuntaje) {
      mejor = intencion;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}
