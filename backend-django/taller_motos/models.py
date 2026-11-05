from django.db import models


class Servicio(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField()
    precio = models.DecimalField(max_digits=10, decimal_places=2, help_text="Precio de referencia en pesos colombianos")
    duracion_estimada = models.CharField(max_length=50, help_text="Ej: 1 hora, 30 min")
    imagen_url = models.URLField(blank=True, help_text="Enlace a una imagen del servicio")

    def __str__(self):
        return self.nombre


class Moto(models.Model):
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=50)
    anio = models.PositiveIntegerField()
    imagen_url = models.URLField(blank=True, help_text="Foto de la moto reparada/exhibida")
    descripcion = models.TextField(blank=True, help_text="Trabajo realizado o detalle de la moto")

    def __str__(self):
        return f"{self.marca} {self.modelo} ({self.anio})"


class Cita(models.Model):
    nombre_cliente = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20)
    servicio = models.ForeignKey(Servicio, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_deseada = models.DateField()
    mensaje = models.TextField(blank=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cita de {self.nombre_cliente} - {self.fecha_deseada}"
