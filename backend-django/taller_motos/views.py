from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import LoginView
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from .autenticacion import MINUTOS_BLOQUEO, esta_bloqueado
from .forms import (
    CambioEtapaForm,
    CitaEstadoForm,
    FiltroVehiculosForm,
    LoginForm,
    RegistroForm,
    ServicioForm,
    VehiculoAdminForm,
    VehiculoClienteForm,
)
from .models import Cita, Moto, Servicio, Vehiculo
from .roles import ADMINISTRADOR, CLIENTE, es_administrador, rol_requerido


# --- Sitio público (Visitante) ---

def index(request):
    servicios = Servicio.objects.all()
    motos = Moto.objects.all()[:6]
    context = {"servicios": servicios, "motos": motos}
    return render(request, "taller_motos/index.html", context)


def servicio_detail(request, servicio_id):
    servicio = get_object_or_404(Servicio, pk=servicio_id)
    return render(request, "taller_motos/servicio_detail.html", {"servicio": servicio})


def galeria(request):
    motos = Moto.objects.all()
    return render(request, "taller_motos/galeria.html", {"motos": motos})


def contacto(request):
    servicios = Servicio.objects.all()
    if request.method == "POST":
        nombre = request.POST.get("nombre_cliente", "").strip()
        telefono = request.POST.get("telefono", "").strip()
        servicio_id = request.POST.get("servicio")
        fecha = request.POST.get("fecha_deseada")
        mensaje = request.POST.get("mensaje", "").strip()

        if nombre and telefono and fecha:
            Cita.objects.create(
                nombre_cliente=nombre,
                telefono=telefono,
                servicio_id=servicio_id or None,
                fecha_deseada=fecha,
                mensaje=mensaje,
            )
            messages.success(request, "¡Tu cita fue registrada! Te contactaremos pronto.")
            return redirect("taller_motos:contacto")
        else:
            messages.error(request, "Por favor completa nombre, teléfono y fecha.")

    return render(request, "taller_motos/contacto.html", {"servicios": servicios})


# --- Registro e inicio de sesión (RF-08, RF-09, RF-15) ---

def registro(request):
    if request.user.is_authenticated:
        return redirect("taller_motos:inicio_por_rol")
    if request.method == "POST":
        form = RegistroForm(request.POST)
        if form.is_valid():
            usuario = form.save()
            login(request, usuario, backend="taller_motos.autenticacion.CorreoOUsuarioBackend")
            messages.success(request, f"¡Bienvenido, {usuario.first_name}! Ya puedes registrar tu moto.")
            return redirect("taller_motos:mi_proceso")
    else:
        form = RegistroForm()
    return render(request, "registration/registro.html", {"form": form})


class IniciarSesionView(LoginView):
    form_class = LoginForm
    redirect_authenticated_user = True

    def form_invalid(self, form):
        if esta_bloqueado(form.data.get("username")):
            form.errors.clear()
            form.add_error(
                None,
                f"Demasiados intentos fallidos. Intenta de nuevo en {MINUTOS_BLOQUEO} minutos.",
            )
        return super().form_invalid(form)

    def get_default_redirect_url(self):
        return reverse("taller_motos:inicio_por_rol")


def inicio_por_rol(request):
    """Envía a cada rol a su página principal después de iniciar sesión."""
    if es_administrador(request.user):
        return redirect("taller_motos:vehiculo_list")
    if request.user.is_authenticated:
        return redirect("taller_motos:mi_proceso")
    return redirect("taller_motos:index")


# --- Cliente: Mi Proceso y registro de moto (RF-10, RF-11) ---

@rol_requerido(CLIENTE)
def mi_proceso(request):
    vehiculos = request.user.vehiculos.select_related("servicio").prefetch_related("historial")
    return render(request, "taller_motos/mi_proceso.html", {"vehiculos": vehiculos})


@rol_requerido(CLIENTE)
def vehiculo_registrar(request):
    if request.method == "POST":
        form = VehiculoClienteForm(request.POST)
        if form.is_valid():
            vehiculo = form.save(commit=False)
            vehiculo.cliente = request.user
            vehiculo.save()
            messages.success(request, "Tu moto quedó registrada. El taller actualizará su etapa al recibirla.")
            return redirect("taller_motos:mi_proceso")
    else:
        form = VehiculoClienteForm()
    return render(request, "taller_motos/vehiculo_form.html", {"form": form, "modo": "Registrar mi"})


# --- Administrador: CRUD principal de vehículos (RF-13, RF-14) ---

@rol_requerido(ADMINISTRADOR)
def vehiculo_list(request):
    filtro = FiltroVehiculosForm(request.GET or None)
    vehiculos = Vehiculo.objects.select_related("cliente", "servicio")
    if filtro.is_valid():
        if filtro.cleaned_data["etapa"]:
            vehiculos = vehiculos.filter(etapa=filtro.cleaned_data["etapa"])
        if filtro.cleaned_data["cliente"]:
            vehiculos = vehiculos.filter(cliente=filtro.cleaned_data["cliente"])
        if filtro.cleaned_data["q"]:
            q = filtro.cleaned_data["q"]
            vehiculos = vehiculos.filter(Q(placa__icontains=q) | Q(marca__icontains=q) | Q(modelo__icontains=q))
    return render(request, "taller_motos/vehiculo_list.html", {"vehiculos": vehiculos, "filtro": filtro})


