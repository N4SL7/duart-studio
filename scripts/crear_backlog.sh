#!/usr/bin/env bash
# Crea las 22 historias de usuario como issues en GitHub y las agrega a un GitHub Project.
# Requisitos: GitHub CLI (https://cli.github.com) con sesión iniciada:
#   gh auth login            (y luego)   gh auth refresh -s project
# Uso (desde la raíz del repositorio):   bash scripts/crear_backlog.sh
set -e
OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

echo "Creando etiquetas..."
for l in "entrega-2:1F3864" "entrega-3:2E5597" "expouninpahu:C55A11" "prioridad-alta:B60205" "prioridad-media:FBCA04" "prioridad-baja:0E8A16" "historia-de-usuario:5319E7"; do
  gh label create "${l%%:*}" --color "${l##*:}" --force >/dev/null
done

echo "Creando el proyecto..."
PROJECT=$(gh project create --owner "$OWNER" --title "DUART-STUDIO · Backlog" --format json -q .number)
gh project link "$PROJECT" --owner "$OWNER" --repo "$REPO" >/dev/null || true

crear() {
  url=$(gh issue create --title "$1" --body "$2" --label "historia-de-usuario,$3,$4")
  gh project item-add "$PROJECT" --owner "$OWNER" --url "$url" >/dev/null
  echo "  ✔ $1"
}

echo "Creando historias de usuario..."
crear 'HU-01 · Consultar servicios y precios' '**Historia de usuario**
Como visitante, quiero ver los servicios del taller con precios de referencia, para decidir qué trabajo hacerle a mi moto.

**Criterios de aceptación**
- Lista y detalle de servicios.
- Precios marcados como aproximados.
- Vista responsiva.

**Trazabilidad:** RF-01 · CU-01 · Componente: Backend Django – app sitio
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-02 · Ver galería de trabajos y noticias' '**Historia de usuario**
Como visitante, quiero ver fotos de motos pintadas y noticias del taller, para confiar en la calidad del trabajo.

**Criterios de aceptación**
- Galería con imagen y descripción.
- Noticias ordenadas por fecha.
- Imágenes desde Cloudinary.

**Trazabilidad:** RF-02 · CU-02 · Componente: Backend Django – app sitio
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-03 · Conversar con el asistente virtual (IA)' '**Historia de usuario**
Como visitante / cliente, quiero hacer preguntas al asistente virtual, para resolver dudas sin llamar al taller.

**Criterios de aceptación**
- Busca primero en preguntas frecuentes.
- Si no hay coincidencia consulta el LLM.
- Guarda las preguntas no reconocidas.
- Precios siempre aproximados.

**Trazabilidad:** RF-03 · CU-03 · Componente: Servicio Node.js + Asistente IA
**Prioridad:** Alta · **Puntos:** 8 · **Entrega:** Entrega 3' entrega-3 prioridad-alta
crear 'HU-04 · Derivar a atención humana' '**Historia de usuario**
Como visitante / cliente, quiero que el asistente me pase con una persona, para recibir una cotización personalizada.

**Criterios de aceptación**
- Las cotizaciones y los casos no resueltos abren WhatsApp con un mensaje prellenado.

**Trazabilidad:** RF-04 · CU-04 · Componente: Servicio Node.js → WhatsApp
**Prioridad:** Media · **Puntos:** 2 · **Entrega:** Entrega 3' entrega-3 prioridad-media
crear 'HU-05 · Explorar catálogo de la tienda' '**Historia de usuario**
Como visitante, quiero ver productos y agregarlos a un carrito, para armar un pedido.

**Criterios de aceptación**
- Catálogo con filtro por marca.
- Carrito en sesión.
- Sin pago en línea.

**Trazabilidad:** RF-05 · CU-05 · Componente: Backend Django – app tienda
**Prioridad:** Media · **Puntos:** 5 · **Entrega:** ExpoUninpahu' expouninpahu prioridad-media
crear 'HU-06 · Enviar pedido por WhatsApp' '**Historia de usuario**
Como visitante, quiero enviar mi carrito por WhatsApp, para concretar la compra con el taller.

