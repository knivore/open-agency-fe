'use client';

import { Activity, AlertTriangle, Box, CircleDollarSign, Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/library/shadcn/badge';
import { CardDescription, CardTitle } from '@/components/library/shadcn/card';
import type {
  ObservabilityAgentMetrics,
  ObservabilityModelUsageResponse,
  ObservabilityWorkflowMetrics,
} from '@/lib/api/backend/observability';

interface WorkflowObservabilitySummaryProps {
  agentMetrics?: ObservabilityAgentMetrics[];
  frame?: 'inline';
  isLoading?: boolean;
  modelUsage?: ObservabilityModelUsageResponse | null;
  workflowMetrics?: ObservabilityWorkflowMetrics | null;
}

function formatNumber(value: number | null | undefined, fallback = '0') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : fallback;
}

function formatCost(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '$0.00';
  }
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(2)}`;
}

function latestStatus(
  summary: ObservabilityWorkflowMetrics | ObservabilityAgentMetrics | null | undefined
) {
  const latest = summary?.context_health?.latest;
  const status = latest && typeof latest.status === 'string' ? latest.status : null;
  return status ?? 'unknown';
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-base font-semibold text-neutral-950 dark:text-slate-100">{value}</div>
    </div>
  );
}

function sortedModelUsage(modelUsage: ObservabilityModelUsageResponse | null | undefined) {
  return [...(modelUsage?.items ?? [])].sort(
    (left, right) => (right.total_tokens ?? 0) - (left.total_tokens ?? 0)
  );
}

function sortedAgentMetrics(agentMetrics: ObservabilityAgentMetrics[] | undefined) {
  return [...(agentMetrics ?? [])].sort(
    (left, right) => (right.total_tokens ?? 0) - (left.total_tokens ?? 0)
  );
}

export default function WorkflowObservabilitySummary({
  agentMetrics = [],
  isLoading = false,
  modelUsage,
  workflowMetrics,
}: WorkflowObservabilitySummaryProps) {
  const models = sortedModelUsage(modelUsage).slice(0, 4);
  const agents = sortedAgentMetrics(agentMetrics).slice(0, 4);
  const workflowContextStatus = latestStatus(workflowMetrics);
  const warningCount = workflowMetrics?.budget?.warning_count ?? 0;
  const exceededCount = workflowMetrics?.budget?.exceeded_count ?? 0;
  const compactionCount = workflowMetrics?.compaction?.event_count ?? 0;
  const fallbackSummary = modelUsage?.fallback_summary;
  const fallbackCount = fallbackSummary?.fallback_count ?? 0;
  const fallbackFailureCount = fallbackSummary?.fallback_failure_count ?? 0;
  const fallbackRate = fallbackSummary?.fallback_rate ?? 0;
  const fallbackPrimaryModels = Object.entries(fallbackSummary?.fallback_primary_models ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
  const recentFallbackFailures = (fallbackSummary?.recent_failures ?? []).slice(0, 3);

  return (
    <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4 dark:border-white/10 dark:bg-white/3">
      <div className="space-y-1.5">
        <CardTitle className="text-base">Governance observability</CardTitle>
        <CardDescription>Workflow-scoped token, context, and budget signals.</CardDescription>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile
          icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Workflow tokens"
          value={isLoading ? 'Loading...' : formatNumber(workflowMetrics?.total_tokens)}
        />
        <MetricTile
          icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Context health"
          value={isLoading ? 'Loading...' : `Context ${workflowContextStatus}`}
        />
        <MetricTile
          icon={<CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Estimated cost"
          value={isLoading ? 'Loading...' : formatCost(workflowMetrics?.estimated_cost)}
        />
        <MetricTile
          icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Budget events"
          value={isLoading ? 'Loading...' : `${warningCount} warning / ${exceededCount} exceeded`}
        />
        <MetricTile
          icon={<Box className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Compactions"
          value={isLoading ? 'Loading...' : formatNumber(compactionCount)}
        />
        <MetricTile
          icon={<Repeat className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Fallbacks"
          value={
            isLoading
              ? 'Loading...'
              : `${formatNumber(fallbackCount)} used / ${formatNumber(fallbackFailureCount)} failed`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">Model usage</div>
          <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-950/72">
            {models.length > 0 ? (
              models.map((item) => (
                <div
                  key={`${item.provider}:${item.model}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-950 dark:text-slate-100">
                      {item.model}
                    </div>
                    <div className="truncate text-xs text-neutral-500 dark:text-slate-400">{item.provider}</div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-slate-200">
                    {formatNumber(item.total_tokens)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-neutral-500 dark:text-slate-400">
                {isLoading ? 'Loading model usage...' : 'No model usage recorded yet.'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">Agent usage</div>
          <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-950/72">
            {agents.length > 0 ? (
              agents.map((item) => (
                <div
                  key={item.agent_id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-950 dark:text-slate-100">
                      {item.agent_id}
                    </div>
                    <div className="truncate text-xs text-neutral-500 dark:text-slate-400">
                      Context {latestStatus(item)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium text-neutral-900 dark:text-slate-200">
                    {formatNumber(item.total_tokens)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-neutral-500 dark:text-slate-400">
                {isLoading ? 'Loading agent usage...' : 'No agent usage recorded yet.'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">Fallback health</div>
          <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-950/72">
            {fallbackCount > 0 || fallbackFailureCount > 0 ? (
              <>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="text-sm font-medium text-neutral-950 dark:text-slate-100">Fallback rate</div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-slate-200">
                    {(fallbackRate * 100).toFixed(1)}%
                  </div>
                </div>
                {fallbackPrimaryModels.map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 truncate text-sm text-neutral-700 dark:text-slate-300">{label}</div>
                    <Badge variant="outline">{formatNumber(count)}</Badge>
                  </div>
                ))}
                {recentFallbackFailures.map((failure) => (
                  <div
                    key={failure.event_id ?? `${failure.execution_id}-${failure.timestamp}`}
                    className="px-3 py-2"
                  >
                    <div className="truncate text-sm font-medium text-neutral-950 dark:text-slate-100">
                      {failure.primary_model ?? 'Primary model'} failed
                    </div>
                    <div className="truncate text-xs text-neutral-500 dark:text-slate-400">
                      {failure.error ?? 'Fallback attempts failed'}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="px-3 py-3 text-sm text-neutral-500 dark:text-slate-400">
                {isLoading ? 'Loading fallback health...' : 'No model fallbacks recorded yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
