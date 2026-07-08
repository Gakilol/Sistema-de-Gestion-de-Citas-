/**
 * lib/audit/rate-limiter.ts
 *
 * Rate limiter para protección contra ataques de fuerza bruta en endpoints de autenticación.
 * Usa la tabla AuditLog como almacén de intentos (sin dependencias externas).
 *
 * Reglas implementadas:
 * - 5 intentos fallidos en 15 minutos por IP  → bloqueo temporal
 * - 5 intentos fallidos en 15 minutos por correo → bloqueo temporal
 * - Bloqueo progresivo: la duración aumenta con cada bloqueo consecutivo
 * - Mensajes genéricos: no revela si el correo existe o no
 */

import { prisma } from '@/lib/db';
import { logAudit } from './audit-logger';

// ─── Configuración de rate limiting ───────────────────────────────────────────
const MAX_ATTEMPTS = 5;               // Intentos fallidos antes de bloquear
const WINDOW_MINUTES = 15;            // Ventana de tiempo para contar intentos (minutos)
const BASE_BLOCK_MINUTES = 15;        // Duración base del primer bloqueo (minutos)
const MAX_BLOCK_MINUTES = 120;        // Máxima duración de bloqueo (2 horas)

export interface RateLimitResult {
  blocked: boolean;
  remainingAttempts?: number;
  blockedUntil?: Date;
  reason?: string;
}

/**
 * Cuenta los intentos de login fallidos en la ventana de tiempo definida.
 */
async function countRecentFailedAttempts(field: 'ipAddress' | 'userEmail', value: string): Promise<number> {
  if (!value) return 0;
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  return prisma.auditLog.count({
    where: {
      action: 'LOGIN_FAILED',
      [field]: value,
      createdAt: { gte: since },
    },
  });
}

/**
 * Cuenta los bloqueos previos para calcular la duración del próximo bloqueo (progresivo).
 */
async function countPreviousBlocks(field: 'ipAddress' | 'userEmail', value: string): Promise<number> {
  if (!value) return 0;
  return prisma.auditLog.count({
    where: {
      action: 'RATE_LIMIT_EXCEEDED',
      [field]: value,
    },
  });
}

/**
 * Calcula la duración del bloqueo de forma progresiva.
 * 1er bloqueo: 15 min, 2do: 30 min, 3ro: 60 min, 4to+: 120 min
 */
function calculateBlockDuration(previousBlocks: number): number {
  const duration = BASE_BLOCK_MINUTES * Math.pow(2, previousBlocks);
  return Math.min(duration, MAX_BLOCK_MINUTES);
}

/**
 * Verifica si una IP o correo está en período de bloqueo activo.
 */
