from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.utils import timezone

from .models import Cita, PerfilCliente, Servicio, Vehiculo
from .roles import CLIENTE

Usuario = get_user_model()


class ServicioForm(forms.ModelForm):
    class Meta:
        model = Servicio
        fields = ["nombre", "descripcion", "precio", "duracion_estimada", "imagen_url"]
        widgets = {
            "descripcion": forms.Textarea(attrs={"rows": 4}),
        }


# --- Autenticación (RF-08, RF-09) ---

class LoginForm(AuthenticationForm):
    username = forms.CharField(label="Correo o usuario", widget=forms.TextInput(attrs={"autofocus": True}))

    error_messages = {
        # Mensaje genérico: no revela si el correo existe.
        "invalid_login": "Correo o contraseña incorrectos.",
        "inactive": "Correo o contraseña incorrectos.",
    }


class RegistroForm(UserCreationForm):
    first_name = forms.CharField(label="Nombre", max_length=150)
    last_name = forms.CharField(label="Apellido", max_length=150)
    email = forms.EmailField(label="Correo electrónico")
    telefono = forms.CharField(label="Teléfono", max_length=20, required=False)
    autoriza_datos = forms.BooleanField(
        label="Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012.",
        required=True,
        error_messages={"required": "Debes autorizar el tratamiento de datos para registrarte."},
    )

    class Meta:
        model = Usuario
        fields = ["first_name", "last_name", "email"]

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if Usuario.objects.filter(email__iexact=email).exists() or Usuario.objects.filter(username__iexact=email).exists():
            raise forms.ValidationError("Ya existe una cuenta con este correo.")
        return email

    def save(self, commit=True):
        from django.contrib.auth.models import Group

        usuario = super().save(commit=False)
        usuario.username = self.cleaned_data["email"]
        usuario.email = self.cleaned_data["email"]
        if commit:
            usuario.save()
            usuario.groups.add(Group.objects.get(name=CLIENTE))
            PerfilCliente.objects.create(
                usuario=usuario,
                telefono=self.cleaned_data.get("telefono", ""),
                autoriza_datos=True,
                fecha_autorizacion=timezone.now(),
            )
        return usuario


# --- Vehículos: CRUD principal (RF-10, RF-13, RF-14) ---

class VehiculoClienteForm(forms.ModelForm):
    """El cliente registra su moto; queda asociada a su cuenta (RF-10)."""

    class Meta:
        model = Vehiculo
        fields = ["marca", "modelo", "placa", "color", "servicio", "observaciones"]
        labels = {"servicio": "Servicio que deseas", "observaciones": "Detalles del trabajo"}
        widgets = {"observaciones": forms.Textarea(attrs={"rows": 3})}


class VehiculoAdminForm(forms.ModelForm):
    """El administrador gestiona cualquier vehículo, incluida su etapa (RF-13, RF-14)."""

    class Meta:
        model = Vehiculo
        fields = ["cliente", "marca", "modelo", "placa", "color", "servicio", "etapa", "observaciones"]
        widgets = {"observaciones": forms.Textarea(attrs={"rows": 3})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["cliente"].queryset = Usuario.objects.filter(groups__name=CLIENTE).order_by("first_name")
        self.fields["cliente"].label_from_instance = lambda u: f"{u.get_full_name() or u.username} ({u.email})"


class CambioEtapaForm(forms.Form):
    etapa = forms.ChoiceField(choices=Vehiculo.Etapa.choices, label="Nueva etapa")


class FiltroVehiculosForm(forms.Form):
    etapa = forms.ChoiceField(choices=[("", "Todas las etapas")] + Vehiculo.Etapa.choices, required=False)
    cliente = forms.ModelChoiceField(queryset=Usuario.objects.none(), required=False, empty_label="Todos los clientes")
    q = forms.CharField(required=False, label="Buscar", widget=forms.TextInput(attrs={"placeholder": "Placa, marca o modelo"}))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["cliente"].queryset = Usuario.objects.filter(groups__name=CLIENTE).order_by("first_name")
        self.fields["cliente"].label_from_instance = lambda u: u.get_full_name() or u.username


class CitaEstadoForm(forms.ModelForm):
    class Meta:
        model = Cita
        fields = ["estado"]
