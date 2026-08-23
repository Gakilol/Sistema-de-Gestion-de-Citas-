'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/appointments/appointment-status';
import {
  APPOINTMENT_STATUS_OPTIONS,
  type AppointmentSmartFilter,
  type AppointmentHistoryPeriod,
} from '@/app/citas/appointment-page-utils';
import type { CalendarEmployee } from './appointment-calendar-types';

interface AppointmentListFiltersProps {
  smartFilter: AppointmentSmartFilter;
  historyPeriod: AppointmentHistoryPeriod;
  search: string;
  status: string;
  employeeId: string;
  employees: CalendarEmployee[];
  showEmployeeFilter: boolean;
  onSmartFilterChange: (filter: AppointmentSmartFilter) => void;
  onHistoryPeriodChange: (period: AppointmentHistoryPeriod) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
}

const smartFilters: Array<{ id: AppointmentSmartFilter; label: string }> = [
  { id: 'activas', label: 'Activas' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'manana', label: 'Mañana' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'historial', label: 'Historial' },
  { id: 'todas', label: 'Todas' },
];

const historyPeriods: Array<{ id: AppointmentHistoryPeriod; label: string }> = [
  { id: 'todos', label: 'Todo el historial' },
  { id: 'diario', label: 'Hoy' },
  { id: 'semanal', label: 'Semana' },
  { id: 'quincenal', label: '15 días' },
  { id: 'mensual', label: 'Mes' },
];

export function AppointmentListFilters({
  smartFilter,
  historyPeriod,
  search,
  status,
  employeeId,
  employees,
  showEmployeeFilter,
  onSmartFilterChange,
  onHistoryPeriodChange,
  onSearchChange,
  onStatusChange,
  onEmployeeChange,
}: AppointmentListFiltersProps) {
  return (
    <section className="surface-panel overflow-hidden" aria-label="Filtros de citas">
      <div className="border-b border-border/60 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {smartFilters.map((filter) => {
            const active = smartFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSmartFilterChange(filter.id)}
                className={cn(
                  'relative min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary/11 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                )}
              >
                {filter.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-px bg-primary" />}
              </button>
            );
          })}
        </div>

        {smartFilter === 'historial' && (
          <div className="mt-2 flex gap-1 overflow-x-auto border-t border-border/50 pt-2 no-scrollbar">
            {historyPeriods.map((period) => (
              <button
                key={period.id}
                type="button"
                aria-pressed={historyPeriod === period.id}
                onClick={() => onHistoryPeriodChange(period.id)}
                className={cn(
                  'min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-medium transition-colors',
                  historyPeriod === period.id
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden gap-3 bg-secondary/15 p-3 sm:grid sm:grid-cols-[minmax(16rem,1fr)_auto] lg:grid-cols-[minmax(18rem,1fr)_auto_auto] sm:p-4">
        <label className="relative block">
          <span className="sr-only">Buscar citas</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar cliente o servicio"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="bg-background pl-10"
          />
        </label>

        <label>
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="min-h-10 min-w-[10.5rem] rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            {APPOINTMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{APPOINTMENT_STATUS_LABELS[option]}</option>
            ))}
          </select>
        </label>

        {showEmployeeFilter && (
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Filtrar por estilista</span>
            <select
              value={employeeId}
              onChange={(event) => onEmployeeChange(event.target.value)}
              className="min-h-10 w-full min-w-[11rem] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todo el equipo</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.nombre}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
