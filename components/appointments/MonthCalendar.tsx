'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCalendarDate, getAppointmentDateString, parseCalendarDate } from '@/lib/calendar-date-utils';
import { getBusinessTodayString } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { monthDays } from './FloatingViewBar';
import { WEEK_LABELS } from './WeekStrip';
import type { CalendarAppointment } from './appointment-calendar-types';

export function MonthCalendar({ selectedDate, appointments, overview, onSelect, onShowDay, onOpen }: {
  selectedDate: string; appointments: CalendarAppointment[]; overview: boolean;
  onSelect: (date: string) => void; onShowDay: (date: string) => void; onOpen: (appointment: CalendarAppointment) => void;
}) {
  const date = parseCalendarDate(selectedDate);
  return <section className="agenda-month-view" aria-label={overview ? 'Calendario mensual' : 'Citas del mes'}>
    <div className="agenda-month-heading">
      <button type="button" aria-label="Mes anterior" onClick={() => onSelect(formatCalendarDate(new Date(date.getFullYear(), date.getMonth() - 1, 1)))}><ChevronLeft size={18} /></button>
      <h2>{date.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</h2>
      <button type="button" aria-label="Mes siguiente" onClick={() => onSelect(formatCalendarDate(new Date(date.getFullYear(), date.getMonth() + 1, 1)))}><ChevronRight size={18} /></button>
    </div>
    <div className={cn('agenda-month-grid', overview && 'is-overview')}>
      {WEEK_LABELS.map((label, index) => <span className="agenda-month-weekday" key={index}>{label}</span>)}
      {monthDays(selectedDate).map(day => {
        const value = formatCalendarDate(day);
        const bookings = appointments.filter(appointment => (appointment._overrideFecha || getAppointmentDateString(appointment.fecha)) === value).sort((a, b) => a.hora.localeCompare(b.hora));
        return <div className={cn('agenda-month-cell', day.getMonth() !== date.getMonth() && 'is-outside')} key={value}>
          <button type="button" className="agenda-month-date" aria-label={day.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={value === selectedDate} onClick={() => onSelect(value)}>
            <span className={cn('agenda-day-number', value === selectedDate && 'is-selected', value === getBusinessTodayString() && 'is-today')}>{day.getDate()}</span>
            {overview && bookings.length > 0 && <span className="text-[10px] text-primary">{bookings.length} cita{bookings.length !== 1 ? 's' : ''}</span>}
          </button>
          {!overview && bookings.slice(0, 3).map(appointment => <button type="button" className="agenda-month-booking" key={appointment.id} onClick={() => onOpen(appointment)}><time>{appointment.hora}</time> {appointment.cliente_nombre}</button>)}
          {!overview && bookings.length > 3 && <button type="button" className="text-xs text-primary" onClick={() => onShowDay(value)}>+{bookings.length - 3} más</button>}
        </div>;
      })}
    </div>
    {overview && <div className="agenda-date-bookings">
      <h3 className="mb-3 text-sm font-semibold">{date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      {appointments.filter(a => (a._overrideFecha || getAppointmentDateString(a.fecha)) === selectedDate).sort((a, b) => a.hora.localeCompare(b.hora)).map(a => <button type="button" key={a.id} className="flex w-full gap-4 border-b border-border/50 py-3 text-left text-sm" onClick={() => onOpen(a)}><time className="text-primary">{a.hora}</time><span>{a.cliente_nombre}<span className="block text-xs text-muted-foreground">{a.servicio?.nombre}</span></span></button>)}
      {!appointments.some(a => (a._overrideFecha || getAppointmentDateString(a.fecha)) === selectedDate) && <p className="text-sm text-muted-foreground">No hay citas para este día. Usa + para agendar.</p>}
    </div>}
  </section>;
}
