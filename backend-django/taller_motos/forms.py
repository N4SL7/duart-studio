from django import forms

from .models import Servicio


class ServicioForm(forms.ModelForm):
    class Meta:
        model = Servicio
        fields = ["nombre", "descripcion", "precio", "duracion_estimada", "imagen_url"]
        widgets = {
            "descripcion": forms.Textarea(attrs={"rows": 4}),
        }
