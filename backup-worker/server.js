import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const execPromise = util.promisify(exec);

// Variables de entorno
const WORKER_ID = process.env.BACKUP_WORKER_ID || `worker-${crypto.randomBytes(4).toString('hex')}`;
const SECRET = process.env.BACKUP_WORKER_SECRET;
const WORKER_PORT = process.env.PORT || 4000;
const TIMEOUT_MINUTES = parseInt(process.env.BACKUP_JOB_TIMEOUT_MINUTES || '30', 10);
const MAX_RETRIES = parseInt(process.env.BACKUP_MAX_RETRIES || '3', 10);
const RESTORE_ENABLED = process.env.BACKUP_RESTORE_ENABLED === 'true';

if (!SECRET) {
  console.error('CRITICAL: BACKUP_WORKER_SECRET no está configurada.');
  process.exit(1);
}

// Configuración de base de datos
const workerDbPool = new pg.Pool({
  connectionString: process.env.WORKER_APP_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const backupDbUrl = process.env.BACKUP_DATABASE_URL;

// Configuración de S3
const s3Config = {
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  }
};
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true; // Para MinIO o R2
}
const s3Client = new S3Client(s3Config);
const s3Bucket = process.env.S3_BUCKET || '';

// Estado interno para el healthcheck
let lastJobAt = null;
let currentJobId = null;

const app = express();
app.use(express.json());

// Helper para validar firmas HMAC en peticiones entrantes
function validarFirmaHMAC(req, res, next) {
  const auth = req.headers['authorization'];
  const timestamp = req.headers['x-backup-timestamp'];
  const nonce = req.headers['x-backup-nonce'];
  const signature = req.headers['x-backup-signature'];
  const rawBody = JSON.stringify(req.body || {});

  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Cabecera ausente.' });
  }
  const token = auth.substring(7);
  if (token !== SECRET) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  if (!timestamp || !nonce || !signature) {
    return res.status(400).json({ error: 'Faltan cabeceras de firma (Timestamp/Nonce/Signature).' });
  }

  // Validar deriva temporal (máximo 5 minutos)
  const ahora = Math.floor(Date.now() / 1000);
  const diff = Math.abs(ahora - parseInt(timestamp, 10));
  if (diff > 300) {
    return res.status(400).json({ error: 'Petición expirada.' });
  }

  // Generar firma local
  const data = `${timestamp}.${nonce}.${rawBody}`;
  const localSig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

  if (signature !== localSig) {
    return res.status(403).json({ error: 'Firma inválida.' });
  }

  next();
}

// ─── ENDPOINTS DEL WORKER ──────────────────────────────────────────────────

// Health Check Privado
app.get('/internal/health', validarFirmaHMAC, (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    lastJobAt: lastJobAt ? lastJobAt.toISOString() : null,
    queueStatus: currentJobId ? 'processing' : 'idle'
  });
});

// Generación de URL firmada para descarga
app.post('/api/worker/download-url', validarFirmaHMAC, async (req, res) => {
  const { storageKey } = req.body;
  if (!storageKey) {
    return res.status(400).json({ error: 'storageKey es requerido.' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: storageKey
    });

    const expiresInMinutes = parseInt(process.env.BACKUP_SIGNED_URL_EXPIRATION_MINUTES || '10', 10);
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInMinutes * 60 });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la URL firmada.', details: err.message });
  }
});

// ─── PROCESADOR DE TRABAJOS DE LA COLA ──────────────────────────────────────

