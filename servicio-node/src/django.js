// Cliente de la API REST de Django. Node solo LEE: la base de datos es de Django.

export function crearClienteDjango({ djangoUrl, servicioApiKey }, fetchImpl = fetch) {
  async function pedir(ruta, { autenticado = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (autenticado) headers['X-API-Key'] = servicioApiKey;
    const respuesta = await fetchImpl(`${djangoUrl}${ruta}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) throw new Error(`Django respondió ${respuesta.status} en ${ruta}`);
    return respuesta.json();
  }

  return {
    /** Lista de servicios con precio de referencia (pública). */
    async servicios() {
      const datos = await pedir('/api/servicios/');
      return datos?.servicios ?? [];
    },

    /** Estado de una moto por placa (requiere la clave compartida). null si no existe. */
    async estadoVehiculo(placa) {
      return pedir(`/api/vehiculos/${encodeURIComponent(placa)}/estado/`, { autenticado: true });
    },

    /** ¿Django responde? Se usa en /api/salud. */
    async disponible() {
      try {
        await pedir('/api/servicios/');
        return true;
      } catch {
        return false;
      }
    },
  };
}
