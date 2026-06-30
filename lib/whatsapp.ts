// lib/whatsapp.ts
// Generador de mensajes WhatsApp para HAIR STYLE Salón & Barber
// Usa enlaces wa.me gratuitos, sin necesidad de API externa

export interface CitaWA {
  cliente_nombre: string;
  cliente_telefono?: string | null;
  servicio: string;
  empleado: string;
  fecha: string | Date;
  hora: string;
  duracion?: number;
  estado?: string;
  notas?: string | null;
}

const SALON_NAME = 'HAIR STYLE Salon & Barber';

import { formatDBDateLong } from './timezone';

function fmtFecha(d: string | Date): string {
  return formatDBDateLong(d);
}

// ─── Confirmación de cita ───────────────────────────────────────────────────
export function mensajeConfirmacion(cita: CitaWA): string {
  const lines = [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido *confirmada*. Aqui estan los detalles:`,
    ``,
    `*Estilistaasignado(a) para su cita:* ${cita.empleado}`,
    `*Fecha:* ${fmtFecha(cita.fecha)}`,
    `*Hora:* ${cita.hora}`,
    cita.duracion ? `*Duracion:* ${cita.duracion} minutos` : null,
    cita.notas ? `*Notas:* ${cita.notas}` : null,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

// ─── Recordatorio ───────────────────────────────────────────────────────────
export function mensajeRecordatorio(cita: CitaWA): string {
  const lines = [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Le recordamos que tiene una cita *manana*:`,
    ``,
    `*Colaborador asignado(a) para su cita:* ${cita.empleado}`,
    `*Fecha:* ${fmtFecha(cita.fecha)}`,
    `*Hora:* ${cita.hora}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ─── Recordatorio 1 Hora Antes ───────────────────────────────────────────────
export function mensajeRecordatorioUnaHora(cita: CitaWA): string {
  const lines = [
    `*${SALON_NAME}* ⏱️`,
    ``,
    `Hola *${cita.cliente_nombre}*,`,
    `Le recordamos que su cita está programada para *hoy*:`,
    ``,
    `*Colaborador asignado(a) para su cita:* ${cita.empleado}`,
    `*Hora:* ${cita.hora}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ─── Cancelación ────────────────────────────────────────────────────────────
export function mensajeCancelacion(cita: CitaWA): string {
  return [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita del *${fmtFecha(cita.fecha)}* a las *${cita.hora}* ha sido cancelada.`,
    ``,
    `Si desea reagendar, no dude en contactarnos.`,
    `Hasta pronto.`,
  ].join('\n');
}

// ─── Reprogramación ─────────────────────────────────────────────────────────
export function mensajeReprogramacion(cita: CitaWA): string {
  return [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido *reprogramada*:`,
    ``,
    `*Colaborador asignado(a) para su cita:* ${cita.empleado}`,
    `*Nueva fecha:* ${fmtFecha(cita.fecha)}`,
    `*Nueva hora:* ${cita.hora}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención`,
  ].join('\n');
}

// ─── Generar enlace wa.me ───────────────────────────────────────────────────
export function generarEnlaceWA(telefono: string, mensaje: string): string {
  // Limpiar teléfono: solo dígitos, agregar código de país si no tiene
  const cleaned = telefono.replace(/\D/g, '');
  const numero = cleaned.startsWith('505') || cleaned.startsWith('506')
    ? cleaned
    : `506${cleaned}`; // 506 = Costa Rica por defecto
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

// ─── Botón listo (devuelve URL directa) ─────────────────────────────────────
export function urlWhatsAppConfirmacion(cita: CitaWA): string | null {
  if (!cita.cliente_telefono) return null;
  return generarEnlaceWA(cita.cliente_telefono, mensajeConfirmacion(cita));
}

export function urlWhatsAppRecordatorio(cita: CitaWA): string | null {
  if (!cita.cliente_telefono) return null;
  return generarEnlaceWA(cita.cliente_telefono, mensajeRecordatorio(cita));
}

export function urlWhatsAppCancelacion(cita: CitaWA): string | null {
  if (!cita.cliente_telefono) return null;
  return generarEnlaceWA(cita.cliente_telefono, mensajeCancelacion(cita));
}
