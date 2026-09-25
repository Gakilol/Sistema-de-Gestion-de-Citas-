import { describe, expect, it } from 'vitest';
import { isValidBlockInput, isValidBreakInput, isValidTimeOffInput } from '../../lib/appointments/schedule-input';

describe('configuración de disponibilidad', () => {
  it('rechaza fechas inexistentes y vacaciones con final anterior al inicio', () => {
    expect(isValidTimeOffInput([{ fecha_inicio: '2026-02-30', fecha_fin: '2026-03-02' }])).toBe(false);
    expect(isValidTimeOffInput([{ fecha_inicio: '2026-09-26', fecha_fin: '2026-09-25' }])).toBe(false);
    expect(isValidTimeOffInput([{ fecha_inicio: '2026-09-25', fecha_fin: '2026-09-26', estado: 'APROBADO' }])).toBe(true);
  });

  it('evita intervalos invertidos o mal formados que dejarían la agenda abierta', () => {
    expect(isValidBlockInput([{ fecha: '2026-09-25', hora_inicio: '14:00', hora_fin: '13:00' }])).toBe(false);
    expect(isValidBreakInput([{ dia_semana: 8, hora_inicio: '13:00', hora_fin: '14:00' }])).toBe(false);
    expect(isValidBreakInput([{ dia_semana: 5, hora_inicio: '13:00', hora_fin: '14:00' }])).toBe(true);
  });
});
