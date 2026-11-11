"""Roles del sistema (SRS 2.6): Visitante (sin sesión), Cliente registrado y Administrador del taller.

Los roles se implementan con los grupos de Django. Los grupos y sus permisos se crean
automáticamente después de cada ``migrate`` (ver ``apps.py``).
"""
from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

ADMINISTRADOR = "Administrador"
CLIENTE = "Cliente"

# Permisos de cada grupo: (app_label, codename).
PERMISOS_POR_ROL = {
    ADMINISTRADOR: [
        (app, f"{accion}_{modelo}")
        for app, modelos in {
            "taller_motos": ["servicio", "moto", "cita", "vehiculo", "historialetapa", "perfilcliente"],
            "auth": ["user"],
        }.items()
        for modelo in modelos
        for accion in ("add", "change", "delete", "view")
    ],
    CLIENTE: [
        ("taller_motos", "add_vehiculo"),
        ("taller_motos", "view_vehiculo"),
    ],
}


def es_administrador(usuario):
    return usuario.is_authenticated and (
        usuario.is_superuser or usuario.groups.filter(name=ADMINISTRADOR).exists()
    )


def es_cliente(usuario):
    return usuario.is_authenticated and usuario.groups.filter(name=CLIENTE).exists()


def rol_requerido(*roles):
    """Decorador para vistas: exige sesión iniciada y pertenecer a alguno de los roles."""
    comprobaciones = {ADMINISTRADOR: es_administrador, CLIENTE: es_cliente}

    def decorador(vista):
        @wraps(vista)
        def envoltura(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            if any(comprobaciones[rol](request.user) for rol in roles):
                return vista(request, *args, **kwargs)
            raise PermissionDenied  # Muestra templates/403.html

        return envoltura

    return decorador


def crear_grupos(**kwargs):
    """Crea (o actualiza) los grupos de roles con sus permisos. Se ejecuta tras cada migrate."""
    from django.contrib.auth.models import Group, Permission

    for nombre, permisos in PERMISOS_POR_ROL.items():
        grupo, _ = Group.objects.get_or_create(name=nombre)
        objetos = []
        for app_label, codename in permisos:
            permiso = Permission.objects.filter(content_type__app_label=app_label, codename=codename).first()
            if permiso:
                objetos.append(permiso)
        grupo.permissions.set(objetos)
