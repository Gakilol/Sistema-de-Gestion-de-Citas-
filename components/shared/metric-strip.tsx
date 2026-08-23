import type { ElementType } from 'react';
import { cn } from '@/lib/utils';

type MetricTone = 'copper' | 'success' | 'info' | 'danger' | 'neutral';

export interface MetricStripItem {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ElementType;
  tone?: MetricTone;
}

interface MetricStripProps {
  items: MetricStripItem[];
  className?: string;
}

const toneClasses: Record<MetricTone, string> = {
  copper: 'bg-primary/10 text-primary',
  success: 'bg-[hsl(var(--success)/0.11)] text-[hsl(var(--success))]',
  info: 'bg-[hsl(var(--info)/0.11)] text-[hsl(var(--info))]',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-secondary text-muted-foreground',
};

export function MetricStrip({ items, className }: MetricStripProps) {
  return (
    <dl
      className={cn(
        'surface-panel grid overflow-hidden',
        items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {items.map(({ label, value, detail, icon: Icon, tone = 'neutral' }, index) => (
        <div
          key={label}
          className={cn(
            'relative min-w-0 p-3.5 sm:p-5',
            index > 0 && 'border-l border-border/60',
            items.length === 4 && index === 2 && 'border-l-0 border-t border-border/60 lg:border-l lg:border-t-0',
            items.length === 4 && index === 3 && 'border-t border-border/60 lg:border-t-0'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <dt className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground sm:text-[1.75rem]">{value}</dd>
            </div>
            {Icon && (
              <span className={cn('hidden rounded-lg p-2 sm:inline-flex', toneClasses[tone])} aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
            )}
          </div>
          {detail && <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">{detail}</p>}
          {index === 0 && <span className="absolute inset-x-4 bottom-0 h-px bg-primary/70" aria-hidden="true" />}
        </div>
      ))}
    </dl>
  );
}
