'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/library/shadcn/input';
import { cn } from '@/lib/utils';

/** Shared search geometry; filtering stays owned by each workspace. */
export default function WorkspaceSearch({
  label,
  placeholder = label,
  value,
  onChange,
  className,
  disabled = false,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}
