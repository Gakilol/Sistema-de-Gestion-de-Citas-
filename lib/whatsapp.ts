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
  precio?: number;
  estado?: string;
  notas?: string | null;
}

const SALON_NAME = 'HAIR STYLE Salon & Barber';

function fmtFecha(d: string | Date): string {
  return new Date(d).toLocaleDateString('es-NI', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fmtPrecio(p: number): string {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'USD' }).format(p);
}

// ─── Confirmación de cita ───────────────────────────────────────────────────
export function mensajeConfirmacion(cita: CitaWA): string {
  const lines = [
    `*${SALON_NAME}*`,
    ``,
    `Hola ${cita.cliente_nombre},`,
    `Su cita ha sido *confirmada*. Aqui estan los detalles:`,
    ``,
    `*Servicio:* ${cita.servicio}`,
    `*Estilista:* ${cita.empleado}`,
    `*Fecha:* ${fmtFecha(cita.fecha)}`,
    `*Hora:* ${cita.hora}`,
    cita.duracion ? `*Duracion:* ${cita.duracion} minutos` : null,
    cita.precio    ? `*Precio:* ${fmtPrecio(cita.precio)}` : null,
    cita.notas     ? `*Notas:* ${cita.notas}` : null,
    ``,
    `Por favor llegue 10 minutos antes de su cita.`,
    `Si necesita reprogramar o cancelar, contactenos con anticipacion.`,
    ``,
    `Le esperamos.`,
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
    `*Servicio:* ${cita.servicio}`,
    `*Estilista:* ${cita.empleado}`,
    `*Fecha:* ${fmtFecha(cita.fecha)}`,
    `*Hora:* ${cita.hora}`,
    ``,
    `Le esperamos.`,
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
    `*Servicio:* ${cita.servicio}`,
    `*Estilista:* ${cita.empleado}`,
    `*Nueva fecha:* ${fmtFecha(cita.fecha)}`,
    `*Nueva hora:* ${cita.hora}`,
    ``,
    `Le esperamos.`,
  ].join('\n');
}

// ─── Generar enlace wa.me ───────────────────────────────────────────────────
export function generarEnlaceWA(telefono: string, mensaje: string): string {
  // Limpiar teléfono: solo dígitos, agregar código de país si no tiene
  const cleaned = telefono.replace(/\D/g, '');
  const numero  = cleaned.startsWith('505') || cleaned.startsWith('506')
    ? cleaned
    : `505${cleaned}`; // 505 = Nicaragua por defecto
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
