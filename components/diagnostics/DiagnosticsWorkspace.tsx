'use client';

import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ChartNetwork,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  Router,
  SlidersHorizontal,
  Stethoscope,
} from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Chip, Spinner } from '@nextui-org/react';
import PageHeader from '@/components/app-shell/PageHeader';
import { backendCapabilitiesApi } from '@/lib/api/backend/capabilities';
import { executionsApi } from '@/lib/api/backend/executions';
import { graphReadApi } from '@/lib/api/backend/graphRead';
import { physicalDevicesApi } from '@/lib/api/backend/physicalDevices';
import { smartHomeApi } from '@/lib/api/backend/smartHome';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useAgencyUserPreferences } from '@/lib/userPreferences';
import type { AuthUser } from '@/types/auth';
import type { ExecutionRecord } from '@/types/runtime';

const diagnosticsCacheMs = 30_000;

export default function DiagnosticsWorkspace() {
  const { data: session } = useSession();
  const user = session?.user as AuthUser | undefined;
  const {
    isLoaded,
    preferences: { showDiagnostics },
    setShowDiagnostics,
  } = useAgencyUserPreferences();
  const enabled = isLoaded && showDiagnostics;

  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.backendCapabilities(),
    queryFn: () => backendCapabilitiesApi.getCapabilities(),
    enabled,
    staleTime: diagnosticsCacheMs,
    retry: 1,
  });
  const graphStatusQuery = useQuery({
    queryKey: queryKeys.backendAgencyGraphStatus(),
    queryFn: () => graphReadApi.getStatus(user),
    enabled: enabled && Boolean(user),
    staleTime: diagnosticsCacheMs,
    retry: false,
  });
  const executionsQuery = useQuery({
    queryKey: queryKeys.backendExecutions(),
    queryFn: () => executionsApi.listExecutions(user),
    enabled: enabled && Boolean(user),
    staleTime: diagnosticsCacheMs,
    retry: false,
  });
  const physicalDevicesQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDevicesAvailability(),
    queryFn: () => physicalDevicesApi.getAvailability(),
    enabled,
    staleTime: diagnosticsCacheMs,
    retry: 1,
  });
  const smartHomeQuery = useQuery({
    queryKey: queryKeys.backendSmartHomeAvailability(),
    queryFn: () => smartHomeApi.getAvailability(),
    enabled,
    staleTime: diagnosticsCacheMs,
    retry: 1,
  });

  const executionSummary = useMemo(
    () => summarizeExecutions(executionsQuery.data?.items || []),
    [executionsQuery.data]
  );
  const isFetching =
    capabilitiesQuery.isFetching ||
    graphStatusQuery.isFetching ||
    executionsQuery.isFetching ||
    physicalDevicesQuery.isFetching ||
    smartHomeQuery.isFetching;

  if (!isLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!showDiagnostics) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <PageHeader
          className="mb-6"
          icon={Stethoscope}
          tone="run"
          title="Diagnostics"
          description="Optional backend capabilities, graph health, run coverage, and module availability."
        />
        <Card className="max-w-2xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <CardBody className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-cyan-400/10 dark:text-cyan-200">
              <SlidersHorizontal className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-neutral-950 dark:text-slate-50">
                Diagnostics are hidden
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
                Enable this operator workspace when you need site-wide system health. The setting
                can be changed again from Profile.
              </p>
              <Button className="mt-4" color="primary" onPress={() => setShowDiagnostics(true)}>
                Enable Diagnostics
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        className="mb-8"
        icon={Stethoscope}
        tone="run"
        title="Diagnostics"
        description="A profile-gated workspace for backend capabilities, graph health, run coverage, and optional module availability."
        actions={
          <>
            {isFetching ? <Spinner color="primary" size="sm" /> : null}
            <Button size="sm" variant="flat" onPress={() => setShowDiagnostics(false)}>
              Hide Diagnostics
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-4">
        <SummaryCard
          icon={DatabaseZap}
          label="Backend"
          state={capabilitiesQuery.data?.version || 'unknown'}
          tone={capabilitiesQuery.isError ? 'warning' : 'success'}
          detail={capabilitiesQuery.data?.name || 'Capabilities endpoint'}
        />
        <SummaryCard
          icon={ChartNetwork}
          label="Agency Graph"
          state={graphStatusLabel(graphStatusQuery.data)}
          tone={
            graphStatusQuery.isError
              ? 'warning'
              : graphAvailable(graphStatusQuery.data)
                ? 'success'
                : 'warning'
          }
          detail={graphStatusQuery.isError ? 'Graph status unavailable' : 'Read projection status'}
        />
        <SummaryCard
          icon={Activity}
          label="Runs"
          state={`${executionSummary.total} total`}
          tone={executionSummary.failed > 0 ? 'warning' : 'success'}
          detail={`${executionSummary.failed} failed, ${executionSummary.running} running`}
        />
        <SummaryCard
          icon={Router}
          label="Modules"
          state={`${availabilityLabel(physicalDevicesQuery.data)} / ${availabilityLabel(smartHomeQuery.data)}`}
          tone={
            physicalDevicesQuery.data?.available === false ||
            smartHomeQuery.data?.available === false
              ? 'warning'
              : 'success'
          }
          detail="Physical world / smart home"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                Operational Signals
              </h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <SignalRow
              label="Graph read backend"
              status={graphStatusLabel(graphStatusQuery.data)}
              detail={formatObjectSummary(graphStatusQuery.data)}
              isLoading={graphStatusQuery.isLoading}
              isWarning={graphStatusQuery.isError || !graphAvailable(graphStatusQuery.data)}
            />
            <SignalRow
              label="Recent execution coverage"
              status={`${executionSummary.total} runs`}
              detail={`${executionSummary.workflowCount} workflows, ${executionSummary.failed} failed, ${executionSummary.errored} with error details`}
              isLoading={executionsQuery.isLoading}
              isWarning={executionSummary.failed > 0}
            />
            <SignalRow
              label="Physical world module"
              status={availabilityLabel(physicalDevicesQuery.data)}
              detail={availabilityDetail(physicalDevicesQuery.data)}
              isLoading={physicalDevicesQuery.isLoading}
              isWarning={
                physicalDevicesQuery.data?.available === false || physicalDevicesQuery.isError
              }
            />
            <SignalRow
              label="Smart home module"
              status={availabilityLabel(smartHomeQuery.data)}
              detail={availabilityDetail(smartHomeQuery.data)}
              isLoading={smartHomeQuery.isLoading}
              isWarning={smartHomeQuery.data?.available === false || smartHomeQuery.isError}
            />
          </CardBody>
        </Card>

        <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
              Graph Intelligence Roadmap
            </h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm text-neutral-600 dark:text-slate-300">
            <RoadmapItem label="Reliable coverage" done />
            <RoadmapItem label="Temporal aggregation by run age and status" />
            <RoadmapItem label="Incident clustering across workflows and errors" />
            <RoadmapItem label="Workflow/run health summaries in graph clusters" />
            <RoadmapItem label="Drill-down from cluster to logs, artifacts, and evidence" />
            <RoadmapItem label="Graph-native retry, resume, and artifact actions" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  state,
  tone,
}: {
  detail: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  state: string;
  tone: 'success' | 'warning';
}) {
  return (
    <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-cyan-400/10 dark:text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <Chip color={tone === 'success' ? 'success' : 'warning'} size="sm" variant="flat">
            {tone === 'success' ? 'OK' : 'Check'}
          </Chip>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-slate-50">{state}</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">{detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function SignalRow({
  detail,
  isLoading,
  isWarning,
  label,
  status,
}: {
  detail: string;
  isLoading?: boolean;
  isWarning?: boolean;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <div>
        <p className="font-medium text-neutral-950 dark:text-slate-50">{label}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">{detail}</p>
      </div>
      <Chip
        color={isWarning ? 'warning' : 'success'}
        size="sm"
        startContent={
          isLoading ? undefined : isWarning ? (
            <CircleAlert className="h-3 w-3" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )
        }
        variant="flat"
      >
        {isLoading ? 'Loading' : status}
      </Chip>
    </div>
  );
}

function RoadmapItem({ done = false, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/40">
      <span
        className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
      />
      <span className={done ? 'font-medium text-neutral-900 dark:text-slate-100' : ''}>
        {label}
      </span>
    </div>
  );
}

function summarizeExecutions(executions: ExecutionRecord[]) {
  const workflows = new Set<string>();
  let failed = 0;
  let running = 0;
  let errored = 0;

  for (const execution of executions) {
    if (execution.workflow_id) {
      workflows.add(execution.workflow_id);
    }
    if (execution.status === 'failed') {
      failed += 1;
    }
    if (execution.status === 'running') {
      running += 1;
    }
    if (execution.error) {
      errored += 1;
    }
  }

  return {
    errored,
    failed,
    running,
    total: executions.length,
    workflowCount: workflows.size,
  };
}

function graphAvailable(status?: Record<string, unknown>) {
  return status?.available !== false && status?.enabled !== false;
}

function graphStatusLabel(status?: Record<string, unknown>) {
  if (!status) {
    return 'unknown';
  }
  if (status.available === false || status.enabled === false) {
    return 'unavailable';
  }
  return String(status.source || status.status || 'available');
}

function formatObjectSummary(value?: Record<string, unknown>) {
  if (!value) {
    return 'No graph status payload has been loaded yet.';
  }
  const keys = Object.keys(value).slice(0, 5);
  return keys.length ? `Fields: ${keys.join(', ')}` : 'Graph status returned an empty payload.';
}

function availabilityLabel(value?: { available?: boolean }) {
  if (!value) {
    return 'unknown';
  }
  return value.available === false ? 'hidden' : 'available';
}

function availabilityDetail(value?: {
  reason?: string | null;
  source?: string;
  status?: string | number;
}) {
  if (!value) {
    return 'Availability check has not completed yet.';
  }
  if (value.reason) {
    return value.reason;
  }
  return `Source: ${value.source || 'capabilities'}${value.status ? `, status: ${value.status}` : ''}`;
}
