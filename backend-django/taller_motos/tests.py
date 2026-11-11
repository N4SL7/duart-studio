from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from .autenticacion import MAX_INTENTOS
from .models import Cita, HistorialEtapa, Servicio, Vehiculo
from .roles import ADMINISTRADOR, CLIENTE

Usuario = get_user_model()
CLAVE = "ClaveSegura2026*"


def crear_usuario(correo, rol, **extra):
    usuario = Usuario.objects.create_user(username=correo, email=correo, password=CLAVE, first_name="Prueba", **extra)
    usuario.groups.add(Group.objects.get(name=rol))
    return usuario


class PaginasPublicasTests(TestCase):
    """Pruebas de humo del sitio público (RF-01, RF-02, RF-07)."""

    fixtures = ["datos_iniciales"]

    def test_paginas_responden(self):
        for nombre in ["index", "galeria", "contacto", "login", "registro"]:
            with self.subTest(pagina=nombre):
                respuesta = self.client.get(reverse(f"taller_motos:{nombre}"))
                self.assertEqual(respuesta.status_code, 200)

    def test_detalle_de_servicio(self):
        servicio = Servicio.objects.first()
        respuesta = self.client.get(reverse("taller_motos:servicio_detail", args=[servicio.id]))
        self.assertContains(respuesta, servicio.nombre)

    def test_cita_queda_pendiente(self):
        self.client.post(reverse("taller_motos:contacto"),
                         {"nombre_cliente": "Ana", "telefono": "300", "fecha_deseada": "2026-12-01"})
        self.assertEqual(Cita.objects.get(nombre_cliente="Ana").estado, Cita.Estado.PENDIENTE)


class RegistroYLoginTests(TestCase):
    """RF-08, RF-09 y RF-15."""

    def setUp(self):
        cache.clear()

    def datos_registro(self, **cambios):
        datos = {"first_name": "Laura", "last_name": "Gómez", "email": "laura@correo.co", "telefono": "300",
                 "password1": CLAVE, "password2": CLAVE, "autoriza_datos": "on"}
        datos.update(cambios)
        return datos

    def test_registro_crea_cliente_con_autorizacion(self):
        respuesta = self.client.post(reverse("taller_motos:registro"), self.datos_registro())
        self.assertRedirects(respuesta, reverse("taller_motos:mi_proceso"))
        usuario = Usuario.objects.get(email="laura@correo.co")
        self.assertTrue(usuario.groups.filter(name=CLIENTE).exists())
        self.assertTrue(usuario.perfil.autoriza_datos)
        self.assertFalse(usuario.is_staff)
        self.assertNotEqual(usuario.password, CLAVE)  # Contraseña cifrada.

    def test_registro_exige_autorizacion_de_datos(self):
        datos = self.datos_registro()
        del datos["autoriza_datos"]
        self.client.post(reverse("taller_motos:registro"), datos)
        self.assertFalse(Usuario.objects.filter(email="laura@correo.co").exists())

    def test_correo_unico(self):
        crear_usuario("laura@correo.co", CLIENTE)
        respuesta = self.client.post(reverse("taller_motos:registro"), self.datos_registro(email="LAURA@correo.co"))
        self.assertContains(respuesta, "Ya existe una cuenta con este correo")

    def test_login_con_correo_redirige_segun_rol(self):
        crear_usuario("cliente@correo.co", CLIENTE)
        crear_usuario("admin@correo.co", ADMINISTRADOR, is_staff=True)
        url = reverse("taller_motos:login")
        r = self.client.post(url, {"username": "cliente@correo.co", "password": CLAVE}, follow=True)
        self.assertEqual(r.redirect_chain[-1][0], reverse("taller_motos:mi_proceso"))
        self.client.logout()
        r = self.client.post(url, {"username": "admin@correo.co", "password": CLAVE}, follow=True)
        self.assertEqual(r.redirect_chain[-1][0], reverse("taller_motos:vehiculo_list"))

    def test_mensaje_de_error_generico(self):
        respuesta = self.client.post(reverse("taller_motos:login"), {"username": "nadie@correo.co", "password": "x"})
        self.assertContains(respuesta, "Correo o contraseña incorrectos.")

    def test_bloqueo_por_intentos_fallidos(self):
        crear_usuario("cliente@correo.co", CLIENTE)
        url = reverse("taller_motos:login")
        for _ in range(MAX_INTENTOS):
            self.client.post(url, {"username": "cliente@correo.co", "password": "incorrecta"})
        respuesta = self.client.post(url, {"username": "cliente@correo.co", "password": CLAVE})
        self.assertContains(respuesta, "Demasiados intentos fallidos")
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_logout(self):
        usuario = crear_usuario("cliente@correo.co", CLIENTE)
        self.client.force_login(usuario)
        self.client.post(reverse("taller_motos:logout"))
        self.assertNotIn("_auth_user_id", self.client.session)


