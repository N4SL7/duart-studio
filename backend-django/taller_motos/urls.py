from django.contrib.auth.views import LogoutView
from django.urls import path

from . import views

app_name = "taller_motos"

urlpatterns = [
    # Sitio público
    path("", views.index, name="index"),
    path("servicio/<int:servicio_id>/", views.servicio_detail, name="servicio_detail"),
    path("galeria/", views.galeria, name="galeria"),
    path("contacto/", views.contacto, name="contacto"),

    # Cuentas
    path("cuenta/registro/", views.registro, name="registro"),
    path("cuenta/ingresar/", views.IniciarSesionView.as_view(), name="login"),
    path("cuenta/salir/", LogoutView.as_view(next_page="taller_motos:index"), name="logout"),
    path("cuenta/inicio/", views.inicio_por_rol, name="inicio_por_rol"),

    # Cliente
    path("mi-proceso/", views.mi_proceso, name="mi_proceso"),
    path("mi-proceso/registrar-moto/", views.vehiculo_registrar, name="vehiculo_registrar"),

    # Panel del taller (administrador): CRUD principal de vehículos
    path("panel/vehiculos/", views.vehiculo_list, name="vehiculo_list"),
    path("panel/vehiculos/nuevo/", views.vehiculo_create, name="vehiculo_create"),
    path("panel/vehiculos/<int:vehiculo_id>/", views.vehiculo_detail, name="vehiculo_detail"),
    path("panel/vehiculos/<int:vehiculo_id>/editar/", views.vehiculo_update, name="vehiculo_update"),
    path("panel/vehiculos/<int:vehiculo_id>/eliminar/", views.vehiculo_delete, name="vehiculo_delete"),
    path("panel/vehiculos/<int:vehiculo_id>/etapa/", views.vehiculo_cambiar_etapa, name="vehiculo_cambiar_etapa"),
    path("panel/citas/", views.cita_list, name="cita_list"),

    # Panel del taller: CRUD de servicios
    path("servicios/", views.servicio_list, name="servicio_list"),
    path("servicios/nuevo/", views.servicio_create, name="servicio_create"),
    path("servicios/<int:servicio_id>/editar/", views.servicio_update, name="servicio_update"),
    path("servicios/<int:servicio_id>/eliminar/", views.servicio_delete, name="servicio_delete"),
]
