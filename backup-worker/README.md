# Backup Worker - Sistema de Gestión de Citas

Este servicio es un worker independiente encargado de procesar la cola de trabajos de copias de seguridad de la base de datos (NeonDB) y subirlas a un almacenamiento privado S3 compatible, evitando ejecutar tareas pesadas o comandos shell en el entorno serverless de Vercel.

## Características

- **Reclamo Atómico de Trabajos:** Consulta la tabla `TrabajoBackup` mediante transacciones seguras con `FOR UPDATE SKIP LOCKED` para soportar múltiples instancias del worker concurrentes sin colisiones.
- **Seguridad en Comunicación:** Expone un endpoint de healthcheck `/internal/health` y generación de URLs firmado mediante **HMAC SHA-256** con timestamps y nonces para evitar replay attacks.
- **Cifrado SHA-256:** Calcula el hash SHA-256 del archivo `.backup` y valida su integridad antes de cualquier operación de restauración.
- **Restauración en 2 Pasos Protegida:** La restauración automática requiere un backup previo (`BACKUP_PRE_RESTORE`) exitoso y requiere habilitación explícita mediante la variable de entorno `BACKUP_RESTORE_ENABLED=true`.

---

## Requisitos Previos

1. **Cliente de PostgreSQL (`pg_dump` y `pg_restore`):** Debe estar instalado en la máquina o contenedor donde se ejecute el worker.
2. **Bucket S3 compatible privado:** Ej. AWS S3, Cloudflare R2 o un servidor local MinIO.

---

## Configuración y Despliegue

### 1. Despliegue en Railway (Recomendado)

El repositorio incluye un `Dockerfile` compatible con Railway.

1. Crea un nuevo proyecto en Railway y selecciona "Deploy from Github".
2. Selecciona la carpeta del subdirectorio `backup-worker` (o deja que Railway detecte el Dockerfile).
3. Añade las variables de entorno detalladas en `.env.example`.
4. El Dockerfile instalará automáticamente `postgresql-client` para la ejecución del comando.

### 2. Despliegue Local o en VPS con Docker

Si deseas correrlo localmente o en tu propio servidor VPS:

```bash
# Construir la imagen Docker
docker build -t backup-worker .

# Correr el contenedor pasando las variables de entorno
docker run -d \
  --name backup-worker-service \
  -p 4000:4000 \
  --env-file .env \
  backup-worker
```

### 3. Ejecución Directa con Node.js (requiere pg_dump y pg_restore locales)

```bash
cd backup-worker
npm install
npm start
```

---

## Variables de Entorno

Consulta el archivo [.env.example](.env.example) para ver la lista completa de variables necesarias para configurar el almacenamiento S3, el acceso a NeonDB y las llaves de seguridad HMAC.

## API y Health Check

- `GET /internal/health`: Retorna el estado del worker. Requiere autenticación por firma HMAC en los headers.
  - Respuesta: `{"status": "ok", "version": "1.0.0", "lastJobAt": "date", "queueStatus": "idle | processing"}`
- `POST /api/worker/download-url`: Genera una URL firmada de S3 temporal.
