// Chat del asistente virtual y avisos de cambio de etapa en tiempo real.
// Se conecta por Socket.IO al microservicio Node.js. Si Node no está disponible,
// el widget simplemente no aparece y el resto del sitio funciona igual.
(function () {
  'use strict';

  var config = JSON.parse(document.getElementById('config-node').textContent);
  if (typeof window.io !== 'function') return; // Node no respondió: no se muestra el chat.

  var socket = window.io(config.url, { transports: ['websocket', 'polling'] });
  var contenedor = document.getElementById('asistente');
  var panel = document.getElementById('asistente-panel');
  var botonAbrir = document.getElementById('asistente-abrir');
  var mensajes = document.getElementById('asistente-mensajes');
  var formulario = document.getElementById('asistente-form');
  var entrada = document.getElementById('asistente-texto');
  var saludoMostrado = false;

  contenedor.hidden = false;

  function agregarMensaje(texto, autor, enlaceWhatsapp, fuente) {
    var burbuja = document.createElement('div');
    burbuja.className = 'burbuja burbuja-' + autor;
    burbuja.textContent = texto; // textContent: evita inyectar HTML
    if (fuente === 'ia') {
      var etiqueta = document.createElement('small');
      etiqueta.className = 'burbuja-fuente';
      etiqueta.textContent = 'Respuesta generada con IA';
      burbuja.appendChild(etiqueta);
    }
    if (enlaceWhatsapp) {
      var enlace = document.createElement('a');
      enlace.href = enlaceWhatsapp;
      enlace.target = '_blank';
      enlace.rel = 'noopener';
      enlace.className = 'burbuja-whatsapp';
      enlace.textContent = 'Continuar por WhatsApp';
      burbuja.appendChild(enlace);
    }
    mensajes.appendChild(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
    return burbuja;
  }

  function abrir(abierto) {
    panel.hidden = !abierto;
    botonAbrir.setAttribute('aria-expanded', String(abierto));
    if (abierto) {
      if (!saludoMostrado) {
        agregarMensaje('¡Hola! Pregúntame por servicios, precios, horario o escribe la placa de tu moto para saber en qué etapa va.', 'asistente');
        saludoMostrado = true;
      }
      entrada.focus();
    }
  }

  botonAbrir.addEventListener('click', function () { abrir(panel.hidden); });
  document.getElementById('asistente-cerrar').addEventListener('click', function () { abrir(false); });

  formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();
    var texto = entrada.value.trim();
    if (!texto) return;
    agregarMensaje(texto, 'usuario');
    entrada.value = '';
    var escribiendo = agregarMensaje('Escribiendo…', 'asistente');
    escribiendo.classList.add('burbuja-cargando');

    socket.timeout(45000).emit('chat:mensaje', { mensaje: texto }, function (error, respuesta) {
      escribiendo.remove();
      if (error || !respuesta) {
        agregarMensaje('No pude conectarme con el asistente. Intenta de nuevo en un momento.', 'asistente');
        return;
      }
      agregarMensaje(respuesta.respuesta, 'asistente', respuesta.whatsapp, respuesta.fuente);
    });
  });

  // --- Avisos de cambio de etapa (solo clientes con sesión) ---
  if (config.clienteId && config.token) {
    var unirse = function () {
      socket.emit('cliente:unirse', { cliente_id: config.clienteId, token: config.token });
    };
    socket.on('connect', unirse); // también al reconectar

    socket.on('etapa:cambio', function (aviso) {
      var avisos = document.getElementById('avisos');
      var tarjeta = document.createElement('div');
      tarjeta.className = 'aviso';
      tarjeta.setAttribute('role', 'status');
      var titulo = document.createElement('strong');
      titulo.textContent = '🔔 Tu moto avanzó de etapa';
      var detalle = document.createElement('span');
      detalle.textContent = aviso.marca + ' ' + aviso.modelo + ' (' + aviso.placa + '): ' + aviso.etapa_nombre;
      tarjeta.appendChild(titulo);
      tarjeta.appendChild(detalle);
      avisos.appendChild(tarjeta);
      setTimeout(function () { tarjeta.remove(); }, 8000);

      // En "Mi Proceso" se recarga la línea de tiempo para mostrar la etapa nueva.
      if (document.body.dataset.pagina === 'mi-proceso') {
        setTimeout(function () { window.location.reload(); }, 2500);
      }
    });
  }
})();
