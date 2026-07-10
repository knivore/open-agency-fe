import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 focus:ring-offset-0',
  {
    variants: {
      variant: {
        default: 'border-(--agency-shell-border) bg-(--agency-active-bg) text-primary',
        secondary: 'border-(--agency-shell-border) bg-muted text-(--agency-shell-text)',
        destructive:
          'border-(--agency-danger-border) bg-(--agency-danger-bg) text-(--agency-danger-text)',
        outline:
          'border-(--agency-control-border) bg-(--agency-control-bg) text-(--agency-control-text)',
        successful:
          'border-(--agency-success-border) bg-(--agency-success-bg) text-(--agency-success-text)',
        failed:
          'border-(--agency-danger-border) bg-(--agency-danger-bg) text-(--agency-danger-text)',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
