// Notificaciones de cambio de etapa (RF-12).
// Django avisa por webhook -> Node guarda el aviso y lo envía por WebSocket al cliente dueño de la moto.
import crypto from 'node:crypto';

const MAX_POR_CLIENTE = 20;

/**
 * Token que Django entrega al navegador del cliente para unirse a SU sala de Socket.IO.
 * Es un HMAC-SHA256 de "cliente:<id>" con el secreto compartido; así nadie puede escuchar
 * los avisos de otro cliente cambiando el id.
 */
export function firmarCliente(clienteId, secreto) {
  return crypto.createHmac('sha256', secreto).update(`cliente:${clienteId}`).digest('hex');
}

export function verificarToken(clienteId, token, secreto) {
  if (!clienteId || typeof token !== 'string') return false;
  const esperado = Buffer.from(firmarCliente(clienteId, secreto));
  const recibido = Buffer.from(token);
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
}

export function secretoValido(recibido, secreto) {
  if (typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(secreto);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const CAMPOS_REQUERIDOS = ['cliente_id', 'placa', 'etapa', 'etapa_nombre'];

export function validarAviso(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') return 'El cuerpo debe ser un objeto JSON.';
  const faltantes = CAMPOS_REQUERIDOS.filter((campo) => cuerpo[campo] === undefined || cuerpo[campo] === '');
  return faltantes.length ? `Faltan campos: ${faltantes.join(', ')}.` : null;
}

export function crearCentroNotificaciones() {
  const porCliente = new Map(); // cliente_id -> avisos recientes (el más nuevo primero)
  let io = null;

  return {
    conectarSocket(servidorIo) {
      io = servidorIo;
    },

    registrar(cuerpo) {
      const aviso = {
        id: crypto.randomUUID(),
        cliente_id: String(cuerpo.cliente_id),
        placa: cuerpo.placa,
        marca: cuerpo.marca ?? '',
        modelo: cuerpo.modelo ?? '',
        etapa: cuerpo.etapa,
        etapa_nombre: cuerpo.etapa_nombre,
        etapa_anterior_nombre: cuerpo.etapa_anterior_nombre ?? '',
        fecha: cuerpo.fecha ?? new Date().toISOString(),
        mensaje: `Tu moto ${cuerpo.placa} pasó a la etapa: ${cuerpo.etapa_nombre}.`,
      };
      const lista = porCliente.get(aviso.cliente_id) ?? [];
      lista.unshift(aviso);
      porCliente.set(aviso.cliente_id, lista.slice(0, MAX_POR_CLIENTE));

      let entregado = false;
      if (io) {
        const sala = `cliente:${aviso.cliente_id}`;
        entregado = (io.sockets.adapter.rooms.get(sala)?.size ?? 0) > 0;
        io.to(sala).emit('etapa:cambio', aviso);
      }
      return { aviso, entregado };
    },

    recientes(clienteId) {
      return porCliente.get(String(clienteId)) ?? [];
    },
  };
}
