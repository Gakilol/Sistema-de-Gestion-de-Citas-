'use client';

import { useState } from 'react';
import { Calendar, CalendarDays, CalendarRange, Columns3, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-date-utils';
import { getBusinessTodayString } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { WEEK_LABELS } from './WeekStrip';

export type CalendarView = 'dia' | '3dias' | 'semana' | 'mes' | 'calendario';
const VIEWS = [
  { id: 'dia', label: 'Día', icon: Calendar },
  { id: '3dias', label: '3 Días', icon: Columns3 },
  { id: 'semana', label: 'Semana', icon: CalendarRange },
  { id: 'mes', label: 'Mes', icon: CalendarDays },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
] as const;

export function monthDays(dateString: string) {
  const date = parseCalendarDate(dateString);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index - offset + 1));
}

export function FloatingViewBar({ view, selectedDate, onViewChange, onDaySelect, onCreate, disabled, onZoomIn, onZoomOut }: {
  view: CalendarView; selectedDate: string; onViewChange: (view: CalendarView) => void;
  onDaySelect: (date: string) => void; onCreate?: () => void; disabled?: boolean;
  onZoomIn: () => void; onZoomOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(selectedDate);
  const monthDate = parseCalendarDate(month);
  const moveMonth = (offset: number) => setMonth(formatCalendarDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1)));
  const selectDay = (date: string) => { onDaySelect(date); setOpen(false); };
  return <Drawer open={open} onOpenChange={(value) => { if (value) setMonth(selectedDate); setOpen(value); }}>
    <div className="agenda-floating-bar">
      <DrawerTrigger className="agenda-floating-trigger" aria-label={`Cambiar vista: ${VIEWS.find(v => v.id === view)?.label}`}>
        <CalendarDays size={20} /><span>{VIEWS.find(v => v.id === view)?.label}</span>
      </DrawerTrigger>
      <Button type="button" className="agenda-create-button" aria-label="Nueva cita" onClick={onCreate} disabled={disabled || !onCreate}><Plus size={24} /></Button>
    </div>
    <DrawerContent className="agenda-view-sheet">
      <DrawerTitle className="sr-only">Vista y fecha de la agenda</DrawerTitle>
      <DrawerDescription className="sr-only">Elige una vista o una fecha para navegar por tus citas.</DrawerDescription>
      <DrawerClose className="agenda-sheet-close" aria-label="Cerrar selector de vista"><X size={18} /></DrawerClose>
      <div className="agenda-sheet-views" role="group" aria-label="Vista del calendario">
        {VIEWS.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={view === id} onClick={() => { onViewChange(id); setOpen(false); }}><Icon size={20} /><span>{label}</span></button>)}
      </div>
      <div className="agenda-mini-calendar" data-vaul-no-drag>
        <div className="agenda-month-heading">
          <button type="button" aria-label="Mes anterior" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
          <span aria-live="polite">{monthDate.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
        </div>
        <div className="agenda-mini-grid">
          {WEEK_LABELS.map((label, index) => <span className="text-muted-foreground" key={index}>{label}</span>)}
          {monthDays(month).map(date => {
            const value = formatCalendarDate(date);
            return <button type="button" key={value} data-date={value} aria-label={date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={value === selectedDate} aria-current={value === getBusinessTodayString() ? 'date' : undefined}
              className={cn(date.getMonth() !== monthDate.getMonth() && 'text-muted-foreground/50')} onClick={() => selectDay(value)}><span className={cn('agenda-day-number', value === getBusinessTodayString() && 'is-today', value === selectedDate && 'is-selected')}>{date.getDate()}</span></button>;
          })}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/50 px-4 py-1 text-xs">
        <button type="button" className="min-h-11 text-primary" onClick={() => selectDay(getBusinessTodayString())}>Hoy</button>
        <div className="flex items-center gap-3"><span className="text-muted-foreground">Escala horaria</span><button type="button" className="size-11" aria-label="Reducir escala horaria" onClick={onZoomOut}>−</button><button type="button" className="size-11" aria-label="Aumentar escala horaria" onClick={onZoomIn}>+</button></div>
      </div>
      <div className="px-4 pb-4"><Button type="button" className="w-full gap-2" disabled={disabled || !onCreate} onClick={() => { setOpen(false); onCreate?.(); }}><Plus size={18} />Nueva cita</Button></div>
    </DrawerContent>
  </Drawer>;
}
