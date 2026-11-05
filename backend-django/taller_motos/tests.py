from django.test import TestCase
from django.urls import reverse

from .models import Servicio


class PaginasPublicasTests(TestCase):
    """Pruebas de humo de las páginas del prototipo (RF-01, RF-02, RF-07, RF-16)."""

    fixtures = ["datos_iniciales"]

    def test_paginas_responden(self):
        for nombre in ["index", "galeria", "contacto", "servicio_list", "servicio_create"]:
            with self.subTest(pagina=nombre):
                respuesta = self.client.get(reverse(f"taller_motos:{nombre}"))
                self.assertEqual(respuesta.status_code, 200)

    def test_detalle_de_servicio(self):
        servicio = Servicio.objects.first()
        respuesta = self.client.get(reverse("taller_motos:servicio_detail", args=[servicio.id]))
        self.assertContains(respuesta, servicio.nombre)

    def test_crear_servicio(self):
        datos = {"nombre": "Lijado", "descripcion": "Preparación de superficie", "precio": "90000",
                 "duracion_estimada": "1 día", "imagen_url": ""}
        self.client.post(reverse("taller_motos:servicio_create"), datos)
        self.assertTrue(Servicio.objects.filter(nombre="Lijado").exists())
