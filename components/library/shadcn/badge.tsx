import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 focus:ring-offset-0',
  {
    variants: {
      variant: {
        default:
          'border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100',
        secondary:
          'border-secondary-200 bg-secondary-50 text-secondary-800 hover:bg-secondary-100',
        destructive:
          'border-destructive-200 bg-destructive-50 text-destructive-800 hover:bg-destructive-100',
        outline: 'border-input bg-white text-foreground',
        successful: 'border-success-200 bg-success-50 text-success-800',
        failed: 'border-destructive-200 bg-destructive-50 text-destructive-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
