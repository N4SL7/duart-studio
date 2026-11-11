from .roles import es_administrador, es_cliente


def rol(request):
    """Expone el rol del usuario a todas las plantillas (menú según el rol)."""
    usuario = request.user
    administrador = es_administrador(usuario)
    if administrador:
        nombre = "Administrador"
    elif es_cliente(usuario):
        nombre = "Cliente"
    else:
        nombre = "Visitante"
    return {"es_administrador": administrador, "rol_usuario": nombre}
