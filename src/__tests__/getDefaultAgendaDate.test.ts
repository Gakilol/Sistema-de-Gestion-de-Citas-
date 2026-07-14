/**
 * src/__tests__/getDefaultAgendaDate.test.ts
 *
 * Suite de pruebas para getDefaultAgendaDate().
 * Usa tiempo simulado via el parametro `now` - sin cambiar el reloj del sistema.
 *
 * Ejecutar:
 *   npx ts-node --esm --project tsconfig.json src/__tests__/getDefaultAgendaDate.test.ts
 */

import { getDefaultAgendaDate } from '../../lib/timezone';

// --- Utilidades de test ---------------------------------------------------

/**
 * Construye un Date expresado en hora de Costa Rica (UTC-6, sin DST).
 */
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
  // Limites de 18:30
  { id:  1, description: '6:29:59 p.m. CR -> hoy',
    now: crDate(2025, 7, 15, 18, 29, 59), expected: '2025-07-15' },
  { id:  2, description: '6:30:00 p.m. CR -> manana (exacto)',
    now: crDate(2025, 7, 15, 18, 30, 0),  expected: '2025-07-16' },
  { id:  3, description: '6:30:01 p.m. CR -> manana',
    now: crDate(2025, 7, 15, 18, 30, 1),  expected: '2025-07-16' },
  { id:  4, description: '8:00 a.m. CR -> hoy',
    now: crDate(2025, 7, 15,  8,  0, 0),  expected: '2025-07-15' },
  { id:  5, description: '11:59 p.m. CR -> manana',
    now: crDate(2025, 7, 15, 23, 59, 0),  expected: '2025-07-16' },
  // Cambios de dia de la semana
  { id:  6, description: 'Lunes 18:31 CR -> martes',
    now: crDate(2025, 7, 14, 18, 31, 0),  expected: '2025-07-15' },
  { id:  7, description: 'Sabado 20:00 CR -> domingo',
    now: crDate(2025, 7, 19, 20,  0, 0),  expected: '2025-07-20' },
  // Fin de mes
  { id:  8, description: '30 abr 18:30 -> 1 may',
    now: crDate(2025, 4, 30, 18, 30, 0),  expected: '2025-05-01' },
  { id:  9, description: '31 ene 18:30 -> 1 feb',
    now: crDate(2025, 1, 31, 18, 30, 0),  expected: '2025-02-01' },
  // Febrero
  { id: 10, description: '28 feb (no bisiesto) 18:30 -> 1 mar',
    now: crDate(2025, 2, 28, 18, 30, 0),  expected: '2025-03-01' },
  { id: 11, description: '29 feb (bisiesto 2024) 18:30 -> 1 mar',
    now: crDate(2024, 2, 29, 18, 30, 0),  expected: '2024-03-01' },
  // Fin de anio
  { id: 12, description: '31 dic 18:30 -> 1 ene siguiente anio',
    now: crDate(2025, 12, 31, 18, 30, 0), expected: '2026-01-01' },
  // Zona horaria foranea
  { id: 13, description: 'Usuario en UTC+0: 18:30 CR -> manana',
    now: crDate(2025, 7, 15, 18, 30, 0),  expected: '2025-07-16' },
  { id: 14, description: 'Servidor UTC: 00:30 UTC = 18:30 CR -> manana',
    now: new Date(Date.UTC(2025, 6, 16, 0, 30, 0)), expected: '2025-07-16' },
  // Comportamiento de navegacion
  { id: 15, description: '19:00 CR -> manana (bot. Hoy es independiente)',
    now: crDate(2025, 7, 15, 19,  0, 0),  expected: '2025-07-16' },
  { id: 16, description: '10:00 CR -> hoy (antes del umbral)',
    now: crDate(2025, 1, 15, 10,  0, 0),  expected: '2025-01-15' },
  { id: 17, description: '18:00 CR -> hoy (edicion abierta antes de 18:30)',
    now: crDate(2025, 7, 15, 18,  0, 0),  expected: '2025-07-15' },
  // Roles (misma funcion, mismo resultado)
  { id: 18, description: 'Admin: 18:30 CR -> manana',
    now: crDate(2025, 7, 15, 18, 30, 0),  expected: '2025-07-16' },
  { id: 19, description: 'Soporte Tecnico: 18:30 CR -> manana',
    now: crDate(2025, 7, 15, 18, 30, 0),  expected: '2025-07-16' },
  { id: 20, description: 'Empleado: 18:30 CR -> manana',
    now: crDate(2025, 7, 15, 18, 30, 0),  expected: '2025-07-16' },
  // Vistas de varios dias
  { id: 21, description: 'Vista semana/3dias: 20:00 CR -> fecha base = manana',
    now: crDate(2025, 7, 15, 20,  0, 0),  expected: '2025-07-16' },
];

// --- Runner -----------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

console.log('\n====================================================');
console.log('  getDefaultAgendaDate() - Suite de 21 pruebas');
console.log('====================================================\n');

for (const tc of cases) {
  const result = getDefaultAgendaDate(tc.now);
  const ok = result === tc.expected;
  if (ok) {
    passed++;
    console.log(`  OK [${String(tc.id).padStart(2,'0')}] ${tc.description}`);
  } else {
    failed++;
    const msg = `  FAIL [${String(tc.id).padStart(2,'0')}] ${tc.description}\n        Esperado: ${tc.expected}\n        Obtenido: ${result}`;
    failures.push(msg);
    console.log(msg);
  }
}

console.log('\n====================================================');
console.log(`  Resultado: ${passed} pasaron, ${failed} fallaron de ${cases.length} total`);
console.log('====================================================\n');

if (failed > 0) {
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log('Todos los tests pasaron correctamente.\n');
  process.exit(0);
}
