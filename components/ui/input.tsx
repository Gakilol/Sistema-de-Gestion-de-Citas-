import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-[10px] border border-input bg-[hsl(var(--control))] px-3 py-1 text-base text-foreground shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.025)] outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 md:text-sm',
        'hover:border-border focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/20',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
