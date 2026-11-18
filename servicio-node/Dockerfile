# Contenedor del microservicio Node.js de DUART-STUDIO (Entrega 3)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# 1) Dependencias de producción (capa en caché mientras package*.json no cambie)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Código
COPY src/ ./src/

# 3) Usuario sin privilegios (la imagen oficial ya trae el usuario "node")
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/salud" > /dev/null || exit 1

CMD ["node", "src/server.js"]
