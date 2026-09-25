import { describe, expect, it } from 'vitest';
import { parseLocalDateToUTC } from '../../lib/timezone';

describe('fechas de calendario', () => {
  it('no convierte silenciosamente una fecha inexistente en otra cita', () => {
    expect(() => parseLocalDateToUTC('2026-02-30')).toThrow();
    expect(() => parseLocalDateToUTC('2026-13-01')).toThrow();
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(parseLocalDateToUTC('2028-02-29').toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});
