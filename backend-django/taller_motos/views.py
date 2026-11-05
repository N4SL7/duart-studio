from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from .models import Servicio, Moto, Cita
from .forms import ServicioForm


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


# --- CRUD de Servicios ---

def servicio_list(request):
    servicios = Servicio.objects.all()
    return render(request, "taller_motos/servicio_list.html", {"servicios": servicios})


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


def servicio_delete(request, servicio_id):
    servicio = get_object_or_404(Servicio, pk=servicio_id)
    if request.method == "POST":
        servicio.delete()
        messages.success(request, "Servicio eliminado correctamente.")
        return redirect("taller_motos:servicio_list")
    return render(request, "taller_motos/servicio_confirm_delete.html", {"servicio": servicio})
