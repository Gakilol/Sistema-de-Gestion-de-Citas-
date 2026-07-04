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

// ─── Confirmación de cita ───────────────────────────────────────────────────
export function mensajeConfirmacion(cita: CitaWA): string {
  const titulo = cita.empleado_titulo || 'Colaborador asignado para su cita';
  const lines = [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido *confirmada*. Aqui estan los detalles:`,
    ``,
    `*${titulo}:* ${cita.empleado}`,
    `*Fecha:* ${fmtFecha(cita.fecha)}`,
    `*Hora:* ${formatTo12h(cita.hora)}`,
    cita.duracion ? `*Duracion:* ${cita.duracion} minutos` : null,
    cita.notas ? `*Notas:* ${cita.notas}` : null,
    ``,
    `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

// ─── Recordatorio ───────────────────────────────────────────────────────────
/**
 * Mensaje de Recordatorio de WhatsApp
 * 
 * NOTA DE CONFIGURACIÓN:
 * Este recordatorio oculta la línea de "Profesional" para ciertos profesionales basándose en:
 * - WHATSAPP_HIDE_PROFESSIONAL_EMAILS: lista de correos separados por comas.
 * - WHATSAPP_HIDE_PROFESSIONAL_USER_IDS: lista de UUIDs separados por comas.
 * 
 * Si necesitas obtener el UUID de un colaborador como Álvaro para configurarlo en el .env,
 * puedes realizar la siguiente consulta SQL en tu base de datos:
 * 
 * SELECT id, nombre, correo, rol
 * FROM "Empleado"
 * WHERE LOWER(nombre) LIKE '%alvaro%'
 * OR LOWER(correo) LIKE '%alvaro%';
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function mensajeRecordatorio(cita: CitaWA): string {
  const hideEmailsEnv = process.env.WHATSAPP_HIDE_PROFESSIONAL_EMAILS || '';
  const hideUserIdsEnv = process.env.WHATSAPP_HIDE_PROFESSIONAL_USER_IDS || '';

  const hideEmails = hideEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const hideUserIds = hideUserIdsEnv.split(',').map(id => id.trim()).filter(Boolean);

  const matchedByEmail = cita.empleado_email && hideEmails.includes(cita.empleado_email.toLowerCase());
  const matchedById = cita.empleado_id && hideUserIds.includes(cita.empleado_id);

  // Fallback seguro: si el nombre o el email del empleado contiene "alvaro" (ignorando tildes y mayúsculas)
  const isAlvaroByName = cita.empleado && cleanString(cita.empleado).includes("alvaro");
  const isAlvaroByEmail = cita.empleado_email && cleanString(cita.empleado_email).includes("alvaro");

  const ocultarProfesional = matchedByEmail || matchedById || isAlvaroByName || isAlvaroByEmail;

  const lines = [
    `HAIR STYLE Salon & Barber`,
    ``,
    `Hola ${cita.cliente_nombre}, Recordarle su cita. `,
    `Aqui estan los detalles:`,
    ocultarProfesional ? null : `Profesional: ${cita.empleado}`,
    `Fecha: ${fmtFecha(cita.fecha)}`,
    `Hora: ${formatTo12h(cita.hora)}`,
    ``,
    `Le agradecemos presentarse 5 minutos`,
    ` antes de su cita para una mejor atenció`
  ];

  return lines.filter(line => line !== null).join('\n');
}

// ─── Recordatorio 1 Hora Antes ───────────────────────────────────────────────
export function mensajeRecordatorioUnaHora(cita: CitaWA): string {
  const titulo = cita.empleado_titulo || 'Colaborador asignado para su cita';
  const lines = [
    `*${SALON_NAME}* ⏱️`,
    ``,
    `Hola *${cita.cliente_nombre}*,`,
    `Le recordamos que su cita está programada para *hoy*:`,
    ``,
    `*${titulo}:* ${cita.empleado}`,
    `*Hora:* ${formatTo12h(cita.hora)}`,
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
    `Su cita del *${fmtFecha(cita.fecha)}* a las *${formatTo12h(cita.hora)}* ha sido cancelada.`,
    ``,
    `Si desea reagendar, no dude en contactarnos.`,
    `Hasta pronto.`,
  ].join('\n');
}

// ─── Reprogramación ─────────────────────────────────────────────────────────
export function mensajeReprogramacion(cita: CitaWA): string {
  const titulo = cita.empleado_titulo || 'Colaborador asignado para su cita';
  return [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido *reprogramada*:`,
    ``,
    `*${titulo}:* ${cita.empleado}`,
    `*Nueva fecha:* ${fmtFecha(cita.fecha)}`,
    `*Nueva hora:* ${formatTo12h(cita.hora)}`,
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
