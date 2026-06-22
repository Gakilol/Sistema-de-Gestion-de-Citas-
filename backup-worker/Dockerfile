FROM node:20-slim

# Instalar cliente de postgresql para tener pg_dump y pg_restore
RUN apt-get update && \
    apt-get install -y postgresql-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias omitiendo las de desarrollo
RUN npm ci --omit=dev

# Copiar el código fuente del worker
COPY . .

# Exponer puerto para healthcheck
EXPOSE 4000

# Ejecutar el servicio
CMD ["npm", "start"]
