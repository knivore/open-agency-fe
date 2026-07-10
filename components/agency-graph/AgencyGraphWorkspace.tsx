'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ChartNetwork } from 'lucide-react';
import AgencyGraphPanel from '@/components/agency-graph/AgencyGraphPanel';
import PageHeader from '@/components/app-shell/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { memoriesApi } from '@/lib/api/backend/memory';
import { graphReadApi } from '@/lib/api/backend/graphRead';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { AuthUser } from '@/types/auth';

const agencyGraphRootCacheMs = 60_000;
const agencyGraphStatusCacheMs = 30_000;

export default function AgencyGraphWorkspace() {
  const { data: session } = useSession();
  const user = session?.user as AuthUser | undefined;
  const memoriesQuery = useQuery({
    queryKey: queryKeys.backendMemories(),
    queryFn: () =>
      memoriesApi.listMemories({
        limit: 100,
        status: ['active'],
      }),
    gcTime: agencyGraphRootCacheMs * 5,
    retry: false,
    staleTime: agencyGraphRootCacheMs,
  });
  const graphStatusQuery = useQuery({
    queryKey: queryKeys.backendAgencyGraphStatus(),
    queryFn: () => graphReadApi.getStatus(user),
    enabled: Boolean(user),
    gcTime: agencyGraphStatusCacheMs * 10,
    retry: false,
    staleTime: agencyGraphStatusCacheMs,
  });

  const rootOptions = useMemo(
    () =>
      (memoriesQuery.data?.items || []).map((memory) => ({
        id: memory.id,
        label: memory.summary?.trim() || memory.content.slice(0, 80) || memory.id,
      })),
    [memoriesQuery.data]
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-5">
      <PageHeader
        icon={ChartNetwork}
        tone="graph"
        title="Agency Graph"
        description="Read Agency as a live system: humans, agents, tasks, knowledge, memory, and tools connected by execution flow."
      />

      {memoriesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load memory roots</AlertTitle>
          <AlertDescription>
            {memoriesQuery.error instanceof Error
              ? memoriesQuery.error.message
              : 'The memory API did not return graph root candidates.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <AgencyGraphPanel
        graphStatus={graphStatusQuery.data}
        graphStatusError={graphStatusQuery.error}
        isGraphStatusLoading={graphStatusQuery.isLoading}
        isRootOptionsLoading={memoriesQuery.isLoading}
        user={user}
        rootOptions={memoriesQuery.isLoading ? [] : rootOptions}
        onRefreshRoots={() => memoriesQuery.refetch()}
      />
    </div>
  );
}
