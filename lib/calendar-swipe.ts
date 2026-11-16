export interface CalendarSwipeStart {
  x: number;
  y: number;
  scrollLeft: number;
  maxScrollLeft: number;
}

/** Leave horizontal scrolling to the browser until a gesture starts at an edge. */
export function getCalendarSwipeOffset(
  start: CalendarSwipeStart,
  x: number,
  y: number,
  daysInView: number,
  minDistance = 52,
): number {
  const dx = x - start.x;
  const dy = y - start.y;
  if (Math.abs(dx) < minDistance || Math.abs(dx) <= Math.abs(dy) * 1.35) return 0;

  const direction = dx < 0 ? 1 : -1;
  const edgeTolerance = 2;
  if (start.maxScrollLeft <= edgeTolerance) return direction * daysInView;

  const atEdge = direction < 0
    ? start.scrollLeft <= edgeTolerance
    : start.scrollLeft >= start.maxScrollLeft - edgeTolerance;

  // Slide the visible range by one day, including across week/month/year boundaries.
  return atEdge ? direction : 0;
}
