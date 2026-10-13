'use client';

import { cn } from '@/lib/utils';

function lineClassName(line: string) {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'text-sky-500';
  }
  if (line.startsWith('+')) {
    return 'bg-(--agency-success-bg) text-(--agency-success-text)';
  }
  if (line.startsWith('-')) {
    return 'bg-(--agency-danger-bg) text-(--agency-danger-text)';
  }
  if (line.startsWith('@@')) {
    return 'bg-muted text-(--agency-shell-text)';
  }
  return 'text-(--agency-shell-muted)';
}

export default function DiffViewer({
  patch,
  emptyMessage = 'No patch returned.',
  className,
}: {
  patch?: string | null;
  emptyMessage?: string;
  className?: string;
}) {
  if (!patch) {
    return <p className="text-sm text-(--agency-shell-muted)">{emptyMessage}</p>;
  }

  return (
    <pre
      className={cn(
        'max-h-105 overflow-auto rounded-xl border border-(--agency-shell-border) bg-background p-4 text-xs leading-6',
        className
      )}
    >
      {patch.split('\n').map((line, index) => (
        <div
          key={`${index}-${line}`}
          className={`whitespace-pre-wrap px-2 font-mono ${lineClassName(line)}`}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}
