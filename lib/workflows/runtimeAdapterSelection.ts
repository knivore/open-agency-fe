import type { RuntimeAdapterDefinition } from '@/types/runtime';

export function resolveRunnableAdapters(
  runtimeAdapters: RuntimeAdapterDefinition[],
  workflowAllowedAdapterIds: string[] | undefined,
  workflowDefaultAdapterId: string | null | undefined,
) {
  const adapterById = new Map(runtimeAdapters.map((adapter) => [adapter.id, adapter]));
  const allowedAdapters = (workflowAllowedAdapterIds ?? [])
    .map((adapterId) => adapterById.get(adapterId))
    .filter((adapter): adapter is RuntimeAdapterDefinition => Boolean(adapter));

  if (allowedAdapters.length > 0) {
    return allowedAdapters;
  }

  if (workflowDefaultAdapterId) {
    const defaultAdapter = adapterById.get(workflowDefaultAdapterId);
    if (defaultAdapter) {
      return [defaultAdapter];
    }
  }

  return runtimeAdapters;
}

export function preferredRunRuntimeAdapterId(
  runnableAdapters: RuntimeAdapterDefinition[],
  workflowDefaultAdapterId: string | null | undefined,
) {
  return (
    runnableAdapters.find((adapter) => adapter.id === 'native')?.id
    ?? (workflowDefaultAdapterId && runnableAdapters.some((adapter) => adapter.id === workflowDefaultAdapterId)
      ? workflowDefaultAdapterId
      : null)
    ?? runnableAdapters[0]?.id
    ?? ''
  );
}

export function preferredWorkflowRuntimeAdapterId(
  workflowAllowedAdapterIds: string[] | undefined,
  workflowDefaultAdapterId: string | null | undefined,
) {
  const allowedAdapterIds = workflowAllowedAdapterIds ?? [];

  if (allowedAdapterIds.includes('native')) {
    return 'native';
  }

  if (
    workflowDefaultAdapterId
    && (allowedAdapterIds.length === 0 || allowedAdapterIds.includes(workflowDefaultAdapterId))
  ) {
    return workflowDefaultAdapterId;
  }

  return allowedAdapterIds[0] ?? workflowDefaultAdapterId ?? '';
}
