from django.conf import settings
from django.db import models
from django.utils import timezone


class Servicio(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField()
    precio = models.DecimalField(max_digits=10, decimal_places=2, help_text="Precio de referencia en pesos colombianos")
    duracion_estimada = models.CharField(max_length=50, help_text="Ej: 1 hora, 30 min")
    imagen_url = models.URLField(blank=True, help_text="Enlace a una imagen del servicio")

    def __str__(self):
        return self.nombre


class Moto(models.Model):
    """Trabajo terminado que se exhibe en la galería pública (RF-02)."""

    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)
    anio = models.PositiveIntegerField()
    imagen_url = models.URLField(blank=True, help_text="Foto de la moto reparada/exhibida")
    descripcion = models.TextField(blank=True, help_text="Trabajo realizado o detalle de la moto")

    class Meta:
        verbose_name = "trabajo de galería"
        verbose_name_plural = "trabajos de galería"

    def __str__(self):
        return f"{self.marca} {self.modelo} ({self.anio})"


class Cita(models.Model):
    """Solicitud de cita desde el formulario de contacto (RF-07, RF-17)."""

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        CONFIRMADA = "confirmada", "Confirmada"
        CANCELADA = "cancelada", "Cancelada"

    nombre_cliente = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20)
    servicio = models.ForeignKey(Servicio, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_deseada = models.DateField()
    mensaje = models.TextField(blank=True)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PENDIENTE)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fecha_deseada"]

    def __str__(self):
        return f"Cita de {self.nombre_cliente} - {self.fecha_deseada}"


class PerfilCliente(models.Model):
    """Datos adicionales del cliente registrado (RF-08)."""

    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="perfil")
    telefono = models.CharField(max_length=20, blank=True)
    autoriza_datos = models.BooleanField(
        default=False, help_text="Autorización de tratamiento de datos personales (Ley 1581 de 2012)"
    )
    fecha_autorizacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "perfil de cliente"
        verbose_name_plural = "perfiles de clientes"

    def __str__(self):
        return self.usuario.get_full_name() or self.usuario.email


class Vehiculo(models.Model):
    """Moto de un cliente que está (o estará) en el taller: CRUD principal (RF-10, RF-11, RF-13, RF-14)."""

    class Etapa(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente de ingreso"
        ALISTAMIENTO = "alistamiento", "Alistamiento"
        LIJADO = "lijado", "Lijado"
        PREPARACION = "preparacion", "Preparación de pintura"
        DETALLADO = "detallado", "Detallado"
        PULIDO = "pulido", "Pulido"
        FINALIZADO = "finalizado", "Finalizado"

    # Las cinco etapas de trabajo que ve el cliente en "Mi Proceso".
    ETAPAS_PROCESO = [
        Etapa.ALISTAMIENTO,
        Etapa.LIJADO,
        Etapa.PREPARACION,
        Etapa.DETALLADO,
        Etapa.PULIDO,
    ]

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehiculos")
    servicio = models.ForeignKey(Servicio, on_delete=models.SET_NULL, null=True, blank=True)
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)
    placa = models.CharField(max_length=10, unique=True)
    color = models.CharField(max_length=40, blank=True)
    etapa = models.CharField(max_length=15, choices=Etapa.choices, default=Etapa.PENDIENTE)
    observaciones = models.TextField(blank=True)
    registrado_en = models.DateTimeField(auto_now_add=True)
    etapa_actualizada_en = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "vehículo"
        verbose_name_plural = "vehículos"
        ordering = ["-registrado_en"]

    def __str__(self):
        return f"{self.marca} {self.modelo} · {self.placa}"

    def save(self, *args, **kwargs):
        self.placa = self.placa.upper().replace(" ", "")
        super().save(*args, **kwargs)

    def cambiar_etapa(self, nueva_etapa, usuario=None):
        """Cambia la etapa, guarda la fecha y deja registro en el historial (RF-13)."""
        if nueva_etapa == self.etapa:
            return None
        anterior = self.etapa
        self.etapa = nueva_etapa
        self.etapa_actualizada_en = timezone.now()
        self.save(update_fields=["etapa", "etapa_actualizada_en"])
        return HistorialEtapa.objects.create(
            vehiculo=self, etapa_anterior=anterior, etapa_nueva=nueva_etapa, cambiado_por=usuario
        )

    def linea_de_tiempo(self):
        """Lista de (etiqueta, estado) para pintar las cinco etapas en Mi Proceso."""
        etapas = self.ETAPAS_PROCESO
        if self.etapa == self.Etapa.FINALIZADO:
            indice_actual = len(etapas)
        elif self.etapa == self.Etapa.PENDIENTE:
            indice_actual = -1
        else:
            indice_actual = etapas.index(self.etapa)
        resultado = []
        for i, etapa in enumerate(etapas):
            if i < indice_actual:
                estado = "hecha"
            elif i == indice_actual:
                estado = "actual"
            else:
                estado = "por-hacer"
            resultado.append((etapa.label, estado))
        return resultado


class HistorialEtapa(models.Model):
    """Registro de cada cambio de etapa con su fecha y responsable (RF-13)."""

    vehiculo = models.ForeignKey(Vehiculo, on_delete=models.CASCADE, related_name="historial")
    etapa_anterior = models.CharField(max_length=15, choices=Vehiculo.Etapa.choices)
    etapa_nueva = models.CharField(max_length=15, choices=Vehiculo.Etapa.choices)
    cambiado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "cambio de etapa"
        verbose_name_plural = "historial de etapas"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.vehiculo.placa}: {self.get_etapa_anterior_display()} → {self.get_etapa_nueva_display()}"
