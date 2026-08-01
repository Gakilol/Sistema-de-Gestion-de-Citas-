import { describe, expect, test } from 'vitest';
import {
  formatCalendarDate,
  getAppointmentDateString,
  parseCalendarDate,
} from '../../lib/calendar-date-utils';

describe('calendar date utilities', () => {
  test('round-trips a calendar date without a timezone shift', () => {
    expect(formatCalendarDate(parseCalendarDate('2026-08-01'))).toBe('2026-08-01');
  });

  test('reads Prisma date-only values in UTC', () => {
    expect(getAppointmentDateString('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
  });

  test('returns an empty string when the appointment has no date', () => {
    expect(getAppointmentDateString(null)).toBe('');
  });
});