**Criterios de aceptación**
- El botón genera un mensaje con productos y cantidades y abre WhatsApp.

**Trazabilidad:** RF-06 · CU-06 · Componente: Backend Django – app tienda → WhatsApp
**Prioridad:** Baja · **Puntos:** 2 · **Entrega:** ExpoUninpahu' expouninpahu prioridad-baja
crear 'HU-07 · Solicitar cita / formulario de contacto' '**Historia de usuario**
Como visitante, quiero solicitar una cita indicando servicio y fecha, para reservar un espacio en el taller.

**Criterios de aceptación**
- El formulario valida los campos.
- La cita queda guardada y visible para el administrador.

**Trazabilidad:** RF-07 · CU-07 · Componente: Backend Django – app citas
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-08 · Registrarse (con autorización de datos)' '**Historia de usuario**
Como visitante, quiero crear una cuenta aceptando el tratamiento de datos, para seguir el proceso de mi moto.

**Criterios de aceptación**
- Casilla obligatoria de autorización (Ley 1581 de 2012).
- Contraseña cifrada.
- Correo único.

**Trazabilidad:** RF-08 · CU-08 · Componente: Backend Django – app clientes
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-09 · Iniciar sesión (cliente)' '**Historia de usuario**
Como cliente registrado, quiero iniciar sesión con correo y contraseña, para acceder a Mi Proceso.

**Criterios de aceptación**
- Inicio y cierre de sesión.
- Mensaje de error genérico.
- Rutas privadas protegidas.

**Trazabilidad:** RF-09 · CU-09 · Componente: Backend Django – autenticación
**Prioridad:** Alta · **Puntos:** 2 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-10 · Registrar motocicleta' '**Historia de usuario**
Como cliente registrado, quiero registrar mi moto (marca, modelo, placa), para que el taller la asocie a mi cuenta.

**Criterios de aceptación**
- Requiere sesión iniciada.
- La moto queda asociada al cliente.

**Trazabilidad:** RF-10 · CU-10 · Componente: Backend Django – app proceso
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-11 · Consultar etapa del proceso (Mi Proceso)' '**Historia de usuario**
Como cliente registrado, quiero ver en qué etapa va mi moto, para no tener que llamar al taller.

**Criterios de aceptación**
- Muestra las cinco etapas (alistamiento, lijado, preparación de pintura, detallado, pulido) con la etapa actual resaltada.

**Trazabilidad:** RF-11 · CU-11 · Componente: Backend Django – app proceso
**Prioridad:** Alta · **Puntos:** 5 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-12 · Recibir notificación de cambio de etapa' '**Historia de usuario**
Como cliente registrado, quiero recibir un aviso cuando cambie la etapa de mi moto, para enterarme al instante.

**Criterios de aceptación**
- Django envía un webhook a Node.js.
- Aviso en tiempo real por WebSocket y por correo.

**Trazabilidad:** RF-12 · CU-12 · Componente: Servicio Node.js – notificaciones
**Prioridad:** Media · **Puntos:** 5 · **Entrega:** Entrega 3' entrega-3 prioridad-media
crear 'HU-13 · Actualizar etapa / finalizar trabajo' '**Historia de usuario**
Como administrador del taller, quiero cambiar la etapa de cada moto, para mantener informado al cliente.

**Criterios de aceptación**
- Solo el rol administrador.
- Registra la fecha del cambio.
- Dispara la notificación (HU-12).

**Trazabilidad:** RF-13 · CU-13 · Componente: Backend Django – Django Admin
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-14 · Gestionar vehículos en taller' '**Historia de usuario**
Como administrador del taller, quiero ver y gestionar las motos que están en el taller, para organizar el trabajo diario.

**Criterios de aceptación**
- CRUD de vehículos.
- Filtro por etapa y por cliente.

**Trazabilidad:** RF-14 · CU-14 · Componente: Backend Django – Django Admin
**Prioridad:** Alta · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-15 · Iniciar sesión administrativa' '**Historia de usuario**
Como administrador del taller, quiero entrar al panel con un acceso exclusivo, para proteger la gestión del taller.

**Criterios de aceptación**
- Acceso solo para el rol administrador.
- Intentos fallidos limitados.

