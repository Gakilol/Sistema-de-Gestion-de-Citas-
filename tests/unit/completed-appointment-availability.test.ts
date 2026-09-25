import { describe, expect, it } from 'vitest';
import { calculateAppointmentAvailability, findAppointmentConflicts } from '../../lib/appointments/appointment-availability';

const completedAppointment = {
  id: 'completed-1', empleado_id: 'staff-1', fecha: new Date('2026-09-25T00:00:00.000Z'),
  hora: '10:00', duracion: 60, estado: 'COMPLETADA', allowOverlap: false,
  cliente_nombre: 'Cliente', servicio: { nombre: 'Corte' }, empleado: { nombre: 'Profesional' },
};

function database() {
  const appointments = [completedAppointment];
  return {
    empleado: { findUnique: async () => ({ vacaciones: [], descansos: [], bloqueos: [], horario: null }) },
    configuracion: { findUnique: async () => null },
    cita: {
      findMany: async ({ where }: { where: { estado: { notIn: string[] } } }) =>
        appointments.filter(appointment => !where.estado.notIn.includes(appointment.estado)),
    },
  };
}

describe('disponibilidad de horarios completados', () => {
  it('mantiene reservado el horario de una cita completada', async () => {
    const db = database();
    const availability = await calculateAppointmentAvailability('staff-1', '2026-09-25', null, 60, '10:00', null, false, db);
    expect(availability.intervalosOcupados).toContainEqual(expect.objectContaining({ inicio: 600, fin: 660 }));
    const conflicts = await findAppointmentConflicts('staff-1', '2026-09-25', '10:00', 60, null, db);
    expect(conflicts).toHaveLength(1);
  });
});
