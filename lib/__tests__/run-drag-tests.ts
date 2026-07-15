// lib/__tests__/run-drag-tests.ts
import {
  yToMinutes,
  minutesToY,
  minutesToTimeStr,
  timeStrToMinutes,
  formatTime12h,
  minutesToLabel,
  snapToStep,
  checkOverlap,
} from '../calendar-drag-utils';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ OK: ${msg}`);
  }
}

console.log("=== PRUEBAS UNITARIAS DE SELECCIÓN DE RANGO HORARIO EN CALENDARIO ===");

// 1. Snap a 5 minutos
assert(snapToStep(12, 5) === 10, "snapToStep(12, 5) -> 10");
assert(snapToStep(13, 5) === 15, "snapToStep(13, 5) -> 15");
assert(snapToStep(27, 5) === 25, "snapToStep(27, 5) -> 25");

// 2. yToMinutes y minutesToY
assert(yToMinutes(0, 5) === 420, "yToMinutes(0, 5) -> 420 (7:00 AM)");
assert(yToMinutes(80, 5) === 480, "yToMinutes(80, 5) -> 480 (8:00 AM)");
assert(yToMinutes(40, 5) === 450, "yToMinutes(40, 5) -> 450 (7:30 AM)");
assert(minutesToY(420) === 0, "minutesToY(420) -> 0px");
assert(minutesToY(480) === 80, "minutesToY(480) -> 80px");

// 3. Formateo de tiempo 12h
assert(formatTime12h('09:00') === '9:00 AM', "formatTime12h('09:00') -> 9:00 AM");
assert(formatTime12h('14:35') === '2:35 PM', "formatTime12h('14:35') -> 2:35 PM");
assert(minutesToLabel(570) === '9:30 AM', "minutesToLabel(570) -> 9:30 AM");

// 4. Detección de Traslapes (Intercaladas)
const citasEjemplo = [
  { id: 'c1', empleado_id: 'emp1', hora: '10:00', duracion: 60 }, // 10:00 - 11:00 (600 - 660)
];

assert(checkOverlap(citasEjemplo, 'emp1', 630, 690) === true, "Reporta traslape entre 10:30 y 11:30");
assert(checkOverlap(citasEjemplo, 'emp1', 540, 600) === false, "Sin traslape entre 9:00 y 10:00");
assert(checkOverlap(citasEjemplo, 'emp2', 630, 690) === false, "Sin traslape para otro estilista");

console.log("\nALL TESTS PASSED SUCCESSFULLY! 🚀");
