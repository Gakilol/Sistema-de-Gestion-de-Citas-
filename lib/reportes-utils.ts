/**
 * lib/reportes-utils.ts
 * Shared utilities for the Analytics & Reporting module.
 * Validates query parameters, builds date ranges, and checks authorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, endOfDay, isValid, differenceInDays } from 'date-fns';

export const ALLOWED_ROLES = ['ADMIN', 'TECH_SUPPORT'] as const;
export const MAX_DATE_RANGE_DAYS = 366;

export interface ReportFilters {
  from: Date;
  to: Date;
  fromPrev: Date;
  toPrev: Date;
  rawFrom: string;
  rawTo: string;
  empleadoId?: string;
  servicioId?: string;
  clienteId?: string;
  estado?: string;
  compare: boolean;
}

/**
 * Validates that the requesting user has ADMIN or TECH_SUPPORT role.
 * Uses getUserContext which verifies the JWT cryptographically.
 * Returns a 403 response if unauthorized, otherwise returns null.
 */
export function requireReporteRole(req: NextRequest): NextResponse | null {
  // Importamos getUserContext aquí para evitar dependencias circulares
  const { getUserContext } = require('@/lib/auth-helpers');
  const { userRole } = getUserContext(req);
  if (!userRole || !ALLOWED_ROLES.includes(userRole as any)) {
    return NextResponse.json({ error: 'Acceso denegado. Solo ADMIN y TECH_SUPPORT pueden acceder a los reportes.' }, { status: 403 });
  }
  return null;
}


/**
 * Validates and parses report filter query parameters.
 * Returns parsed filters or a 400 error response.
 */
export function parseReportFilters(req: NextRequest): { filters: ReportFilters } | { error: NextResponse } {
  const sp = req.nextUrl.searchParams;
  const rawFrom = sp.get('from') || sp.get('desde') || '';
  const rawTo   = sp.get('to')   || sp.get('hasta') || '';

  // Default: last 30 days
  const defaultTo   = new Date();
  const defaultFrom = new Date(Date.now() - 29 * 86400000);

  const fromDate = rawFrom ? new Date(rawFrom + 'T00:00:00Z') : defaultFrom;
  const toDate   = rawTo   ? new Date(rawTo   + 'T23:59:59Z') : defaultTo;

  if (!isValid(fromDate) || !isValid(toDate)) {
    return { error: NextResponse.json({ error: 'Fechas inválidas. Use el formato YYYY-MM-DD.' }, { status: 400 }) };
  }

  if (fromDate > toDate) {
    return { error: NextResponse.json({ error: 'La fecha de inicio no puede ser mayor a la fecha de fin.' }, { status: 400 }) };
  }

  const rangeDays = differenceInDays(toDate, fromDate);
  if (rangeDays > MAX_DATE_RANGE_DAYS) {
    return { error: NextResponse.json({ error: `El rango de fechas no puede superar los ${MAX_DATE_RANGE_DAYS} días.` }, { status: 400 }) };
  }

  // Calculate previous period of equal length for comparison
  const periodMs = toDate.getTime() - fromDate.getTime();
  const toPrev   = new Date(fromDate.getTime() - 1);
  const fromPrev = new Date(toPrev.getTime() - periodMs);

  const empleadoId = sanitizeId(sp.get('empleadoId') || sp.get('professionalId') || '');
  const servicioId = sanitizeId(sp.get('servicioId')  || sp.get('serviceId')     || '');
  const clienteId  = sanitizeId(sp.get('clienteId')   || sp.get('clientId')      || '');
  const estado     = sanitizeEstado(sp.get('estado')   || sp.get('status')        || '');
  const compare    = sp.get('compare') === 'true';

  return {
    filters: {
      from: startOfDay(fromDate),
      to:   endOfDay(toDate),
      fromPrev: startOfDay(fromPrev),
      toPrev:   endOfDay(toPrev),
      rawFrom: rawFrom || fromDate.toISOString().split('T')[0],
      rawTo:   rawTo   || toDate.toISOString().split('T')[0],
      empleadoId:  empleadoId  || undefined,
      servicioId:  servicioId  || undefined,
      clienteId:   clienteId   || undefined,
      estado:      estado       || undefined,
      compare,
    },
  };
}

/** Strip non-UUID characters to prevent injection */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 36);
}

/** Allow only known status values */
const VALID_ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW', 'REPROGRAMADA'];
function sanitizeEstado(s: string): string {
  return VALID_ESTADOS.includes(s) ? s : '';
}

/** Safe number formatter: rounds to 2 decimals, returns 0 if NaN or Infinite */
export function safeRate(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator)) return 0;
  const result = (numerator / denominator) * 100;
  return isFinite(result) ? Math.round(result * 100) / 100 : 0;
}

/** Compute delta between current and previous period values */
export function computeDelta(current: number, previous: number): { absolute: number; percent: number | null } {
  const absolute = current - previous;
  if (previous === 0) return { absolute, percent: null }; // Avoid infinite %
  const percent = Math.round((absolute / previous) * 10000) / 100;
  return { absolute, percent };
}

/** Serialize BigInt-safe JSON */
export function jsonBigIntSafe(data: unknown): string {
  return JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v));
}
