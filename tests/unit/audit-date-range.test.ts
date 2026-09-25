import { describe, expect, it } from 'vitest';
import { getBusinessDayStartUTC } from '../../lib/timezone';
import { parseAuditDateRange } from '../../lib/audit/audit-date-range';

describe('filtros de auditoría en la fecha del negocio', () => {
  it('incluye todo el viernes en Costa Rica y excluye el sábado', () => {
    const range = parseAuditDateRange('2026-09-25', '2026-09-25');
    if ('error' in range) throw new Error(range.error);
    expect(range.start.toISOString()).toBe('2026-09-25T06:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-09-26T06:00:00.000Z');
  });

  it('rechaza una fecha de calendario inexistente', () => {
    expect(parseAuditDateRange('2026-02-30', '2026-03-01')).toHaveProperty('error');
  });

  it('calcula la medianoche del negocio también al cambiar de año', () => {
    expect(getBusinessDayStartUTC('2027-01-01').toISOString()).toBe('2027-01-01T06:00:00.000Z');
  });
});
