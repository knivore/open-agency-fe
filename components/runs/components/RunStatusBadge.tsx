import { Badge } from '@/components/library/shadcn/badge';
import { cn } from '@/lib/utils';
import { formatRunStatus, runStatusTone } from '@/lib/runs/runPresentation';

export default function RunStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = runStatusTone(status);

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 capitalize', tone.badge, className)}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          tone.dot,
          status === 'running' ? 'motion-safe:animate-pulse' : null
        )}
        aria-hidden="true"
      />
      {formatRunStatus(status)}
    </Badge>
  );
}
