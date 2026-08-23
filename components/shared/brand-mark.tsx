import { Scissors } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Scissors className="size-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-black leading-none tracking-[-0.04em]">{BRAND.productName}</p>
        <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {BRAND.descriptor}
        </p>
      </div>
    </div>
  );
}
