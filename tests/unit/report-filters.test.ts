import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { parseReportFilters } from '../../lib/reportes-utils';

describe('fechas de reportes', () => {
  it('incluye exactamente el día solicitado sin depender de la zona del servidor', () => {
    const result = parseReportFilters(new NextRequest('http://localhost/api/reportes?from=2026-09-25&to=2026-09-25&compare=true'));
    expect('filters' in result).toBe(true);
    if (!('filters' in result)) return;
    expect(result.filters.from.toISOString()).toBe('2026-09-25T00:00:00.000Z');
    expect(result.filters.to.toISOString()).toBe('2026-09-25T23:59:59.999Z');
    expect(result.filters.fromPrev.toISOString()).toBe('2026-09-24T00:00:00.000Z');
    expect(result.filters.toPrev.toISOString()).toBe('2026-09-24T23:59:59.999Z');
  });

  it('rechaza fechas inexistentes en vez de moverlas a otro mes', () => {
    const result = parseReportFilters(new NextRequest('http://localhost/api/reportes?from=2026-02-30&to=2026-03-01'));
    expect('error' in result).toBe(true);
  });
});
