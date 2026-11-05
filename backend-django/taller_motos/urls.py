from django.urls import path

from . import views

app_name = "taller_motos"

urlpatterns = [
    path("", views.index, name="index"),
    path("servicio/<int:servicio_id>/", views.servicio_detail, name="servicio_detail"),
    path("galeria/", views.galeria, name="galeria"),
    path("contacto/", views.contacto, name="contacto"),
    path("servicios/", views.servicio_list, name="servicio_list"),
    path("servicios/nuevo/", views.servicio_create, name="servicio_create"),
    path("servicios/<int:servicio_id>/editar/", views.servicio_update, name="servicio_update"),
    path("servicios/<int:servicio_id>/eliminar/", views.servicio_delete, name="servicio_delete"),
]
