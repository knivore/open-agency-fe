'use client';

import { healthApi } from '@/lib/api/backend';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

type BackendHealthIndicatorProps = {
  compact?: boolean;
  showRefresh?: boolean;
};

function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />;
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

  let label = 'Checking backend';
  let toneClass = 'text-amber-700';
  let dotClass = 'bg-amber-500';

  if (healthQuery.isSuccess && healthQuery.data.ok) {
    label = 'Backend online';
    toneClass = 'text-emerald-700';
    dotClass = 'bg-emerald-500';
  } else if (healthQuery.isError) {
    label = 'Backend offline';
    toneClass = 'text-rose-700';
    dotClass = 'bg-rose-500';
  }

  const containerClass = compact
    ? 'inline-flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-medium shadow-sm shadow-primary/5'
    : 'flex items-center justify-between rounded-lg border border-primary-100 bg-white px-4 py-3 shadow-sm shadow-primary/5';

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2">
        <StatusDot className={dotClass} />
        <div className={toneClass}>
          <span>{label}</span>
        </div>
      </div>

      {showRefresh ? (
        <button
          type="button"
          onClick={() => healthQuery.refetch()}
          disabled={healthQuery.isFetching}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${healthQuery.isFetching ? 'animate-spin' : ''}`} />
          {!compact ? 'Refresh' : null}
        </button>
      ) : null}
    </div>
  );
}