**Trazabilidad:** RF-15 · CU-15 · Componente: Backend Django – autenticación y roles
**Prioridad:** Alta · **Puntos:** 2 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-16 · Gestionar contenidos' '**Historia de usuario**
Como administrador del taller, quiero crear, editar y eliminar servicios, trabajos, noticias y productos, para mantener el sitio actualizado sin tocar código.

**Criterios de aceptación**
- CRUD completo desde Django Admin.
- Los cambios se ven en el sitio público.

**Trazabilidad:** RF-16 · CU-16 · Componente: Backend Django – Django Admin
**Prioridad:** Alta · **Puntos:** 5 · **Entrega:** Entrega 2' entrega-2 prioridad-alta
crear 'HU-17 · Gestionar citas' '**Historia de usuario**
Como administrador del taller, quiero ver y cambiar el estado de las citas, para atender a los clientes a tiempo.

**Criterios de aceptación**
- Lista de citas por fecha.
- Estados pendiente, confirmada y cancelada.

**Trazabilidad:** RF-17 · CU-17 · Componente: Backend Django – Django Admin
**Prioridad:** Media · **Puntos:** 3 · **Entrega:** Entrega 2' entrega-2 prioridad-media
crear 'HU-18 · Gestionar preguntas frecuentes del asistente' '**Historia de usuario**
Como administrador del taller, quiero administrar las preguntas frecuentes y revisar las no reconocidas, para mejorar las respuestas del asistente.

**Criterios de aceptación**
- CRUD de preguntas frecuentes.
- Listado de preguntas no reconocidas.

**Trazabilidad:** RF-18 · CU-18 · Componente: Backend Django – Admin + API REST
**Prioridad:** Media · **Puntos:** 3 · **Entrega:** Entrega 3' entrega-3 prioridad-media
crear 'HU-19 · Gestionar insumos y modelos de moto' '**Historia de usuario**
Como administrador del taller, quiero registrar insumos y modelos de moto, para tener control de materiales.

**Criterios de aceptación**
- CRUD de insumos (nombre, unidad) y de modelos de moto.

**Trazabilidad:** RF-19 · CU-19 · Componente: Backend Django – app inventario
**Prioridad:** Media · **Puntos:** 3 · **Entrega:** Entrega 3' entrega-3 prioridad-media
crear 'HU-20 · Definir plantilla de insumos por modelo y etapa' '**Historia de usuario**
Como administrador del taller, quiero definir qué insumos usa cada modelo en cada etapa, para estimar los materiales de cada trabajo.

**Criterios de aceptación**
- La plantilla relaciona modelo, etapa, insumo y cantidad.

**Trazabilidad:** RF-20 · CU-20 · Componente: Backend Django – app inventario
**Prioridad:** Media · **Puntos:** 5 · **Entrega:** Entrega 3' entrega-3 prioridad-media
crear 'HU-21 · Generar solicitud de materiales' '**Historia de usuario**
Como administrador del taller, quiero generar una solicitud de materiales a partir de la plantilla, para pedir solo lo necesario.

**Criterios de aceptación**
- Usa la plantilla (HU-20).
- La solicitud lista insumos y cantidades.

**Trazabilidad:** RF-21 · CU-21 · Componente: Backend Django – app inventario
**Prioridad:** Media · **Puntos:** 5 · **Entrega:** ExpoUninpahu' expouninpahu prioridad-media
crear 'HU-22 · Cambiar estado de la solicitud' '**Historia de usuario**
Como administrador del taller, quiero cambiar el estado de una solicitud de materiales, para saber qué está pedido y qué llegó.

**Criterios de aceptación**
- Estados pendiente, pedida y recibida.
- Registra la fecha del cambio.

**Trazabilidad:** RF-22 · CU-22 · Componente: Backend Django – app inventario
**Prioridad:** Baja · **Puntos:** 2 · **Entrega:** ExpoUninpahu' expouninpahu prioridad-baja

echo "Listo: 22 historias creadas en el proyecto #$PROJECT."
echo "Abre el proyecto en GitHub y agrega una vista tipo Board agrupada por la etiqueta de entrega."
