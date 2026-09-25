import { describe, expect, it } from 'vitest';
import { EstadoCita } from '@prisma/client';
import { getAutomaticAppointmentStatus, getNowInBusinessTZ } from '@/lib/appointments/appointment-status-automation';

const appointment = {
  fecha: new Date('2026-08-21T00:00:00.000Z'),
  hora: '10:00',
  duracion: 60,
  estado: EstadoCita.PENDIENTE,
};

describe('automatizacion de estados de citas', () => {
  it('mantiene pendiente antes de la hora de inicio', () => {
    expect(getAutomaticAppointmentStatus(appointment, new Date('2026-08-21T09:59:00Z')).status)
      .toBe(EstadoCita.PENDIENTE);
  });

  it('pasa a en progreso durante el servicio', () => {
    expect(getAutomaticAppointmentStatus(appointment, new Date('2026-08-21T10:30:00Z')).status)
      .toBe(EstadoCita.EN_PROGRESO);
  });

  it('pasa a completada al terminar y guarda la hora real UTC del negocio', () => {
    const result = getAutomaticAppointmentStatus(appointment, new Date('2026-08-21T11:00:00Z'));
    expect(result.status).toBe(EstadoCita.COMPLETADA);
    expect(result.completedAt?.toISOString()).toBe('2026-08-21T17:00:00.000Z');
  });

  it('convierte la referencia UTC a la hora del negocio', () => {
    expect(getNowInBusinessTZ(new Date('2026-08-21T16:30:00Z')).toISOString())
      .toBe('2026-08-21T10:30:00.000Z');
  });

  it('registra correctamente el fin de una cita que cruza medianoche', () => {
    const result = getAutomaticAppointmentStatus({ ...appointment, hora: '23:30', duracion: 60 }, new Date('2026-08-22T00:30:00Z'));
    expect(result.completedAt?.toISOString()).toBe('2026-08-22T06:30:00.000Z');
  });
});
