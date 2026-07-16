'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { RunSessionSummary, RunViewMode } from '@/types/runtime';
import { useRunsModule } from '@/components/runs/context';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const STATUS_FILTERS = [
  'all',
  'active',
  'waiting',
  'running',
  'queued',
  'paused',
  'sleeping',
  'waiting_for_input',
  'waiting_for_approval',
  'waiting_for_event',
  'completed',
  'failed',
  'cancelled',
] as const;
const EMPTY_RUNS: RunSessionSummary[] = [];
const FAVORITES_STORAGE_KEY = 'runs-observatory-favorites-v1';
const WAITING_STATUSES = new Set([
  'waiting_for_input',
  'waiting_for_approval',
  'waiting_for_event',
]);

export type RunsStatusFilter = (typeof STATUS_FILTERS)[number];

function readFavoriteWorkflowIds() {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw) as { workflows?: unknown };
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.filter((value): value is string => typeof value === 'string')
      : [];
    return new Set(workflows);
  } catch {
    return new Set<string>();
  }
}

export function useRunsWorkspace({
  workflowNamesById,
}: {
  workflowNamesById?: ReadonlyMap<string, string>;
} = {}) {
  const { api, queryKeys } = useRunsModule();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RunsStatusFilter>('all');
  const viewMode: RunViewMode = 'list';
  const setViewMode = useCallback(
    (nextViewMode: RunViewMode) => {
      const currentParams = new URLSearchParams(searchParams.toString());
      if (nextViewMode === 'list') {
        currentParams.delete('view');
      } else {
        currentParams.set('view', nextViewMode);
      }
      const nextHref = currentParams.toString()
        ? `${pathname}?${currentParams.toString()}`
        : pathname;
      router.replace(nextHref, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const runsQuery = useQuery({
    queryKey: queryKeys.activeRunSessions(),
    queryFn: () => api.runSessions.listRunSessions(),
    refetchInterval: (query) => {
      const runs = query.state.data ?? [];
      return runs.some((run) => !TERMINAL_STATUSES.has(run.status)) ? 10000 : 30000;
    },
    refetchOnWindowFocus: false,
  });

  const runs = runsQuery.data ?? EMPTY_RUNS;
  const favoriteWorkflowIds = readFavoriteWorkflowIds();
  const filteredRuns = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return runs
      .filter((run) => {
        const matchesStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'active'
              ? !TERMINAL_STATUSES.has(run.status)
              : statusFilter === 'waiting'
                ? WAITING_STATUSES.has(run.status)
                : run.status === statusFilter;
        const workflowName = run.workflowId ? workflowNamesById?.get(run.workflowId) : null;
        const matchesSearch =
          normalizedSearch.length === 0
            ? true
            : [run.id, run.workflowId, workflowName, run.runtimeAdapterId, run.status, run.error]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        return matchesStatus && matchesSearch;
      })
      .sort((left, right) => {
        const leftFavorite = left.workflowId ? favoriteWorkflowIds.has(left.workflowId) : false;
        const rightFavorite = right.workflowId ? favoriteWorkflowIds.has(right.workflowId) : false;
        if (leftFavorite !== rightFavorite) {
          return leftFavorite ? -1 : 1;
        }
        return left.createdAt && right.createdAt
          ? new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
          : left.id.localeCompare(right.id);
      });
  }, [favoriteWorkflowIds, runs, search, statusFilter, workflowNamesById]);

  const activeCount = useMemo(
    () => runs.filter((run) => !TERMINAL_STATUSES.has(run.status)).length,
    [runs]
  );
  const activeRuns = useMemo(
    () => runs.filter((run) => !TERMINAL_STATUSES.has(run.status)).slice(0, 6),
    [runs]
  );
  const waitingCount = useMemo(
    () => runs.filter((run) => WAITING_STATUSES.has(run.status)).length,
    [runs]
  );
  const failedCount = useMemo(() => runs.filter((run) => run.status === 'failed').length, [runs]);
  const runtimeCount = useMemo(
    () => new Set(runs.map((run) => run.runtimeAdapterId || 'unknown')).size,
    [runs]
  );

  return {
    runsQuery,
    runs,
    filteredRuns,
    activeRuns,
    activeCount,
    waitingCount,
    failedCount,
    runtimeCount,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    statusFilters: STATUS_FILTERS,
  };
}
