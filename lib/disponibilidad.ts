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

export async function calcularDisponibilidad(
  empleadoId: string, 
  fechaYYYYMMDD: string, 
  servicioId?: string | null,
  duracionTotal?: number | null
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
    return { disponible: false, motivo: 'De vacaciones', bloques: [] };
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
    return { disponible: false, motivo: 'Día no laboral', bloques: [] };
  }

  const horarioDia: any[] = [{ inicio: configDia.inicio, fin: configDia.fin }];

  const citas = await prisma.cita.findMany({
    where: {
      empleado_id: empleadoId,
      fecha: fechaDate,
      estado: { notIn: ['CANCELADA', 'REPROGRAMADA'] }
    }
  });

  const bloques = [];
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
      const nextMinutes = currentMinutes + duracionServicio;

      if (nextMinutes > endMinutes) {
        bloques.push({ hora: horaString, disponible: false, motivo: 'Tiempo insuficiente' });
        currentMinutes += bloqueIntervalo;
        continue;
      }

      let hayConflicto = false;
      let motivo = '';

      for (const cita of citas) {
        const citaInicio = timeToMinutes(cita.hora);
        const citaFin = citaInicio + cita.duracion;
        if (currentMinutes < citaFin && nextMinutes > citaInicio) {
          hayConflicto = true;
          motivo = 'Cita reservada';
          break;
        }
      }

      if (!hayConflicto) {
        const descansosDia = empleado.descansos.filter(d => d.dia_semana === diaIndex);
        for (const descanso of descansosDia) {
          const descInicio = timeToMinutes(descanso.hora_inicio);
          const descFin = timeToMinutes(descanso.hora_fin);
          if (currentMinutes < descFin && nextMinutes > descInicio) {
            hayConflicto = true;
            motivo = 'Descanso';
            break;
          }
        }
      }

      if (!hayConflicto) {
        for (const bloqueo of empleado.bloqueos) {
          const blqInicio = timeToMinutes(bloqueo.hora_inicio);
          const blqFin = timeToMinutes(bloqueo.hora_fin);
          if (currentMinutes < blqFin && nextMinutes > blqInicio) {
            hayConflicto = true;
            motivo = bloqueo.motivo || 'Bloqueado';
            break;
          }
        }
      }

      bloques.push({
        hora: horaString,
        disponible: !hayConflicto,
        motivo: hayConflicto ? motivo : 'Disponible'
      });

      currentMinutes += bloqueIntervalo;
    }
  }

  return { disponible: true, motivo: '', bloques };
}
