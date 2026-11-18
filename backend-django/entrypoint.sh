#!/bin/sh
# Arranque del contenedor: migra la base de datos, carga los datos de demostración
# (opcional) y levanta Django con gunicorn en el puerto que indique la plataforma.
set -e

python manage.py migrate --noinput

if [ "$CARGAR_DATOS_DEMO" = "True" ]; then
  python manage.py cargar_datos_demo
fi

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --access-logfile -
