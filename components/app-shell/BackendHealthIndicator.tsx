'use client';

import { healthApi } from '@/lib/api/backend/health';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

type BackendHealthIndicatorProps = {
  compact?: boolean;
  showRefresh?: boolean;
};

function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block size-2 rounded-full ${className}`} />;
}

export default function BackendHealthIndicator({
  compact = false,
  showRefresh = true,
}: BackendHealthIndicatorProps) {
  const healthQuery = useQuery({
    queryKey: ['backend-health'],
    queryFn: () => healthApi.getHealth(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  let label = compact ? 'Checking' : 'Checking backend';
  let toneClass = 'text-(--agency-shell-muted)';
  let dotClass = 'bg-amber-500';

  if (healthQuery.isSuccess && healthQuery.data.ok) {
    label = compact ? 'Online' : 'Backend online';
    toneClass = 'text-(--agency-shell-text)';
    dotClass = 'bg-emerald-500';
  } else if (healthQuery.isError) {
    label = compact ? 'Offline' : 'Backend offline';
    toneClass = 'text-(--agency-shell-text)';
    dotClass = 'bg-rose-500';
  }

  const containerClass = compact
    ? 'inline-flex h-9 items-center gap-2 px-2 text-xs font-medium'
    : 'flex items-center justify-between rounded-xl border border-(--agency-control-border) bg-(--agency-control-bg) px-4 py-3 shadow-(--agency-outline-shadow)';

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2">
        <StatusDot className={dotClass} />
        <div className={toneClass}>
          <span>{label}</span>
        </div>
      </div>

      {showRefresh ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => healthQuery.refetch()}
                disabled={healthQuery.isFetching}
                aria-label="Refresh backend health"
                title="Refresh backend health"
                className="inline-flex items-center gap-1 text-xs font-medium text-(--agency-shell-muted) hover:text-(--agency-shell-text) disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${healthQuery.isFetching ? 'animate-spin' : ''}`} />
                {!compact ? 'Refresh' : null}
              </button>
            </TooltipTrigger>
            <TooltipContent>Refresh backend health</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
