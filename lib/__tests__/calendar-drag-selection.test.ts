// lib/__tests__/calendar-drag-selection.test.ts
// Pruebas unitarias para la lógica de selección de rango horario, gestos y traslapes del Calendario NovaCita

import {
  yToMinutes,
  minutesToY,
  minutesToTimeStr,
  timeStrToMinutes,
  formatTime12h,
  minutesToLabel,
  snapToStep,
  checkOverlap,
  HORA_INICIO,
  HORA_FIN,
  HOUR_HEIGHT,
} from '../calendar-drag-utils';
import { getBusinessTodayString } from '../timezone';

describe('Pruebas Unitarias - Motor de Selección de Rango Horario en Calendario', () => {

  describe('1. Cálculos de Y y Conversión a Minutos con Snap de 5 Minutos', () => {
    test('Snap de 5 minutos redondea valores intermedios correctamente', () => {
      expect(snapToStep(12, 5)).toBe(10);
      expect(snapToStep(13, 5)).toBe(15);
      expect(snapToStep(27, 5)).toBe(25);
      expect(snapToStep(28, 5)).toBe(30);
    });

    test('yToMinutes convierte posición en píxeles (top) a minutos exactos con snap de 5 minutos', () => {
      // HORA_INICIO = 7 AM (420 min). HOUR_HEIGHT = 80px.
      // y = 0px -> 7:00 AM (420 min)
      expect(yToMinutes(0, 5)).toBe(420);

      // y = 80px (1 hora) -> 8:00 AM (480 min)
      expect(yToMinutes(80, 5)).toBe(480);

      // y = 40px (30 min) -> 7:30 AM (450 min)
      expect(yToMinutes(40, 5)).toBe(450);

      // y = 33.3px (~25 min) -> snap a 7:25 AM (445 min)
      expect(yToMinutes(33.3, 5)).toBe(445);
    });

    test('minutesToY convierte minutos a coordenadas Y en la cuadrícula', () => {
      // 7:00 AM = 420 min -> 0px
      expect(minutesToY(420)).toBe(0);

      // 8:00 AM = 480 min -> 80px
      expect(minutesToY(480)).toBe(80);

      // 7:30 AM = 450 min -> 40px
      expect(minutesToY(450)).toBe(40);
    });

    test('minutesToTimeStr y timeStrToMinutes son conversiones inversas exactas', () => {
      const min = 14 * 60 + 25; // 14:25 (865 min)
      const timeStr = minutesToTimeStr(min);
      expect(timeStr).toBe('14:25');
      expect(timeStrToMinutes(timeStr)).toBe(min);
    });

    test('formatTime12h convierte 24h a 12h AM/PM amigables', () => {
      expect(formatTime12h('09:00')).toBe('9:00 AM');
      expect(formatTime12h('12:30')).toBe('12:30 PM');
      expect(formatTime12h('14:05')).toBe('2:05 PM');
      expect(formatTime12h('20:00')).toBe('8:00 PM');
    });

    test('minutesToLabel retorna la etiqueta 12h de minutos', () => {
      expect(minutesToLabel(570)).toBe('9:30 AM'); // 570 min = 9:30 AM
      expect(minutesToLabel(855)).toBe('2:15 PM'); // 855 min = 2:15 PM
    });
  });

  describe('2. Verificación y Detección de Traslapes (Citas Intercaladas)', () => {
    const citasEjemplo = [
      {
        id: 'cita-1',
        empleado_id: 'emp-101',
        hora: '10:00',
        duracion: 60, // 10:00 - 11:00 (600 a 660 min)
      },
      {
        id: 'cita-2',
        empleado_id: 'emp-101',
        hora: '14:00',
        duracion: 30, // 14:00 - 14:30 (840 a 870 min)
      },
    ];

    test('Detecta traslape completo o parcial en la misma columna de estilista', () => {
      // 10:30 a 11:30 se solapa con cita-1 (10:00 - 11:00)
      const overlap1 = checkOverlap(citasEjemplo, 'emp-101', 630, 690);
      expect(overlap1).toBe(true);

      // 09:30 a 10:15 se solapa con cita-1
      const overlap2 = checkOverlap(citasEjemplo, 'emp-101', 570, 615);
      expect(overlap2).toBe(true);

      // 14:00 a 14:30 coincide exacto con cita-2
      const overlap3 = checkOverlap(citasEjemplo, 'emp-101', 840, 870);
      expect(overlap3).toBe(true);
    });

    test('No reporta traslape cuando los rangos están libres o son contiguos', () => {
      // 09:00 a 10:00 (justo termina cuando empieza cita-1)
      const free1 = checkOverlap(citasEjemplo, 'emp-101', 540, 600);
      expect(free1).toBe(false);

      // 11:00 a 12:00 (justo empieza cuando termina cita-1)
      const free2 = checkOverlap(citasEjemplo, 'emp-101', 660, 720);
      expect(free2).toBe(false);

      // Rango para otro estilista (emp-102) no debe colisionar
      const free3 = checkOverlap(citasEjemplo, 'emp-102', 600, 660);
      expect(free3).toBe(false);
    });
  });

  describe('3. Zona Horaria y Fechas Seguras (America/Costa_Rica)', () => {
    test('getBusinessTodayString retorna la fecha actual en formato YYYY-MM-DD', () => {
      const todayStr = getBusinessTodayString();
      expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
