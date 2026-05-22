import { prisma } from './db';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function parseYYYYMMDD(fechaYYYYMMDD: string): Date {
  const [year, month, day] = fechaYYYYMMDD.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Interfaz de intervalo ocupado ──────────────────────────────────────────
export interface IntervaloOcupado {
  inicio: number;  // minutos desde medianoche
  fin: number;     // minutos desde medianoche
  motivo: string;
}

// ─── Validación pura de hora exacta (sin I/O, sin side-effects) ─────────────
// Esta es la FUENTE DE VERDAD para determinar si una hora es válida.
export function validarHoraExacta(
  horaStr: string,
  duracion: number,
  jornadaInicio: string,
  jornadaFin: string,
  intervalosOcupados: IntervaloOcupado[],
  permitirHorarioExtendido: boolean = false
): { valida: boolean; motivo: string } {
  // Validar formato HH:MM
  if (!/^\d{2}:\d{2}$/.test(horaStr)) {
    return { valida: false, motivo: 'Formato de hora inválido (use HH:MM)' };
  }

  const [h, m] = horaStr.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return { valida: false, motivo: 'Hora fuera de rango válido' };
  }

  if (duracion <= 0) {
    return { valida: false, motivo: 'La duración debe ser mayor a 0' };
  }

  const startMin = timeToMinutes(horaStr);
  const endMin = startMin + duracion;
  const jornadaInicioMin = timeToMinutes(jornadaInicio);
  const jornadaFinMin = timeToMinutes(jornadaFin);

  // Validar que esté dentro de la jornada laboral (solo si no se permite horario especial/extendido)
  if (!permitirHorarioExtendido) {
    if (startMin < jornadaInicioMin) {
      return { valida: false, motivo: `Antes del inicio de jornada (${jornadaInicio})` };
    }
    if (endMin > jornadaFinMin) {
      return { valida: false, motivo: `Excede el fin de jornada (${jornadaFin}). La cita terminaría a las ${minutesToTime(endMin)}` };
    }
  }

  // Validar conflictos con todos los intervalos ocupados (las colisiones de agenda se validan siempre)
  for (const int of intervalosOcupados) {
    if (startMin < int.fin && endMin > int.inicio) {
      return {
        valida: false,
        motivo: `${int.motivo} (${minutesToTime(int.inicio)} - ${minutesToTime(int.fin)})`
      };
    }
  }

  return { valida: true, motivo: 'Disponible' };
}

