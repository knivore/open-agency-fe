'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import ToolContractList from '@/components/tools/ToolContractList';
import ToolContractViewer from '@/components/tools/ToolContractViewer';
import ToolInputForm from '@/components/tools/ToolInputForm';
import ToolRunResult from '@/components/tools/ToolRunResult';
import { ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent } from '@/components/library/shadcn/card';
import { toolsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { ToolRunResponse } from '@/types/toolContracts';

export default function ToolContractsWorkspace() {
  const [selectedName, setSelectedName] = useState<string | undefined>();
  const [lastResult, setLastResult] = useState<ToolRunResponse | null>(null);

  const contractsQuery = useQuery({
    queryKey: queryKeys.toolContracts(),
    queryFn: async () => (await toolsApi.listToolContracts()).items,
  });

  useEffect(() => {
    if (!selectedName && contractsQuery.data?.length) {
      setSelectedName(contractsQuery.data[0].name);
    }
  }, [contractsQuery.data, selectedName]);

  const contractQuery = useQuery({
    queryKey: selectedName ? queryKeys.toolContract(selectedName) : ['toolContract', 'missing'],
    queryFn: () => toolsApi.getToolContract(selectedName as string),
    enabled: Boolean(selectedName),
  });

  const runMutation = useMutation({
    mutationFn: (payload: unknown) => toolsApi.runTool(selectedName as string, payload),
    onSuccess: (result) => setLastResult(result),
  });

  if (contractsQuery.isLoading) {
    return <LoadingCard title="Tool contracts" description="Loading contract registry from the backend." />;
  }

  if (contractsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load tool contracts"
        message={contractsQuery.error.message}
        onRetry={() => contractsQuery.refetch()}
      />
    );
  }

  const contracts = contractsQuery.data ?? [];
  const selectedContract = contractQuery.data;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_transparent_35%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Contract runtime
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Tool contracts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Browse machine-readable contracts, generate structured inputs, run dry-run tool calls, and inspect policy-mediated outputs before execution paths become mutable.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => contractsQuery.refetch()}
            disabled={contractsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${contractsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="outline">{contracts.length} contracts</Badge>
          {selectedName ? <Badge variant="outline">selected: {selectedName}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ToolContractList contracts={contracts} selectedName={selectedName} onSelect={(name) => {
          setSelectedName(name);
          setLastResult(null);
        }} />
        <div className="space-y-6">
          {contractQuery.isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-neutral-500">Loading selected contract...</CardContent>
            </Card>
          ) : contractQuery.isError ? (
            <ErrorAlert
              title="Failed to load selected contract"
              message={contractQuery.error.message}
              onRetry={() => contractQuery.refetch()}
            />
          ) : (
            <>
              <ToolContractViewer contract={selectedContract} />
              <ToolInputForm
                contract={selectedContract}
                isPending={runMutation.isPending}
                onRun={async (payload) => {
                  await runMutation.mutateAsync(payload);
                }}
              />
              {runMutation.isError ? (
                <ErrorAlert title="Tool run failed" message={runMutation.error.message} onRetry={() => runMutation.reset()} />
              ) : null}
              <ToolRunResult result={lastResult} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
