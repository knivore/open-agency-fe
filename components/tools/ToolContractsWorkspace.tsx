'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import ToolContractList from '@/components/tools/ToolContractList';
import ToolContractViewer from '@/components/tools/ToolContractViewer';
import ToolInputForm from '@/components/tools/ToolInputForm';
import ToolRunResult from '@/components/tools/ToolRunResult';
import { ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import PageHeader from '@/components/app-shell/PageHeader';
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
    return (
      <LoadingCard
        title="Tool contracts"
        description="Loading contract registry from the backend."
      />
    );
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
      <PageHeader
        eyebrow="Contract runtime"
        title="Tool contracts"
        description="Browse machine-readable contracts, generate structured inputs, run dry-run tool calls, and inspect policy-mediated outputs before execution paths become mutable."
        meta={
          <>
            <Badge variant="outline">{contracts.length} contracts</Badge>
            {selectedName ? <Badge variant="outline">selected: {selectedName}</Badge> : null}
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => contractsQuery.refetch()}
            disabled={contractsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${contractsQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ToolContractList
          contracts={contracts}
          selectedName={selectedName}
          onSelect={(name) => {
            setSelectedName(name);
            setLastResult(null);
          }}
        />
        <div className="space-y-6">
          {contractQuery.isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-neutral-500">
                Loading selected contract...
              </CardContent>
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
                <ErrorAlert
                  title="Tool run failed"
                  message={runMutation.error.message}
                  onRetry={() => runMutation.reset()}
                />
              ) : null}
              <ToolRunResult result={lastResult} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
