'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-date-utils';
import { getBusinessTodayString } from '@/lib/timezone';
import { cn } from '@/lib/utils';

export const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function WeekStrip({ selectedDate, onDaySelect }: { selectedDate: string; onDaySelect: (date: string) => void }) {
  const start = parseCalendarDate(selectedDate);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const navigate = (offset: number) => {
    const date = parseCalendarDate(selectedDate);
    date.setDate(date.getDate() + offset);
    onDaySelect(formatCalendarDate(date));
  };
  return (
    <div className="agenda-week-strip" aria-label="Semana de selección rápida"
      onTouchStart={(event) => { const t = event.touches[0]; touchStart.current = event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }}
      onTouchCancel={() => { touchStart.current = null; }}
      onTouchEnd={(event) => {
        const t = event.changedTouches[0]; const origin = touchStart.current; touchStart.current = null;
        if (origin && t && Math.abs(t.clientX - origin.x) >= 50 && Math.abs(t.clientX - origin.x) > Math.abs(t.clientY - origin.y) * 1.35) navigate(t.clientX < origin.x ? 7 : -7);
      }}>
      <button type="button" aria-label="Semana anterior" onClick={() => navigate(-7)}><ChevronLeft size={18} /></button>
      {WEEK_LABELS.map((label, index) => {
        const date = new Date(start); date.setDate(start.getDate() + index);
        const value = formatCalendarDate(date);
        const today = value === getBusinessTodayString();
        return <button key={value} type="button" className="agenda-week-day" aria-label={date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          aria-pressed={value === selectedDate} aria-current={today ? 'date' : undefined} data-date={value} onClick={() => onDaySelect(value)}>
          <span>{label}</span><span className={cn('agenda-day-number', today && 'is-today', value === selectedDate && 'is-selected')}>{date.getDate()}</span>
        </button>;
      })}
      <button type="button" aria-label="Semana siguiente" onClick={() => navigate(7)}><ChevronRight size={18} /></button>
    </div>
  );
}
