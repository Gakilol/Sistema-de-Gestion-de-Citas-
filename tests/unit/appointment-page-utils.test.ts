import { describe, expect, test } from 'vitest';
import {
  createEmptyAppointmentForm,
  sortAppointmentsByDate,
} from '../../app/citas/appointment-page-utils';

describe('appointment page utilities', () => {
  test('creates independent appointment forms', () => {
    const firstForm = createEmptyAppointmentForm();
    const secondForm = createEmptyAppointmentForm();
    firstForm.servicio_ids.push('service-id');
    expect(secondForm.servicio_ids).toEqual([]);
  });

  test('sorts appointments by date and time in either direction', () => {
    const appointments = [
      { id: 'later', fecha: '2026-08-02', hora: '09:00' },
      { id: 'earlier', fecha: '2026-08-01', hora: '14:00' },
    ];

    expect(sortAppointmentsByDate(appointments, true).map(({ id }) => id)).toEqual(['earlier', 'later']);
    expect(sortAppointmentsByDate(appointments, false).map(({ id }) => id)).toEqual(['later', 'earlier']);
  });
});
