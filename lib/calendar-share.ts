// lib/calendar-share.ts
// Acción reutilizable para compartir o enviar el evento al cliente sin requerer OAuth directo de Google.

import { formatTo12h } from '@/lib/utils';
import { formatDBDateLong } from '@/lib/timezone';

export interface CalendarEventShareData {
  id: string;
  cliente_nombre: string;
  fecha: string;
  hora: string;
  duracion?: number;
  empleado?: { nombre?: string };
  servicio?: { nombre?: string };
  citaServicios?: Array<{ servicio?: { nombre?: string } }>;
  estado?: string;
  notas?: string;
}

/**
 * Retorna los nombres de los servicios formateados como lista separada por comas.
 */
export function getServiciosNombres(cita: CalendarEventShareData): string[] {
  if (cita.citaServicios && cita.citaServicios.length > 0) {
    return cita.citaServicios
      .map((cs) => cs.servicio?.nombre)
      .filter((n): n is string => Boolean(n));
  }
  if (cita.servicio?.nombre) {
    return [cita.servicio.nombre];
  }
  return [];
}

/**
 * Formatea el horario de inicio y fin legible (ej: "10:00 AM – 10:30 AM")
 */
export function getHorarioLegible(horaInicioStr: string, duracionMin: number = 30): { horaInicio: string; horaFin: string; textoHorario: string } {
  const horaInicio = formatTo12h(horaInicioStr);
  const [h, m] = (horaInicioStr || '00:00').split(':').map(Number);
  const totalMin = (h || 0) * 60 + (m || 0) + (duracionMin || 30);
  const hFin = Math.floor(totalMin / 60);
  const mFin = totalMin % 60;
  const horaFinStr = `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
  const horaFin = formatTo12h(horaFinStr);

  return {
    horaInicio,
    horaFin,
    textoHorario: `${horaInicio} – ${horaFin}`,
  };
}

/**
 * Prepara el objeto completo con URLs de WhatsApp y texto de resumen para compartir.
 */
export function buildSharePayload(cita: CalendarEventShareData) {
  const fechaLegible = formatDBDateLong(cita.fecha);
  const { textoHorario } = getHorarioLegible(cita.hora, cita.duracion);
  const servicios = getServiciosNombres(cita);
  const profesional = cita.empleado?.nombre || 'Nuestro equipo';

  const textoServicios = servicios.length > 0 ? servicios.join(', ') : 'Servicio general';

  const mensajeBase =
    `✨ *Recordatorio de Cita en HAIR STYLE Salon & Barber* ✨\n\n` +
    `👤 *Cliente:* ${cita.cliente_nombre}\n` +
    `📅 *Fecha:* ${fechaLegible}\n` +
    `⏰ *Horario:* ${textoHorario}\n` +
    `💈 *Atendido por:* ${profesional}\n` +
    `✂️ *Servicio(s):* ${textoServicios}\n\n` +
    `¡Te esperamos puntual! Si deseas cancelar o reprogramar, por favor avísanos con anticipación.`;

  return {
    fechaLegible,
    textoHorario,
    servicios,
    profesional,
    mensajeBase,
  };
}
