import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          type === 'hidden'
            ? 'hidden'
            : type === 'checkbox' || type === 'radio'
              ? 'size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70'
              : 'flex h-10 w-full rounded-(--agency-radius-control) border border-input bg-(--agency-input-bg) px-3 py-2 text-sm text-foreground ring-offset-background transition-colors duration-(--agency-motion-fast) file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-primary/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 selection:bg-primary selection:text-primary-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          className
        )}
        style={{ boxShadow: 'var(--agency-input-shadow)' }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
