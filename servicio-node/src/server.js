// Punto de entrada: levanta el microservicio en el puerto configurado.
import { crearServidor } from './app.js';
import { cargarConfig } from './config.js';

const config = cargarConfig();
const { servidorHttp } = crearServidor({ config });

servidorHttp.listen(config.puerto, () => {
  console.log(`Microservicio DUART-STUDIO escuchando en http://localhost:${config.puerto}`);
  console.log(`Swagger: http://localhost:${config.puerto}/api-docs`);
  console.log(`Django: ${config.djangoUrl} · IA: ${config.anthropicApiKey ? config.llmModelo : 'sin configurar (solo preguntas frecuentes)'}`);
});

function apagar(senal) {
  console.log(`${senal} recibido: cerrando el servidor...`);
  servidorHttp.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
