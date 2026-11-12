# Contenedor del backend Django de DUART-STUDIO (Entrega 2)
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# 1) Dependencias (capa en caché mientras requirements.txt no cambie)
COPY backend-django/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# 2) Código del proyecto
COPY backend-django/ .

# 3) Archivos estáticos recopilados en la imagen (los sirve WhiteNoise)
RUN DJANGO_SECRET_KEY=solo-para-build DJANGO_DEBUG=False python manage.py collectstatic --noinput

# 4) Usuario sin privilegios de administrador (buena práctica de seguridad)
RUN useradd --create-home duart && chown -R duart:duart /app && chmod +x /app/entrypoint.sh
USER duart

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
