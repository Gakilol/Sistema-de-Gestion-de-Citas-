import { describe, expect, it } from 'vitest';
import { hasAppointmentScheduleChange } from '../../lib/appointments/appointment-schedule-change';

const original = {
  fecha: new Date('2026-09-25T00:00:00.000Z'), hora: '10:00', duracion: 60,
  empleado_id: 'staff-1', servicio_id: 'service-1',
  citaServicios: [{ servicio_id: 'service-1', duracion: 60, orden: 0 }],
};

describe('cambios reales de horario', () => {
  it('permite enviar el formulario completo sin tratar campos iguales como movimiento', () => {
    expect(hasAppointmentScheduleChange(original, {
      fecha: '2026-09-25', hora: '10:00', empleado_id: 'staff-1',
      servicios_seleccionados: [{ id: 'service-1', duracion: 60 }], notas: 'Nueva nota',
    })).toBe(false);
  });

  it('detecta cambios de fecha, hora, profesional y duración', () => {
    expect(hasAppointmentScheduleChange(original, { fecha: '2026-09-26' })).toBe(true);
    expect(hasAppointmentScheduleChange(original, { hora: '11:00' })).toBe(true);
    expect(hasAppointmentScheduleChange(original, { empleado_id: 'staff-2' })).toBe(true);
    expect(hasAppointmentScheduleChange(original, { servicios_seleccionados: [{ id: 'service-1', duracion: 90 }] })).toBe(true);
  });
});
