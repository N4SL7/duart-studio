"""API REST interna que consume el microservicio Node.js (Entrega 3).

Solo Django escribe en la base de datos; Node.js lee por aquí.
- GET /api/servicios/                  -> público (precios de referencia)
- GET /api/vehiculos/<placa>/estado/   -> requiere la cabecera X-API-Key (clave compartida con Node)
"""
import hmac

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Servicio, Vehiculo


def _clave_valida(request):
    recibida = request.headers.get("X-API-Key", "")
    return bool(settings.SERVICIO_API_KEY) and hmac.compare_digest(recibida, settings.SERVICIO_API_KEY)


@require_GET
def servicios(request):
    datos = [
        {
            "id": s.id,
            "nombre": s.nombre,
            "descripcion": s.descripcion,
            "precio": str(s.precio),
            "duracion_estimada": s.duracion_estimada,
        }
        for s in Servicio.objects.order_by("precio")
    ]
    return JsonResponse({"servicios": datos})


def estado_publico(vehiculo):
    """Estado de la moto sin datos personales del dueño (lo que puede ver el asistente)."""
    etapas = Vehiculo.ETAPAS_PROCESO
    if vehiculo.etapa in etapas:
        paso = etapas.index(vehiculo.etapa) + 1
    elif vehiculo.etapa == Vehiculo.Etapa.FINALIZADO:
        paso = len(etapas)
    else:
        paso = 0
    return {
        "placa": vehiculo.placa,
        "marca": vehiculo.marca,
        "modelo": vehiculo.modelo,
        "etapa": vehiculo.etapa,
        "etapa_nombre": vehiculo.get_etapa_display(),
        "paso": paso,
        "total_pasos": len(etapas),
        "actualizado": vehiculo.etapa_actualizada_en.isoformat(),
    }


@require_GET
def estado_vehiculo(request, placa):
    if not _clave_valida(request):
        return JsonResponse({"error": "Clave de servicio inválida."}, status=401)
    placa = placa.upper().replace(" ", "").replace("-", "")
    vehiculo = Vehiculo.objects.filter(placa=placa).first()
    if vehiculo is None:
        return JsonResponse({"error": "No existe un vehículo con esa placa."}, status=404)
    return JsonResponse(estado_publico(vehiculo))
