from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from .models import Cita, HistorialEtapa, Moto, PerfilCliente, Servicio, Vehiculo

admin.site.site_header = "DUART-STUDIO · Panel del taller"
admin.site.site_title = "DUART-STUDIO"
admin.site.index_title = "Gestión del taller"

Usuario = get_user_model()


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "precio", "duracion_estimada")
    search_fields = ("nombre", "descripcion")


@admin.register(Moto)
class MotoAdmin(admin.ModelAdmin):
    list_display = ("marca", "modelo", "anio")
    search_fields = ("marca", "modelo")
    list_filter = ("marca",)


@admin.register(Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ("nombre_cliente", "telefono", "servicio", "fecha_deseada", "estado", "creada_en")
    list_filter = ("estado", "servicio", "fecha_deseada")
    list_editable = ("estado",)
    search_fields = ("nombre_cliente", "telefono")
    date_hierarchy = "fecha_deseada"


class HistorialEtapaInline(admin.TabularInline):
    model = HistorialEtapa
    extra = 0
    readonly_fields = ("etapa_anterior", "etapa_nueva", "cambiado_por", "fecha")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Vehiculo)
class VehiculoAdmin(admin.ModelAdmin):
    list_display = ("placa", "marca", "modelo", "cliente", "servicio", "etapa", "etapa_actualizada_en")
    list_filter = ("etapa", "servicio", "cliente")
    search_fields = ("placa", "marca", "modelo", "cliente__email", "cliente__first_name")
    readonly_fields = ("registrado_en", "etapa_actualizada_en")
    inlines = [HistorialEtapaInline]
    actions = ["avanzar_etapa"]

    def save_model(self, request, obj, form, change):
        """Si cambia la etapa desde el admin, también queda registrada en el historial (RF-13)."""
        if change and "etapa" in form.changed_data:
            nueva_etapa = obj.etapa
            obj.etapa = form.initial["etapa"]
            super().save_model(request, obj, form, change)
            obj.cambiar_etapa(nueva_etapa, request.user)
        else:
            super().save_model(request, obj, form, change)

    @admin.action(description="Avanzar a la siguiente etapa")
    def avanzar_etapa(self, request, queryset):
        orden = [valor for valor, _ in Vehiculo.Etapa.choices]
        avanzados = 0
        for vehiculo in queryset:
            indice = orden.index(vehiculo.etapa)
            if indice < len(orden) - 1:
                vehiculo.cambiar_etapa(orden[indice + 1], request.user)
                avanzados += 1
        self.message_user(request, f"{avanzados} vehículo(s) avanzaron de etapa.")


@admin.register(HistorialEtapa)
class HistorialEtapaAdmin(admin.ModelAdmin):
    list_display = ("vehiculo", "etapa_anterior", "etapa_nueva", "cambiado_por", "fecha")
    list_filter = ("etapa_nueva", "fecha")
    readonly_fields = ("vehiculo", "etapa_anterior", "etapa_nueva", "cambiado_por", "fecha")

    def has_add_permission(self, request):
        return False


@admin.register(PerfilCliente)
class PerfilClienteAdmin(admin.ModelAdmin):
    list_display = ("usuario", "telefono", "autoriza_datos", "fecha_autorizacion")
    list_filter = ("autoriza_datos",)
    search_fields = ("usuario__email", "usuario__first_name", "usuario__last_name")


class PerfilClienteInline(admin.StackedInline):
    model = PerfilCliente
    can_delete = False
    extra = 0


admin.site.unregister(Usuario)


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    inlines = [PerfilClienteInline]
    list_display = ("username", "email", "first_name", "last_name", "roles", "is_staff", "is_active")
    list_filter = ("groups", "is_staff", "is_active")

    @admin.display(description="Roles")
    def roles(self, obj):
        return ", ".join(obj.groups.values_list("name", flat=True)) or "—"