async function isCurrentlyBlocked(
  field: 'ipAddress' | 'userEmail',
  value: string
): Promise<{ blocked: boolean; until?: Date }> {
  if (!value) return { blocked: false };

  // Buscamos el último evento de bloqueo registrado
  const lastBlock = await prisma.auditLog.findFirst({
    where: {
      action: 'RATE_LIMIT_EXCEEDED',
      [field]: value,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastBlock) return { blocked: false };

  // Calcular bloqueos previos para determinar duración del bloqueo actual
  const totalBlocks = await countPreviousBlocks(field, value);
  // El bloqueo actual tiene la duración del (totalBlocks)-ésimo bloqueo (ya incluye el último)
  const blockDurationMinutes = calculateBlockDuration(totalBlocks - 1);
  const blockedUntil = new Date(lastBlock.createdAt.getTime() + blockDurationMinutes * 60 * 1000);

  if (blockedUntil > new Date()) {
    return { blocked: true, until: blockedUntil };
  }

  return { blocked: false };
}

/**
 * Verifica si un intento de login debe ser bloqueado.
 * Evalúa por IP y por correo/email.
 *
 * @param ip      IP del cliente (puede ser enmascarada)
 * @param rawIp   IP real del cliente para el almacenamiento en DB
 * @param email   Correo del intento de login (puede ser inválido/inexistente)
 * @param ipAddress IP para guardar en audit (sin enmascarar en este contexto)
 * @param userAgent User agent del cliente
 * @returns RateLimitResult con estado del bloqueo
 */
export async function checkLoginRateLimit(
  ipAddress: string | null,
  email: string | null,
  userAgent?: string | null
): Promise<RateLimitResult> {
  const normalizedEmail = email?.trim().toLowerCase() || null;
  const normalizedIp = ipAddress || null;

  // 1. Verificar si ya está bloqueado por IP
  if (normalizedIp) {
    const ipStatus = await isCurrentlyBlocked('ipAddress', normalizedIp);
    if (ipStatus.blocked) {
      return {
        blocked: true,
        blockedUntil: ipStatus.until,
        reason: 'ip',
      };
    }
  }

  // 2. Verificar si ya está bloqueado por correo
  if (normalizedEmail) {
    const emailStatus = await isCurrentlyBlocked('userEmail', normalizedEmail);
    if (emailStatus.blocked) {
      return {
        blocked: true,
        blockedUntil: emailStatus.until,
        reason: 'email',
      };
    }
  }

  // 3. Contar intentos recientes por IP
  if (normalizedIp) {
    const ipAttempts = await countRecentFailedAttempts('ipAddress', normalizedIp);
    if (ipAttempts >= MAX_ATTEMPTS) {
      const previousBlocks = await countPreviousBlocks('ipAddress', normalizedIp);
      const blockMinutes = calculateBlockDuration(previousBlocks);
      const blockedUntil = new Date(Date.now() + blockMinutes * 60 * 1000);

      // Registrar evento de bloqueo en auditoría
      await logAudit({
        action: 'RATE_LIMIT_EXCEEDED',
        module: 'AUTH',
        status: 'FAILED',
        description: `Bloqueo temporal por fuerza bruta desde IP ${normalizedIp}. ${ipAttempts} intentos en ${WINDOW_MINUTES} min. Bloqueo por ${blockMinutes} min.`,
        ipAddress: normalizedIp,
        userAgent: userAgent || undefined,
        metadata: {
          reason: 'too_many_failed_logins_by_ip',
          attempts: ipAttempts,
          blockDurationMinutes: blockMinutes,
          blockedUntil: blockedUntil.toISOString(),
        },
      });

      return {
        blocked: true,
        blockedUntil,
        reason: 'ip',
      };
    }
  }

  // 4. Contar intentos recientes por correo
  if (normalizedEmail) {
    const emailAttempts = await countRecentFailedAttempts('userEmail', normalizedEmail);
    if (emailAttempts >= MAX_ATTEMPTS) {
      const previousBlocks = await countPreviousBlocks('userEmail', normalizedEmail);
      const blockMinutes = calculateBlockDuration(previousBlocks);
      const blockedUntil = new Date(Date.now() + blockMinutes * 60 * 1000);

      // Registrar evento de bloqueo en auditoría
      await logAudit({
        action: 'RATE_LIMIT_EXCEEDED',
        module: 'AUTH',
        status: 'FAILED',
        description: `Bloqueo temporal por fuerza bruta para el correo ${normalizedEmail}. ${emailAttempts} intentos en ${WINDOW_MINUTES} min. Bloqueo por ${blockMinutes} min.`,
        userEmail: normalizedEmail,
        ipAddress: normalizedIp || undefined,
        userAgent: userAgent || undefined,
        metadata: {
          reason: 'too_many_failed_logins_by_email',
          attempts: emailAttempts,
          blockDurationMinutes: blockMinutes,
          blockedUntil: blockedUntil.toISOString(),
        },
      });

      return {
        blocked: true,
        blockedUntil,
        reason: 'email',
      };
    }

    // Informar cuántos intentos le quedan antes del bloqueo
    const remaining = MAX_ATTEMPTS - emailAttempts - 1;
    return {
      blocked: false,
      remainingAttempts: remaining > 0 ? remaining : 0,
    };
  }

  return { blocked: false };
}

/**
 * Respuesta genérica de bloqueo — no revela si el correo existe o la razón exacta.
 */
export function getRateLimitResponse(): Response {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    {
      error: 'Demasiados intentos fallidos. Por seguridad, el acceso ha sido bloqueado temporalmente. Intente nuevamente más tarde.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': '900', // 15 minutos en segundos
      },
    }
  );
}
