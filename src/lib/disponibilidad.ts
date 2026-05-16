import { prisma } from './db';
import { addMinutes, format, isBefore, parse, startOfDay, endOfDay } from 'date-fns';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export async function calcularDisponibilidad(empleadoId: string, fechaYYYYMMDD: string, servicioId?: string | null) {
  const fechaDate = new Date(fechaYYYYMMDD + 'T00:00:00'); 

  // 1. Obtener datos del empleado y el servicio
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

  let duracionServicio = 30; // Default
  if (servicioId) {
    const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } });
    if (servicio) duracionServicio = servicio.duracion;
  }

  if (empleado.vacaciones.length > 0) {
    return { disponible: false, motivo: 'De vacaciones', bloques: [] };
  }

  const diaIndex = fechaDate.getDay();
  const diaNombre = DIAS_SEMANA[diaIndex];

  const horarioEmpleado: any = empleado.horario || {};
  const horarioDia: string[] = horarioEmpleado[diaNombre];

  if (!horarioDia || horarioDia.length === 0) {
    return { disponible: false, motivo: 'Día no laboral', bloques: [] };
  }

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
    const [inicio, fin] = turno.split('-');
    if (!inicio || !fin) continue;

    let currentTime = parse(inicio, 'HH:mm', fechaDate);
    const endTime = parse(fin, 'HH:mm', fechaDate);

    while (isBefore(currentTime, endTime)) {
      const horaString = format(currentTime, 'HH:mm');
      const endTimeConServicio = addMinutes(currentTime, duracionServicio);

      if (endTimeConServicio > endTime) {
        bloques.push({
          hora: horaString,
          disponible: false,
          motivo: 'Tiempo insuficiente'
        });
        currentTime = addMinutes(currentTime, bloqueIntervalo);
        continue;
      }

      let hayConflicto = false;
      let motivo = '';

      for (const cita of citas) {
        const citaInicio = parse(cita.hora, 'HH:mm', fechaDate);
        const citaFin = addMinutes(citaInicio, cita.duracion);

        if (currentTime < citaFin && endTimeConServicio > citaInicio) {
          hayConflicto = true;
          motivo = 'Cita reservada';
          break;
        }
      }

      if (!hayConflicto) {
        const descansosDia = empleado.descansos.filter(d => d.dia_semana === diaIndex);
        for (const descanso of descansosDia) {
          const descInicio = parse(descanso.hora_inicio, 'HH:mm', fechaDate);
          const descFin = parse(descanso.hora_fin, 'HH:mm', fechaDate);

          if (currentTime < descFin && endTimeConServicio > descInicio) {
            hayConflicto = true;
            motivo = 'Descanso';
            break;
          }
        }
      }

      if (!hayConflicto) {
        for (const bloqueo of empleado.bloqueos) {
          const blqInicio = parse(bloqueo.hora_inicio, 'HH:mm', fechaDate);
          const blqFin = parse(bloqueo.hora_fin, 'HH:mm', fechaDate);

          if (currentTime < blqFin && endTimeConServicio > blqInicio) {
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

      currentTime = addMinutes(currentTime, bloqueIntervalo);
    }
  }

  return { disponible: true, motivo: '', bloques };
}
