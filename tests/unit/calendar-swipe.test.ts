import { describe, expect, it } from 'vitest';
import { getCalendarSwipeOffset, type CalendarSwipeStart } from '@/lib/calendar-swipe';

const start: CalendarSwipeStart = { x: 150, y: 400, scrollLeft: 0, maxScrollLeft: 1800 };

describe('navegación táctil del calendario', () => {
  it('desde el primer día retrocede un día, sin saltar a la semana anterior', () => {
    expect(getCalendarSwipeOffset(start, 300, 400, 7)).toBe(-1);
  });

  it('deja recorrer las columnas disponibles sin cambiar de fecha', () => {
    expect(getCalendarSwipeOffset(start, 0, 400, 7)).toBe(0);
    expect(getCalendarSwipeOffset({ ...start, scrollLeft: 900 }, 300, 400, 7)).toBe(0);
    expect(getCalendarSwipeOffset({ ...start, scrollLeft: 900 }, 0, 400, 7)).toBe(0);
  });

  it('desde el último día avanza un día y permite volver hacia las columnas anteriores', () => {
    const end = { ...start, scrollLeft: start.maxScrollLeft };
    expect(getCalendarSwipeOffset(end, 0, 400, 7)).toBe(1);
    expect(getCalendarSwipeOffset(end, 300, 400, 7)).toBe(0);
  });

  it('tolera posiciones fraccionarias y el rebote de Safari en los extremos', () => {
    expect(getCalendarSwipeOffset({ ...start, scrollLeft: -12 }, 300, 400, 7)).toBe(-1);
    expect(getCalendarSwipeOffset({ ...start, scrollLeft: 1799.5 }, 0, 400, 7)).toBe(1);
    expect(getCalendarSwipeOffset({ ...start, scrollLeft: 1812 }, 0, 400, 7)).toBe(1);
  });

  it.each([1, 3, 7])('sin desbordamiento mantiene la navegación de %i días', days => {
    const fitted = { ...start, maxScrollLeft: 0 };
    expect(getCalendarSwipeOffset(fitted, 0, 400, days)).toBe(days);
    expect(getCalendarSwipeOffset(fitted, 300, 400, days)).toBe(-days);
  });

  it('ignora toques, gestos cortos y desplazamiento vertical o diagonal', () => {
    expect(getCalendarSwipeOffset(start, 150, 400, 7)).toBe(0);
    expect(getCalendarSwipeOffset(start, 180, 400, 7)).toBe(0);
    expect(getCalendarSwipeOffset(start, 170, 550, 7)).toBe(0);
    expect(getCalendarSwipeOffset(start, 250, 500, 7)).toBe(0);
  });
});
