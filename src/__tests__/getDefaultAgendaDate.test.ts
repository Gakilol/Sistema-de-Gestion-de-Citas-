import { describe, test, expect } from 'vitest';
import { getDefaultAgendaDate } from '../../lib/timezone';

function crDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second));
}

interface TestCase {
  id: number;
  description: string;
  now: Date;
  expected: string;
}

const cases: TestCase[] = [
  { id: 1, description: '6:29:59 p.m. CR -> hoy', now: crDate(2025, 7, 15, 18, 29, 59), expected: '2025-07-15' },
  { id: 2, description: '6:30:00 p.m. CR -> manana (exacto)', now: crDate(2025, 7, 15, 18, 30, 0), expected: '2025-07-16' },
  { id: 3, description: '6:30:01 p.m. CR -> manana', now: crDate(2025, 7, 15, 18, 30, 1), expected: '2025-07-16' },
  { id: 4, description: '8:00 a.m. CR -> hoy', now: crDate(2025, 7, 15, 8, 0, 0), expected: '2025-07-15' },
  { id: 5, description: '11:59 p.m. CR -> manana', now: crDate(2025, 7, 15, 23, 59, 0), expected: '2025-07-16' },
  { id: 6, description: 'Lunes 18:31 CR -> martes', now: crDate(2025, 7, 14, 18, 31, 0), expected: '2025-07-15' },
  { id: 7, description: 'Sabado 20:00 CR -> domingo', now: crDate(2025, 7, 19, 20, 0, 0), expected: '2025-07-20' },
  { id: 8, description: '30 abr 18:30 -> 1 may', now: crDate(2025, 4, 30, 18, 30, 0), expected: '2025-05-01' },
  { id: 9, description: '31 ene 18:30 -> 1 feb', now: crDate(2025, 1, 31, 18, 30, 0), expected: '2025-02-01' },
  { id: 10, description: '28 feb (no bisiesto) 18:30 -> 1 mar', now: crDate(2025, 2, 28, 18, 30, 0), expected: '2025-03-01' },
  { id: 11, description: '29 feb (bisiesto 2024) 18:30 -> 1 mar', now: crDate(2024, 2, 29, 18, 30, 0), expected: '2024-03-01' },
  { id: 12, description: '31 dic 18:30 -> 1 ene siguiente anio', now: crDate(2025, 12, 31, 18, 30, 0), expected: '2026-01-01' },
  { id: 13, description: 'Usuario en UTC+0: 18:30 CR -> manana', now: crDate(2025, 7, 15, 18, 30, 0), expected: '2025-07-16' },
  { id: 14, description: 'Servidor UTC: 00:30 UTC = 18:30 CR -> manana', now: new Date(Date.UTC(2025, 6, 16, 0, 30, 0)), expected: '2025-07-16' },
  { id: 15, description: '19:00 CR -> manana (bot. Hoy es independiente)', now: crDate(2025, 7, 15, 19, 0, 0), expected: '2025-07-16' },
  { id: 16, description: '10:00 CR -> hoy (antes del umbral)', now: crDate(2025, 1, 15, 10, 0, 0), expected: '2025-01-15' },
  { id: 17, description: '18:00 CR -> hoy (edicion abierta antes de 18:30)', now: crDate(2025, 7, 15, 18, 0, 0), expected: '2025-07-15' },
  { id: 18, description: 'Admin: 18:30 CR -> manana', now: crDate(2025, 7, 15, 18, 30, 0), expected: '2025-07-16' },
  { id: 19, description: 'Soporte Tecnico: 18:30 CR -> manana', now: crDate(2025, 7, 15, 18, 30, 0), expected: '2025-07-16' },
  { id: 20, description: 'Empleado: 18:30 CR -> manana', now: crDate(2025, 7, 15, 18, 30, 0), expected: '2025-07-16' },
  { id: 21, description: 'Vista semana/3dias: 20:00 CR -> fecha base = manana', now: crDate(2025, 7, 15, 20, 0, 0), expected: '2025-07-16' },
];

describe('getDefaultAgendaDate() - Suite de 21 pruebas', () => {
  cases.forEach((tc) => {
    test(`[${String(tc.id).padStart(2, '0')}] ${tc.description}`, () => {
      expect(getDefaultAgendaDate(tc.now)).toBe(tc.expected);
    });
  });
});
