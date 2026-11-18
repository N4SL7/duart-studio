"""Integración Django → Node.js (RF-12): aviso de cambio de etapa por webhook.

Cuando el administrador cambia la etapa de una moto, Django envía un POST al microservicio
Node.js, que reenvía el aviso por WebSocket al cliente. El envío se hace en un hilo aparte
y después de confirmar la transacción, para que una caída de Node nunca bloquee ni rompa
el cambio de etapa.
"""
import hashlib
import hmac
import json
import logging
import threading
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def token_cliente(cliente_id):
    """Token con el que el navegador del cliente se une a SU sala de Socket.IO en Node.

    Debe coincidir con firmarCliente() en servicio-node/src/notificaciones.js.
    """
    return hmac.new(
        settings.WEBHOOK_SECRET.encode(), f"cliente:{cliente_id}".encode(), hashlib.sha256
    ).hexdigest()


def construir_aviso(vehiculo, historial):
    return {
        "cliente_id": str(vehiculo.cliente_id),
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "etapa": vehiculo.etapa,
        "etapa_nombre": vehiculo.get_etapa_display(),
        "etapa_anterior_nombre": historial.get_etapa_anterior_display(),
        "fecha": historial.fecha.isoformat(),
    }


def enviar_webhook(aviso):
    """Envía el aviso a Node. Devuelve True si Node lo recibió."""
    url = f"{settings.NODE_SERVICE_URL.rstrip('/')}/api/notificaciones/etapa"
    peticion = urllib.request.Request(
        url,
        data=json.dumps(aviso).encode(),
        headers={"Content-Type": "application/json", "X-Webhook-Secret": settings.WEBHOOK_SECRET},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=3) as respuesta:
            logger.info("Webhook de etapa enviado a Node (%s): %s", respuesta.status, aviso["placa"])
            return True
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        logger.warning("No se pudo avisar a Node del cambio de etapa de %s: %s", aviso["placa"], error)
        return False


def notificar_cambio_etapa(vehiculo, historial):
    """Programa el aviso para después del commit. No hace nada si Node no está configurado."""
    if not settings.NODE_SERVICE_URL:
        return
    aviso = construir_aviso(vehiculo, historial)
    transaction.on_commit(
        lambda: threading.Thread(target=enviar_webhook, args=(aviso,), daemon=True).start()
    )
