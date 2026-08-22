'use client';

import { CalendarDays, List, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppointmentWorkspaceView = 'lista' | 'agenda';
export type AppointmentWorkspaceScope = 'mine' | 'all';

interface AppointmentWorkspaceToolbarProps {
  view: AppointmentWorkspaceView;
  scope: AppointmentWorkspaceScope;
  canSeeAll: boolean;
  compact?: boolean;
  onViewChange: (view: AppointmentWorkspaceView) => void;
  onScopeChange: (scope: AppointmentWorkspaceScope) => void;
}

const viewOptions = [
  { id: 'agenda' as const, label: 'Agenda', icon: CalendarDays },
  { id: 'lista' as const, label: 'Lista', icon: List },
];

const scopeOptions = [
  { id: 'mine' as const, label: 'Mi agenda', icon: UserRound },
  { id: 'all' as const, label: 'Equipo', icon: Users },
];

export function AppointmentWorkspaceToolbar({
  view,
  scope,
  canSeeAll,
  compact = false,
  onViewChange,
  onScopeChange,
}: AppointmentWorkspaceToolbarProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-xl border border-border/70 bg-[hsl(var(--control))] p-1',
        compact ? 'w-full justify-between' : 'w-full sm:w-auto'
      )}
      aria-label="Controles de la agenda"
    >
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:flex-none">
        {viewOptions.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(id)}
              className={cn(
                'relative flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:min-h-8',
                active
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/70'
                  : 'text-muted-foreground hover:bg-card/55 hover:text-foreground'
              )}
            >
              {active && <span className="absolute inset-x-3 -bottom-1 h-px bg-primary" />}
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {canSeeAll && (
        <>
          <span className="mx-0.5 h-5 w-px shrink-0 bg-border/80" aria-hidden="true" />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:flex-none">
            {scopeOptions.map(({ id, label, icon: Icon }) => {
              const active = scope === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onScopeChange(id)}
                  className={cn(
                    'flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors sm:min-h-8 sm:text-xs',
                    active
                      ? 'bg-primary/12 text-primary ring-1 ring-primary/25'
                      : 'text-muted-foreground hover:bg-card/55 hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