@rol_requerido(ADMINISTRADOR, CLIENTE)
def vehiculo_detail(request, vehiculo_id):
    vehiculo = get_object_or_404(Vehiculo.objects.select_related("cliente", "servicio"), pk=vehiculo_id)
    administrador = es_administrador(request.user)
    if not administrador and vehiculo.cliente != request.user:
        raise PermissionDenied  # Un cliente solo ve sus propias motos.
    contexto = {
        "vehiculo": vehiculo,
        "historial": vehiculo.historial.select_related("cambiado_por"),
        "form_etapa": CambioEtapaForm(initial={"etapa": vehiculo.etapa}) if administrador else None,
    }
    return render(request, "taller_motos/vehiculo_detail.html", contexto)


@rol_requerido(ADMINISTRADOR)
def vehiculo_create(request):
    if request.method == "POST":
        form = VehiculoAdminForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Vehículo creado correctamente.")
            return redirect("taller_motos:vehiculo_list")
    else:
        form = VehiculoAdminForm()
    return render(request, "taller_motos/vehiculo_form.html", {"form": form, "modo": "Crear"})


@rol_requerido(ADMINISTRADOR)
def vehiculo_update(request, vehiculo_id):
    vehiculo = get_object_or_404(Vehiculo, pk=vehiculo_id)
    etapa_anterior = vehiculo.etapa
    if request.method == "POST":
        form = VehiculoAdminForm(request.POST, instance=vehiculo)
        if form.is_valid():
            vehiculo = form.save(commit=False)
            nueva_etapa = vehiculo.etapa
            vehiculo.etapa = etapa_anterior
            vehiculo.save()
            vehiculo.cambiar_etapa(nueva_etapa, request.user)  # Deja registro si la etapa cambió.
            messages.success(request, "Vehículo actualizado correctamente.")
            return redirect("taller_motos:vehiculo_detail", vehiculo.id)
    else:
        form = VehiculoAdminForm(instance=vehiculo)
    return render(request, "taller_motos/vehiculo_form.html", {"form": form, "modo": "Editar", "vehiculo": vehiculo})


@rol_requerido(ADMINISTRADOR)
def vehiculo_delete(request, vehiculo_id):
    vehiculo = get_object_or_404(Vehiculo, pk=vehiculo_id)
    if request.method == "POST":
        vehiculo.delete()
        messages.success(request, "Vehículo eliminado correctamente.")
        return redirect("taller_motos:vehiculo_list")
    return render(request, "taller_motos/vehiculo_confirm_delete.html", {"vehiculo": vehiculo})


@require_POST
@rol_requerido(ADMINISTRADOR)
def vehiculo_cambiar_etapa(request, vehiculo_id):
    vehiculo = get_object_or_404(Vehiculo, pk=vehiculo_id)
    form = CambioEtapaForm(request.POST)
    if form.is_valid():
        if vehiculo.cambiar_etapa(form.cleaned_data["etapa"], request.user):
            messages.success(request, f"Etapa actualizada a «{vehiculo.get_etapa_display()}».")
        else:
            messages.error(request, "La moto ya está en esa etapa.")
    return redirect("taller_motos:vehiculo_detail", vehiculo.id)


# --- Administrador: citas (RF-17) ---

@rol_requerido(ADMINISTRADOR)
def cita_list(request):
    if request.method == "POST":
        cita = get_object_or_404(Cita, pk=request.POST.get("cita_id"))
        form = CitaEstadoForm(request.POST, instance=cita)
        if form.is_valid():
            form.save()
            messages.success(request, f"La cita de {cita.nombre_cliente} quedó «{cita.get_estado_display()}».")
        return redirect("taller_motos:cita_list")
    citas = Cita.objects.select_related("servicio")
    return render(request, "taller_motos/cita_list.html", {"citas": citas, "estados": Cita.Estado.choices})


# --- Administrador: CRUD de servicios (RF-16) ---

@rol_requerido(ADMINISTRADOR)
def servicio_list(request):
    servicios = Servicio.objects.all()
    return render(request, "taller_motos/servicio_list.html", {"servicios": servicios})


@rol_requerido(ADMINISTRADOR)
def servicio_create(request):
    if request.method == "POST":
        form = ServicioForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Servicio creado correctamente.")
            return redirect("taller_motos:servicio_list")
    else:
        form = ServicioForm()
    return render(request, "taller_motos/servicio_form.html", {"form": form, "modo": "Crear"})


@rol_requerido(ADMINISTRADOR)
def servicio_update(request, servicio_id):
    servicio = get_object_or_404(Servicio, pk=servicio_id)
    if request.method == "POST":
        form = ServicioForm(request.POST, instance=servicio)
        if form.is_valid():
            form.save()
            messages.success(request, "Servicio actualizado correctamente.")
            return redirect("taller_motos:servicio_list")
    else:
        form = ServicioForm(instance=servicio)
    return render(request, "taller_motos/servicio_form.html", {"form": form, "modo": "Editar"})


@rol_requerido(ADMINISTRADOR)
def servicio_delete(request, servicio_id):
    servicio = get_object_or_404(Servicio, pk=servicio_id)
    if request.method == "POST":
        servicio.delete()
        messages.success(request, "Servicio eliminado correctamente.")
        return redirect("taller_motos:servicio_list")
    return render(request, "taller_motos/servicio_confirm_delete.html", {"servicio": servicio})
