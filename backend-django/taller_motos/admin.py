from django.contrib import admin
from .models import Servicio, Moto, Cita


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "precio", "duracion_estimada")


@admin.register(Moto)
class MotoAdmin(admin.ModelAdmin):
    list_display = ("marca", "modelo", "anio")


@admin.register(Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ("nombre_cliente", "telefono", "servicio", "fecha_deseada", "creada_en")
    list_filter = ("servicio", "fecha_deseada")
