from django.conf import settings

from .notificaciones import token_cliente
from .roles import es_administrador, es_cliente


def rol(request):
    """Expone el rol del usuario a todas las plantillas (menú según el rol)."""
    usuario = request.user
    administrador = es_administrador(usuario)
    cliente = not administrador and es_cliente(usuario)
    if administrador:
        nombre = "Administrador"
    elif cliente:
        nombre = "Cliente"
    else:
        nombre = "Visitante"
    return {"es_administrador": administrador, "rol_usuario": nombre, "es_cliente": cliente}


def servicio_node(request):
    """Datos para el chat del asistente y los avisos en tiempo real (microservicio Node.js)."""
    contexto = {"node_public_url": settings.NODE_PUBLIC_URL}
    if settings.NODE_PUBLIC_URL and request.user.is_authenticated and es_cliente(request.user):
        contexto["socket_cliente_id"] = request.user.id
        contexto["socket_token"] = token_cliente(request.user.id)
    return contexto