async function reclamarTrabajo() {
  const client = await workerDbPool.connect();
  try {
    await client.query('BEGIN');

    // Buscar un trabajo pendiente de forma atómica
    const query = `
      SELECT id, tipo, payload, "backupId", intentos, "maxIntentos"
      FROM "TrabajoBackup"
      WHERE estado = 'PENDING'
        AND intentos < "maxIntentos"
        AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - $1 * INTERVAL '1 minute')
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    const res = await client.query(query, [TIMEOUT_MINUTES]);

    if (res.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const job = res.rows[0];
    
    // Marcar como PROCESSING inmediatamente
    await client.query(`
      UPDATE "TrabajoBackup"
      SET estado = 'PROCESSING',
          "lockedAt" = NOW(),
          "lockedBy" = $1,
          "startedAt" = NOW(),
          intentos = intentos + 1,
          "updatedAt" = NOW()
      WHERE id = $2
    `, [WORKER_ID, job.id]);

    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Worker] Error al reclamar trabajo:', err);
    return null;
  } finally {
    client.release();
  }
}

// Helper para limpiar credenciales de los mensajes de error
function sanitizarError(msg) {
  if (!msg) return '';
  let clean = msg;
  if (backupDbUrl) {
    clean = clean.replace(new RegExp(backupDbUrl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), 'DATABASE_URL_SECRET');
  }
  if (process.env.WORKER_APP_DATABASE_URL) {
    clean = clean.replace(new RegExp(process.env.WORKER_APP_DATABASE_URL.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), 'APP_DATABASE_URL_SECRET');
  }
  return clean;
}

// Ejecución de tareas
async function procesarTrabajo(job) {
  currentJobId = job.id;
  lastJobAt = new Date();
  console.log(`[Worker] Procesando trabajo ${job.id} de tipo ${job.tipo}...`);

  try {
    if (job.tipo === 'BACKUP' || job.tipo === 'BACKUP_PRE_RESTORE') {
      await ejecutarBackup(job);
    } else if (job.tipo === 'RESTORE') {
      await ejecutarRestore(job);
    } else if (job.tipo === 'DELETE') {
      await ejecutarDelete(job);
    } else {
      throw new Error(`Tipo de trabajo no soportado: ${job.tipo}`);
    }

    // Actualizar trabajo a COMPLETED
    await workerDbPool.query(`
      UPDATE "TrabajoBackup"
      SET estado = 'COMPLETED',
          "completedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = $1
    `, [job.id]);

    console.log(`[Worker] Trabajo ${job.id} completado con éxito.`);
  } catch (err) {
    console.error(`[Worker] Error en el trabajo ${job.id}:`, err);
    const cleanError = sanitizarError(err.message);

    // Si es un trabajo de restauración, su maxIntentos se fuerza a 1 (nunca reintentar)
    const isRestore = job.tipo === 'RESTORE';
    const nextEstado = (job.intentos >= job.maxIntentos || isRestore) ? 'FAILED' : 'PENDING';

    await workerDbPool.query(`
      UPDATE "TrabajoBackup"
      SET estado = $1,
          "errorMessage" = $2,
          "completedAt" = $3,
          "updatedAt" = NOW()
      WHERE id = $4
    `, [nextEstado, cleanError, nextEstado === 'FAILED' ? new Date() : null, job.id]);

    // Si falló restauración, mantener modo mantenimiento activo en base de datos para revisión manual
    if (isRestore) {
      await workerDbPool.query(`
        UPDATE "Configuracion"
        SET "mantenimientoActivo" = true,
            "mensajeMantenimiento" = 'Fallo en restauración. Sistema bajo revisión de soporte técnico.'
        WHERE id = 'default'
      `);
    }

    // Si es BACKUP o BACKUP_PRE_RESTORE, actualizar el historial a FAILED
    if (job.backupId) {
      await workerDbPool.query(`
        UPDATE "HistorialBackup"
        SET status = 'FAILED',
            "errorMessage" = $1
        WHERE id = $2
      `, [cleanError, job.backupId]);
    }
  } finally {
    currentJobId = null;
  }
}

// ─── IMPLEMENTACIÓN DE OPERACIONES ──────────────────────────────────────────

async function ejecutarBackup(job) {
  if (!backupDbUrl) throw new Error('BACKUP_DATABASE_URL no está configurada.');
  if (!s3Bucket) throw new Error('S3_BUCKET no está configurado.');

  const backupId = job.backupId;
  if (!backupId) throw new Error('backupId no especificado en el trabajo.');

  // Obtener el registro de historial para tener el fileName
  const histRes = await workerDbPool.query('SELECT "fileName" FROM "HistorialBackup" WHERE id = $1', [backupId]);
  if (histRes.rows.length === 0) throw new Error('No se encontró el registro en HistorialBackup.');
  const fileName = histRes.rows[0].fileName;

  const tmpFilePath = path.join(os.tmpdir(), fileName);
  console.log(`[Worker] Ejecutando pg_dump para ${fileName}...`);

  try {
    // pg_dump -Fc
    await execPromise(`pg_dump -Fc -d "${backupDbUrl}" -f "${tmpFilePath}"`);
    console.log(`[Worker] pg_dump completado localmente.`);

    // Calcular tamaño y checksum SHA-256
    const fileStats = fs.statSync(tmpFilePath);
    const sizeBytes = fileStats.size;

    const hash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(tmpFilePath);
    for await (const chunk of fileStream) {
      hash.update(chunk);
    }
    const checksum = hash.digest('hex');

    console.log(`[Worker] Tamaño: ${sizeBytes} bytes, Checksum SHA256: ${checksum}`);

    // Subir a S3
    const storageKey = `backups/${fileName}`;
    const uploadStream = fs.createReadStream(tmpFilePath);

    await s3Client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: storageKey,
      Body: uploadStream
    }));

    console.log(`[Worker] Backup subido exitosamente a S3: ${storageKey}`);

    // Actualizar HistorialBackup
    await workerDbPool.query(`
      UPDATE "HistorialBackup"
      SET status = 'COMPLETED',
          "sizeBytes" = $1,
          "checksumSha256" = $2,
          "completedAt" = NOW()
      WHERE id = $3
    `, [sizeBytes, checksum, backupId]);

    // Eliminar archivo temporal local
    fs.unlinkSync(tmpFilePath);

    // Si era un backup previo a restauración exitoso, encolar el trabajo de restauración real
    if (job.tipo === 'BACKUP_PRE_RESTORE') {
      const payload = job.payload || {};
      const restoreBackupId = payload.restoreBackupId;
      
      if (!restoreBackupId) {
        throw new Error('Falta restoreBackupId en el payload de BACKUP_PRE_RESTORE para continuar.');
      }

      console.log(`[Worker] Backup pre-restauración exitoso. Creando trabajo RESTORE para backup ${restoreBackupId}`);

      await workerDbPool.query(`
        INSERT INTO "TrabajoBackup" (id, tipo, estado, "backupId", "solicitadoPorId", "solicitadoPorRol", payload, "maxIntentos", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'RESTORE', 'PENDING', $1, $2, $3, $4, 1, NOW(), NOW())
      `, [
        restoreBackupId, 
        job.solicitadoPorId, 
        job.solicitadoPorRol, 
        JSON.stringify({ 
          preRestoreBackupId: backupId,
          ...payload 
        })
      ]);
    }
  } catch (err) {
    if (fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch {}
    }
    throw err;
  }
}

async function ejecutarRestore(job) {
  if (!RESTORE_ENABLED) {
    throw new Error('La restauración está deshabilitada en este entorno (BACKUP_RESTORE_ENABLED=false).');
  }
  if (!backupDbUrl) throw new Error('BACKUP_DATABASE_URL no está configurada.');
  if (!s3Bucket) throw new Error('S3_BUCKET no está configurado.');

  const backupId = job.backupId;
  if (!backupId) throw new Error('backupId no especificado en el trabajo.');

  // Obtener el backup del historial para restaurar
  const histRes = await workerDbPool.query(`
    SELECT "fileName", "storageKey", "checksumSha256" 
    FROM "HistorialBackup" 
    WHERE id = $1 AND status != 'DELETED'
  `, [backupId]);
  
  if (histRes.rows.length === 0) {
    throw new Error('No se encontró el registro de backup o ha sido eliminado.');
  }
  
  const { fileName, storageKey, checksumSha256 } = histRes.rows[0];
  const tmpFilePath = path.join(os.tmpdir(), `restore-${fileName}`);

  console.log(`[Worker] Descargando backup ${storageKey} desde S3...`);

  try {
    // Activar Mantenimiento justo antes de descargar y restaurar
    await workerDbPool.query(`
      UPDATE "Configuracion"
      SET "mantenimientoActivo" = true,
          "mantenimientoDesde" = NOW(),
          "mensajeMantenimiento" = 'El sistema se encuentra en restauración de base de datos. Por favor espere.'
      WHERE id = 'default'
    `);

    // Descargar desde S3
    const getObjCmd = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: storageKey
    });
    const s3Obj = await s3Client.send(getObjCmd);
    const writeStream = fs.createWriteStream(tmpFilePath);
    
    await new Promise((resolve, reject) => {
      s3Obj.Body.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    console.log(`[Worker] Descarga completada.`);

    // Validar checksum SHA-256 antes de restaurar
    const hash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(tmpFilePath);
    for await (const chunk of fileStream) {
      hash.update(chunk);
    }
    const downloadChecksum = hash.digest('hex');

    if (downloadChecksum !== checksumSha256) {
      throw new Error(`Integridad del archivo fallida. Checksum SHA256 descargado (${downloadChecksum}) no coincide con el guardado (${checksumSha256}).`);
    }

    console.log(`[Worker] Checksum validado correctamente.`);

    // Ejecutar pg_restore
    console.log(`[Worker] Iniciando pg_restore...`);
    // pg_restore -c -O -d
    await execPromise(`pg_restore -c -O -d "${backupDbUrl}" "${tmpFilePath}"`);
    console.log(`[Worker] pg_restore completado exitosamente.`);

    // Registrar en auditoría
    await workerDbPool.query(`
      INSERT INTO "AuditLog" (id, entidad, "entidadId", accion, detalles, "realizadoPor", fecha)
      VALUES (gen_random_uuid(), 'BaseDeDatos', $1, 'FORZAR', $2, $3, NOW())
    `, [
      backupId, 
      JSON.stringify({ tipo: 'RESTAURACION', success: true }), 
      job.solicitadoPorId
    ]);

    // Desactivar Mantenimiento e invalidar sesiones registrando ultimoRestoreAt
    await workerDbPool.query(`
      UPDATE "Configuracion"
      SET "mantenimientoActivo" = false,
          "mensajeMantenimiento" = null,
          "mantenimientoDesde" = null,
          negocio = jsonb_set(COALESCE(negocio, '{}'::jsonb), '{ultimoRestoreAt}', to_jsonb(NOW()::text))
      WHERE id = 'default'
    `);

    console.log(`[Worker] Restauración y limpieza completada.`);
    fs.unlinkSync(tmpFilePath);

  } catch (err) {
    if (fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch {}
    }
    throw err;
  }
}

async function ejecutarDelete(job) {
  if (!s3Bucket) throw new Error('S3_BUCKET no está configurado.');

  const backupId = job.backupId;
  if (!backupId) throw new Error('backupId no especificado en el trabajo.');

  const histRes = await workerDbPool.query('SELECT "storageKey" FROM "HistorialBackup" WHERE id = $1', [backupId]);
  if (histRes.rows.length === 0) {
    console.log(`[Worker] Registro de backup ${backupId} no encontrado. Saltando borrado físico.`);
    return;
  }

  const { storageKey } = histRes.rows[0];
  console.log(`[Worker] Eliminando físicamente ${storageKey} de S3...`);

  await s3Client.send(new DeleteObjectCommand({
    Bucket: s3Bucket,
    Key: storageKey
  }));

  console.log(`[Worker] Objeto eliminado físicamente de S3.`);

  // Actualizar a DELETED
  await workerDbPool.query(`
    UPDATE "HistorialBackup"
    SET status = 'DELETED'
    WHERE id = $1
  `, [backupId]);
}

// ─── BUCLE DE POLLING DE LA COLA ───────────────────────────────────────────

async function startPollingLoop() {
  console.log(`[Worker] Iniciando bucle de consulta de trabajos (Worker ID: ${WORKER_ID})...`);

  // Bucle infinito
  while (true) {
    try {
      if (!currentJobId) {
        const job = await reclamarTrabajo();
        if (job) {
          await procesarTrabajo(job);
        }
      }
    } catch (err) {
      console.error('[Worker] Error general en el loop de trabajos:', err);
    }
    // Esperar 5 segundos antes de la siguiente consulta
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────

app.listen(WORKER_PORT, () => {
  console.log(`[Worker] Servidor HTTP corriendo en puerto ${WORKER_PORT}`);
  startPollingLoop();
});