class RolesTests(TestCase):
    """Rutas privadas protegidas por sesión y por rol."""

    def setUp(self):
        self.cliente = crear_usuario("cliente@correo.co", CLIENTE)
        self.admin = crear_usuario("admin@correo.co", ADMINISTRADOR, is_staff=True)

    def test_visitante_es_enviado_al_login(self):
        for nombre in ["mi_proceso", "vehiculo_list", "servicio_list", "cita_list"]:
            with self.subTest(pagina=nombre):
                respuesta = self.client.get(reverse(f"taller_motos:{nombre}"))
                self.assertRedirects(respuesta, f"{reverse('taller_motos:login')}?next={reverse(f'taller_motos:{nombre}')}")

    def test_cliente_no_entra_al_panel(self):
        self.client.force_login(self.cliente)
        for nombre in ["vehiculo_list", "vehiculo_create", "servicio_list", "servicio_create", "cita_list"]:
            with self.subTest(pagina=nombre):
                self.assertEqual(self.client.get(reverse(f"taller_motos:{nombre}")).status_code, 403)

    def test_cliente_no_entra_a_django_admin(self):
        self.client.force_login(self.cliente)
        respuesta = self.client.get(reverse("admin:index"))
        self.assertEqual(respuesta.status_code, 302)

    def test_administrador_entra_a_django_admin(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:taller_motos_vehiculo_changelist")).status_code, 200)

    def test_grupos_tienen_permisos(self):
        self.assertTrue(self.admin.has_perm("taller_motos.change_vehiculo"))
        self.assertTrue(self.cliente.has_perm("taller_motos.add_vehiculo"))
        self.assertFalse(self.cliente.has_perm("taller_motos.delete_vehiculo"))


class VehiculoCrudTests(TestCase):
    """CRUD principal de vehículos (RF-10, RF-11, RF-13, RF-14)."""

    fixtures = ["datos_iniciales"]

    def setUp(self):
        self.cliente = crear_usuario("cliente@correo.co", CLIENTE)
        self.otro_cliente = crear_usuario("otro@correo.co", CLIENTE)
        self.admin = crear_usuario("admin@correo.co", ADMINISTRADOR, is_staff=True)
        self.vehiculo = Vehiculo.objects.create(cliente=self.cliente, marca="Yamaha", modelo="FZ", placa="abc 12d")

    def test_placa_en_mayusculas(self):
        self.assertEqual(self.vehiculo.placa, "ABC12D")

    def test_cliente_registra_su_moto(self):
        self.client.force_login(self.cliente)
        self.client.post(reverse("taller_motos:vehiculo_registrar"),
                         {"marca": "Honda", "modelo": "CB 190R", "placa": "XYZ34E", "color": "Rojo"})
        vehiculo = Vehiculo.objects.get(placa="XYZ34E")
        self.assertEqual(vehiculo.cliente, self.cliente)
        self.assertEqual(vehiculo.etapa, Vehiculo.Etapa.PENDIENTE)

    def test_mi_proceso_muestra_solo_mis_motos(self):
        Vehiculo.objects.create(cliente=self.otro_cliente, marca="AKT", modelo="NKD", placa="ZZZ99Z")
        self.client.force_login(self.cliente)
        respuesta = self.client.get(reverse("taller_motos:mi_proceso"))
        self.assertContains(respuesta, "ABC12D")
        self.assertNotContains(respuesta, "ZZZ99Z")
        self.assertContains(respuesta, "Preparación de pintura")  # Muestra las cinco etapas.

    def test_cliente_no_ve_moto_ajena(self):
        self.client.force_login(self.otro_cliente)
        respuesta = self.client.get(reverse("taller_motos:vehiculo_detail", args=[self.vehiculo.id]))
        self.assertEqual(respuesta.status_code, 403)

    def test_admin_crea_edita_y_elimina(self):
        self.client.force_login(self.admin)
        self.client.post(reverse("taller_motos:vehiculo_create"),
                         {"cliente": self.cliente.id, "marca": "Suzuki", "modelo": "Gixxer", "placa": "QWE56F",
                          "etapa": "pendiente"})
        nuevo = Vehiculo.objects.get(placa="QWE56F")

        self.client.post(reverse("taller_motos:vehiculo_update", args=[nuevo.id]),
                         {"cliente": self.cliente.id, "marca": "Suzuki", "modelo": "Gixxer 150", "placa": "QWE56F",
                          "etapa": "lijado"})
        nuevo.refresh_from_db()
        self.assertEqual(nuevo.modelo, "Gixxer 150")
        self.assertEqual(nuevo.etapa, "lijado")
        self.assertEqual(nuevo.historial.count(), 1)  # El cambio de etapa quedó registrado.

        self.client.post(reverse("taller_motos:vehiculo_delete", args=[nuevo.id]))
        self.assertFalse(Vehiculo.objects.filter(placa="QWE56F").exists())

    def test_admin_cambia_etapa_y_queda_historial(self):
        self.client.force_login(self.admin)
        self.client.post(reverse("taller_motos:vehiculo_cambiar_etapa", args=[self.vehiculo.id]),
                         {"etapa": "alistamiento"})
        self.vehiculo.refresh_from_db()
        self.assertEqual(self.vehiculo.etapa, "alistamiento")
        cambio = HistorialEtapa.objects.get(vehiculo=self.vehiculo)
        self.assertEqual((cambio.etapa_anterior, cambio.etapa_nueva, cambio.cambiado_por),
                         ("pendiente", "alistamiento", self.admin))

    def test_filtro_por_etapa_y_cliente(self):
        Vehiculo.objects.create(cliente=self.otro_cliente, marca="AKT", modelo="NKD", placa="ZZZ99Z", etapa="lijado")
        self.client.force_login(self.admin)
        r = self.client.get(reverse("taller_motos:vehiculo_list"), {"etapa": "lijado"})
        self.assertContains(r, "ZZZ99Z")
        self.assertNotContains(r, "ABC12D")
        r = self.client.get(reverse("taller_motos:vehiculo_list"), {"cliente": self.cliente.id})
        self.assertContains(r, "ABC12D")
        self.assertNotContains(r, "ZZZ99Z")

    def test_linea_de_tiempo(self):
        self.vehiculo.cambiar_etapa("preparacion")
        estados = [estado for _, estado in self.vehiculo.linea_de_tiempo()]
        self.assertEqual(estados, ["hecha", "hecha", "actual", "por-hacer", "por-hacer"])


class ServicioYCitaAdminTests(TestCase):
    """CRUD de servicios (RF-16) y estado de citas (RF-17) para el administrador."""

    fixtures = ["datos_iniciales"]

    def setUp(self):
        self.admin = crear_usuario("admin@correo.co", ADMINISTRADOR, is_staff=True)
        self.client.force_login(self.admin)

    def test_crear_servicio(self):
        datos = {"nombre": "Lijado", "descripcion": "Preparación de superficie", "precio": "90000",
                 "duracion_estimada": "1 día", "imagen_url": ""}
        self.client.post(reverse("taller_motos:servicio_create"), datos)
        self.assertTrue(Servicio.objects.filter(nombre="Lijado").exists())

    def test_cambiar_estado_de_cita(self):
        cita = Cita.objects.create(nombre_cliente="Ana", telefono="300", fecha_deseada="2026-12-01")
        self.client.post(reverse("taller_motos:cita_list"), {"cita_id": cita.id, "estado": "confirmada"})
        cita.refresh_from_db()
        self.assertEqual(cita.estado, Cita.Estado.CONFIRMADA)
