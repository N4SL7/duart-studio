"""Autenticación por correo o usuario, con límite de intentos fallidos (RF-09, RF-15).

Se usa tanto en el login del sitio como en el login de Django Admin.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from django.dispatch import receiver

MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15


def _clave(identificador):
    return f"intentos-login:{(identificador or '').strip().lower()}"


def esta_bloqueado(identificador):
    return cache.get(_clave(identificador), 0) >= MAX_INTENTOS


class CorreoOUsuarioBackend(ModelBackend):
    """Permite iniciar sesión con el correo o con el nombre de usuario."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(get_user_model().USERNAME_FIELD)
        if not username or password is None:
            return None
        if esta_bloqueado(username):
            # Detiene la cadena de backends: la cuenta está bloqueada temporalmente.
            raise PermissionDenied

        Usuario = get_user_model()
        usuario = (
            Usuario.objects.filter(email__iexact=username).order_by("id").first()
            or Usuario.objects.filter(username__iexact=username).first()
        )
        if usuario is None:
            Usuario().set_password(password)  # Iguala el tiempo de respuesta (evita enumerar usuarios).
            return None
        if usuario.check_password(password) and self.user_can_authenticate(usuario):
            return usuario
        return None


@receiver(user_login_failed)
def registrar_intento_fallido(sender, credentials, **kwargs):
    identificador = credentials.get("username")
    if not identificador:
        return
    clave = _clave(identificador)
    cache.add(clave, 0, timeout=MINUTOS_BLOQUEO * 60)
    try:
        cache.incr(clave)
    except ValueError:
        cache.set(clave, 1, timeout=MINUTOS_BLOQUEO * 60)


@receiver(user_logged_in)
def limpiar_intentos(sender, request, user, **kwargs):
    cache.delete(_clave(user.username))
    if user.email:
        cache.delete(_clave(user.email))