// ─── Cálculo completo de disponibilidad ─────────────────────────────────────
export async function calcularDisponibilidad(
  empleadoId: string, 
  fechaYYYYMMDD: string, 
  servicioId?: string | null,
  duracionTotal?: number | null,
  horaRequerida?: string | null,
  excludeCitaId?: string | null,
  permitirHorarioExtendido: boolean = false
) {
  const fechaDate = parseYYYYMMDD(fechaYYYYMMDD);

  const empleado = await prisma.empleado.findUnique({
    where: { id: empleadoId },
    include: {
      vacaciones: {
        where: {
          estado: 'APROBADO',
          fecha_inicio: { lte: fechaDate },
          fecha_fin: { gte: fechaDate },
        }
      },
      descansos: true,
      bloqueos: {
        where: {
          fecha: fechaDate
        }
      }
    }
  });

  if (!empleado) throw new Error('Empleado no encontrado');

  let duracionServicio = 30;
  if (duracionTotal !== undefined && duracionTotal !== null) {
    duracionServicio = duracionTotal;
  } else if (servicioId) {
    const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } });
    if (servicio) duracionServicio = servicio.duracion;
  }

  if (empleado.vacaciones.length > 0) {
    return { disponible: false, motivo: 'De vacaciones', bloques: [], jornada: null, intervalosOcupados: [] };
  }

  const diaIndex = fechaDate.getUTCDay();
  const diaNombre = DIAS_SEMANA[diaIndex];

  const DEFAULT_HORARIOS_GLOBALES: any = {
    lunes:     { activo: true,  inicio: '08:00', fin: '18:00' },
    martes:    { activo: true,  inicio: '08:00', fin: '18:00' },
    miercoles: { activo: true,  inicio: '08:00', fin: '18:00' },
    jueves:    { activo: true,  inicio: '08:00', fin: '18:00' },
    viernes:   { activo: true,  inicio: '08:00', fin: '18:00' },
    sabado:    { activo: true,  inicio: '08:00', fin: '14:00' },
    domingo:   { activo: false, inicio: '09:00', fin: '13:00' },
  };

  const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
  const horariosGlobales = (config?.horarios as any) || DEFAULT_HORARIOS_GLOBALES;
  const configDia = horariosGlobales[diaNombre] || DEFAULT_HORARIOS_GLOBALES[diaNombre];

  if (!configDia || !configDia.activo) {
    if (!permitirHorarioExtendido) {
      return { disponible: false, motivo: 'Día no laboral', bloques: [], jornada: null, intervalosOcupados: [] };
    }
  }

  const jornada = { 
    inicio: (configDia && configDia.inicio) ? (configDia.inicio as string) : '08:00', 
    fin: (configDia && configDia.fin) ? (configDia.fin as string) : '18:00',
    activo: configDia ? (configDia.activo as boolean) : false
  };

  // Obtener citas del día, excluyendo la cita que se está editando si aplica
  const citasWhere: any = {
    empleado_id: empleadoId,
    fecha: fechaDate,
    estado: { notIn: ['CANCELADA', 'REPROGRAMADA'] }
  };
  if (excludeCitaId) {
    citasWhere.id = { not: excludeCitaId };
  }

  const citas = await prisma.cita.findMany({ where: citasWhere });

  // ─── Construir lista unificada de intervalos ocupados ───────────────────
  const descansosDia = empleado.descansos.filter(d => d.dia_semana === diaIndex);

  const intervalosOcupados: IntervaloOcupado[] = [
    ...citas.map(c => ({
      inicio: timeToMinutes(c.hora),
      fin: timeToMinutes(c.hora) + c.duracion,
      motivo: 'Cita reservada'
    })),
    ...descansosDia.map(d => ({
      inicio: timeToMinutes(d.hora_inicio),
      fin: timeToMinutes(d.hora_fin),
      motivo: 'Descanso'
    })),
    ...empleado.bloqueos.map(b => ({
      inicio: timeToMinutes(b.hora_inicio),
      fin: timeToMinutes(b.hora_fin),
      motivo: b.motivo || 'Bloqueado'
    }))
  ].sort((a, b) => a.inicio - b.inicio);

  // ─── Generar bloques sugeridos de 15 min (retrocompatibilidad + Smart Slots) ─
  const horarioDia: any[] = [{ inicio: jornada.inicio, fin: jornada.fin }];
  const bloques: Array<{ hora: string; disponible: boolean; motivo: string }> = [];
  const bloqueIntervalo = 15;

  for (const turno of horarioDia) {
    let inicio = '';
    let fin = '';

    if (typeof turno === 'string') {
      const parts = turno.split('-');
      inicio = parts[0] || '';
      fin = parts[1] || '';
    } else if (turno && typeof turno === 'object') {
      inicio = turno.inicio || turno.start || '';
      fin = turno.fin || turno.end || '';
    }

    if (!inicio || !fin) continue;

    let currentMinutes = timeToMinutes(inicio);
    const endMinutes = timeToMinutes(fin);

    while (currentMinutes < endMinutes) {
      const horaString = minutesToTime(currentMinutes);
      const resultado = validarHoraExacta(horaString, duracionServicio, jornada.inicio, jornada.fin, intervalosOcupados, permitirHorarioExtendido);

      bloques.push({
        hora: horaString,
        disponible: resultado.valida,
        motivo: resultado.valida ? 'Disponible' : resultado.motivo
      });

      currentMinutes += bloqueIntervalo;
    }
  }

  // ─── Si se solicita validar una hora específica, inyectarla en bloques ──
  if (horaRequerida && /^\d{2}:\d{2}$/.test(horaRequerida)) {
    const existe = bloques.find(b => b.hora === horaRequerida);
    const resultado = validarHoraExacta(horaRequerida, duracionServicio, jornada.inicio, jornada.fin, intervalosOcupados, permitirHorarioExtendido);

    if (existe) {
      existe.disponible = resultado.valida;
      existe.motivo = resultado.valida ? 'Disponible' : resultado.motivo;
    } else {
      bloques.push({
        hora: horaRequerida,
        disponible: resultado.valida,
        motivo: resultado.valida ? 'Disponible' : resultado.motivo
      });
      // Re-ordenar por hora
      bloques.sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
    }
  }

  return {
    disponible: true,
    motivo: '',
    bloques,
    jornada,
    intervalosOcupados
  };
}
