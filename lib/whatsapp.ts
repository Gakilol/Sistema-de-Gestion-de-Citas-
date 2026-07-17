// lib/whatsapp.ts
// Generador de mensajes WhatsApp para HAIR STYLE Salón & Barber
// Usa enlaces wa.me gratuitos, sin necesidad de API externa

export interface CitaWA {
  cliente_nombre: string;
  cliente_telefono?: string | null;
  servicio: string;
  empleado: string;
  empleado_id?: string | null;
  empleado_email?: string | null;
  empleado_titulo?: string | null;
  fecha: string | Date;
  hora: string;
  duracion?: number;
  estado?: string;
  notas?: string | null;
}

const SALON_NAME = 'HAIR STYLE Salon & Barber';

import { formatDBDateLong } from './timezone';
import { formatTo12h } from './utils';

function fmtFecha(d: string | Date): string {
  return formatDBDateLong(d);
}

//// ─── Confirmación de cita ───────────────────────────────────────────────────
export function mensajeConfirmacion(cita: CitaWA): string {
  const lines = [
    `${SALON_NAME}`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido confirmada con éxito. Aquí están los detalles:`,
    ``,
    `Fecha: ${fmtFecha(cita.fecha)}`,
    `Hora: ${formatTo12h(cita.hora)}`,
    cita.duracion ? `Duracion: ${cita.duracion} minutos` : null,
    cita.notas ? `Notas: ${cita.notas}` : null,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

// ─── Recordatorio ───────────────────────────────────────────────────────────
export function mensajeRecordatorio(cita: CitaWA): string {
  const lines = [
    `${SALON_NAME}`,
    ``,
    `Hola ${cita.cliente_nombre}, le recordamos su cita:`,
    ``,
    `Fecha: ${fmtFecha(cita.fecha)}`,
    `Hora: ${formatTo12h(cita.hora)}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
  ];

  return lines.filter(line => line !== null).join('\n');
}

// ─── Recordatorio 1 Hora Antes ───────────────────────────────────────────────
export function mensajeRecordatorioUnaHora(cita: CitaWA): string {
  const lines = [
    `${SALON_NAME}`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Le recordamos que su cita está programada para hoy:`,
    ``,
    `Hora: ${formatTo12h(cita.hora)}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ─── Cancelación ────────────────────────────────────────────────────────────
export function mensajeCancelacion(cita: CitaWA): string {
  return [
    `${SALON_NAME}`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita del ${fmtFecha(cita.fecha)} a las ${formatTo12h(cita.hora)} ha sido cancelada.`,
    ``,
    `Si desea reagendar, no dude en contactarnos.`,
    `Hasta pronto.`,
  ].join('\n');
}

// ─── Reprogramación ─────────────────────────────────────────────────────────
export function mensajeReprogramacion(cita: CitaWA): string {
  return [
    `${SALON_NAME}`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido reprogramada:`,
    ``,
    `Nueva fecha: ${fmtFecha(cita.fecha)}`,
    `Nueva hora: ${formatTo12h(cita.hora)}`,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
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

// ─── Reactivación de clientes inactivos ──────────────────────────────────────
export interface InactiveClientWA {
  cliente_nombre: string;
  cliente_telefono?: string | null;
  dias_inactividad: number;
  ultimo_servicio: string;
  empleado_nombre?: string | null;
}

export function mensajeReactivacion(params: InactiveClientWA): string {
  const lines = [
    `Hola ${params.cliente_nombre}, esperamos que estés muy bien.`,
    ``,
    `Te recordamos que ya han pasado ${params.dias_inactividad} días desde tu último servicio de ${params.ultimo_servicio} en HAIR STYLE Salon & Barber.`,
    ``,
    `Si deseas, podemos ayudarte a agendar nuevamente el mismo servicio o cualquier otro que necesites.`,
    ``,
    `¿Te gustaría programar una nueva cita?`
  ];
  return lines.join('\n');
}

export function urlWhatsAppReactivacion(params: InactiveClientWA): string | null {
  if (!params.cliente_telefono) return null;
  return generarEnlaceWA(params.cliente_telefono, mensajeReactivacion(params));
}

