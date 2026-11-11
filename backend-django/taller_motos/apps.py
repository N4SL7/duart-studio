from django.apps import AppConfig
from django.db.models.signals import post_migrate


class TallerMotosConfig(AppConfig):
    name = 'taller_motos'
    verbose_name = 'Taller DUART-STUDIO'

    def ready(self):
        from . import autenticacion  # noqa: F401  (registra las señales de login)
        from .roles import crear_grupos

        post_migrate.connect(crear_grupos, sender=self)
