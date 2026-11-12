"""Carga los datos de demostración en la base de datos SQLite.

Uso:  python manage.py cargar_datos_demo

Es idempotente: se puede ejecutar varias veces sin duplicar registros.
"""
import os
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from taller_motos.models import Cita, PerfilCliente, Servicio, Vehiculo
from taller_motos.roles import ADMINISTRADOR, CLIENTE, crear_grupos

ADMIN = {"username": "admin", "email": "admin@duartstudio.co", "password": os.environ.get("DJANGO_ADMIN_PASSWORD", "DuartAdmin2026*"),  # en producción se define por variable de entorno
         "first_name": "Administrador", "last_name": "DUART-STUDIO"}

CLIENTES = [
    {"email": "cliente@duartstudio.co", "password": "Cliente2026*", "first_name": "Laura", "last_name": "Gómez",
     "telefono": "3001234567"},
    {"email": "andres.rojas@correo.co", "password": "Cliente2026*", "first_name": "Andrés", "last_name": "Rojas",
     "telefono": "3109876543"},
]

VEHICULOS = [
    # (correo cliente, marca, modelo, placa, color, servicio pk, etapas recorridas)
    ("cliente@duartstudio.co", "Yamaha", "MT-03", "ABC12D", "Azul", 1, ["alistamiento", "lijado", "preparacion"]),
    ("cliente@duartstudio.co", "Honda", "XR 150L", "XYZ34E", "Rojo", 3, []),
    ("andres.rojas@correo.co", "Suzuki", "Gixxer 150", "QWE56F", "Negro mate", 2,
     ["alistamiento", "lijado", "preparacion", "detallado", "pulido", "finalizado"]),
    ("andres.rojas@correo.co", "AKT", "NKD 125", "RTY78G", "Blanco", 1, ["alistamiento"]),
]


class Command(BaseCommand):
    help = "Crea roles, usuarios de prueba y datos de ejemplo para la demostración."

    @transaction.atomic
    def handle(self, *args, **options):
        Usuario = get_user_model()
        crear_grupos()
        grupo_admin = Group.objects.get(name=ADMINISTRADOR)
        grupo_cliente = Group.objects.get(name=CLIENTE)

        call_command("loaddata", "datos_iniciales", verbosity=0)
        self.stdout.write("✔ Servicios y galería (fixture datos_iniciales)")

        admin, creado = Usuario.objects.get_or_create(
            username=ADMIN["username"],
            defaults={"email": ADMIN["email"], "first_name": ADMIN["first_name"], "last_name": ADMIN["last_name"],
                      "is_staff": True, "is_superuser": True},
        )
        if creado:
            admin.set_password(ADMIN["password"])
            admin.save()
        admin.groups.add(grupo_admin)
        clave = "(definida en DJANGO_ADMIN_PASSWORD)" if os.environ.get("DJANGO_ADMIN_PASSWORD") else ADMIN["password"]
        self.stdout.write(f"✔ Administrador: {ADMIN['email']} / {clave}")

        for datos in CLIENTES:
            cliente, creado = Usuario.objects.get_or_create(
                username=datos["email"],
                defaults={"email": datos["email"], "first_name": datos["first_name"], "last_name": datos["last_name"]},
            )
            if creado:
                cliente.set_password(datos["password"])
                cliente.save()
            cliente.groups.add(grupo_cliente)
            PerfilCliente.objects.get_or_create(
                usuario=cliente,
                defaults={"telefono": datos["telefono"], "autoriza_datos": True, "fecha_autorizacion": timezone.now()},
            )
            self.stdout.write(f"✔ Cliente: {datos['email']} / {datos['password']}")

        for correo, marca, modelo, placa, color, servicio_pk, etapas in VEHICULOS:
            vehiculo, creado = Vehiculo.objects.get_or_create(
                placa=placa,
                defaults={"cliente": Usuario.objects.get(username=correo), "marca": marca, "modelo": modelo,
                          "color": color, "servicio": Servicio.objects.filter(pk=servicio_pk).first()},
            )
            if creado:
                for etapa in etapas:
                    vehiculo.cambiar_etapa(etapa, admin)
        self.stdout.write(f"✔ Vehículos en taller: {Vehiculo.objects.count()}")

        hoy = date.today()
        citas = [
            ("Camila Torres", "3205551122", 1, hoy + timedelta(days=2), Cita.Estado.PENDIENTE),
            ("Julián Pérez", "3014443322", 3, hoy + timedelta(days=4), Cita.Estado.CONFIRMADA),
            ("Sofía Ramírez", "3157778899", 2, hoy + timedelta(days=6), Cita.Estado.CANCELADA),
        ]
        for nombre, telefono, servicio_pk, fecha, estado in citas:
            Cita.objects.get_or_create(
                nombre_cliente=nombre,
                defaults={"telefono": telefono, "servicio_id": servicio_pk, "fecha_deseada": fecha, "estado": estado,
                          "mensaje": "Cita de ejemplo"},
            )
        self.stdout.write(f"✔ Citas: {Cita.objects.count()}")
        self.stdout.write(self.style.SUCCESS("Datos de demostración listos."))
