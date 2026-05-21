'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runtimeAdaptersApi, workflowsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../library/shadcn/dialog';
import { Input } from '../library/shadcn/input';
import { Textarea } from '../library/shadcn/textarea';
import { Plus, RefreshCw, Workflow } from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkflowDeleteAction from '@/components/workflow/WorkflowDeleteAction';
import { toast } from 'sonner';

type CreateWorkflowFormState = {
  name: string;
  description: string;
  runtimeAdapterId: string;
};

function preferredRuntimeAdapterId(adapters: RuntimeAdapterDefinition[]) {
  return adapters.find((adapter) => adapter.id === 'native')?.id ?? adapters[0]?.id ?? '';
}

function toCreateWorkflowPayload(form: CreateWorkflowFormState) {
  const runtimeAdapterIds = form.runtimeAdapterId ? [form.runtimeAdapterId] : [];

  return {
    id: `workflow-${crypto.randomUUID()}`,
    name: form.name.trim(),
    description: form.description.trim() || null,
    nodes: [],
    edges: [],
    entrypoint: '',
    agent_definitions: [],
    task_definitions: [],
    tool_definitions: [],
    allowed_runtime_adapter_ids: runtimeAdapterIds,
    default_runtime_adapter_id: form.runtimeAdapterId || null,
    versioning: {
      version: '1.0.0',
      revision: 1,
      is_published: false,
      labels: ['draft'],
    },
    metadata: {
      inputs: [],
      process: 'sequential',
      created_from: 'workflow-list-workspace',
    },
  };
}

function CreateWorkflowDialog({
  adapters,
  onCreated,
}: {
  adapters: RuntimeAdapterDefinition[];
  onCreated: (workflowId: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<CreateWorkflowFormState>({
    name: '',
    description: '',
    runtimeAdapterId: preferredRuntimeAdapterId(adapters),
  });

  const createMutation = useMutation({
    mutationFn: () => workflowsApi.createWorkflow(toCreateWorkflowPayload(form)),
    onSuccess: async (workflow) => {
      const createdWorkflow =
        workflow && typeof workflow === 'object' && !Array.isArray(workflow)
          ? (workflow as Record<string, unknown>)
          : null;
      if (!createdWorkflow || typeof createdWorkflow.id !== 'string') {
        throw new Error('Workflow create response did not include an ID.');
      }
      setIsOpen(false);
      setForm({
        name: '',
        description: '',
        runtimeAdapterId: preferredRuntimeAdapterId(adapters),
      });
      await onCreated(createdWorkflow.id);
    },
  });

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New workflow
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (createMutation.isPending) {
            return;
          }
          setIsOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Create a canonical workflow. Native is the default execution path; add other adapters
              only when you want explicit alternate runtimes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
                htmlFor="new-workflow-name"
              >
                Name
              </label>
              <Input
                id="new-workflow-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
                htmlFor="new-workflow-description"
              >
                Description
              </label>
              <Textarea
                id="new-workflow-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                disabled={createMutation.isPending}
                className="min-h-28"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
                htmlFor="new-workflow-runtime"
              >
                Runtime adapter
              </label>
              <select
                id="new-workflow-runtime"
                value={form.runtimeAdapterId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, runtimeAdapterId: event.target.value }))
                }
                disabled={createMutation.isPending || adapters.length === 0}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm shadow-primary/5 transition-colors hover:border-primary-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No default adapter</option>
                {adapters.map((adapter) => (
                  <option key={adapter.id} value={adapter.id}>
                    {adapter.name} ({adapter.id})
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Nodes and edges are created after this step from tasks and task dependencies. Choose
                `native` unless you already know this workflow should target another adapter.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={createMutation.isPending || !form.name.trim()}
              onClick={() => {
                void toast.promise(createMutation.mutateAsync(), {
                  loading: 'Creating workflow...',
                  success: 'Workflow created.',
                  error: (error) =>
                    error instanceof Error ? error.message : 'Failed to create workflow.',
                  position: 'top-right',
                });
              }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create workflow'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function WorkflowListWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
  });
  const adaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => runtimeAdaptersApi.listRuntimeAdapters(),
  });

  const runtimeAdapters = adaptersQuery.data?.items ?? [];

  const handleCreated = async (workflowId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
    router.push(`/workflows/${workflowId}`);
  };

  if (workflowsQuery.isLoading || adaptersQuery.isLoading) {
    return (
      <LoadingCard
        title="Workflows"
        description="Loading canonical workflows from the transformed backend."
      />
    );
  }

  if (workflowsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load workflows"
        message={workflowsQuery.error.message}
        onRetry={() => workflowsQuery.refetch()}
      />
    );
  }

  if (adaptersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load runtime adapters"
        message={adaptersQuery.error.message}
        onRetry={() => adaptersQuery.refetch()}
      />
    );
  }

  const workflows = workflowsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflows"
        title="Workflows"
        description="Canonical workflow definitions."
        actions={
          <>
            <CreateWorkflowDialog adapters={runtimeAdapters} onCreated={handleCreated} />
            <Button
              type="button"
              variant="outline"
              onClick={() => workflowsQuery.refetch()}
              disabled={workflowsQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${workflowsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      {workflows.length === 0 ? (
        <EmptyCard
          title="No workflows found"
          description="Create a workflow first, then open the builder to add agents, tasks, and dependency edges."
          actionLabel="Refresh"
          onAction={() => workflowsQuery.refetch()}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {workflows.map((workflow) => (
          <Card
            key={workflow.id}
            className="agency-card transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary/10"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="agency-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm shadow-primary/20">
                    <Workflow className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg">
                      <Link href={`/workflows/${workflow.id}`} className="hover:text-primary">
                        {workflow.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {workflow.description || 'No workflow description configured.'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{workflow.versioning?.version || 'v1'}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-600">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{workflow.agent_definitions?.length ?? 0} agents</Badge>
                <Badge variant="outline">{workflow.task_definitions?.length ?? 0} tasks</Badge>
                <Badge variant="outline">{workflow.tool_definitions?.length ?? 0} tools</Badge>
                <Badge variant="outline">{workflow.nodes?.length ?? 0} nodes</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  Entrypoint: {workflow.entrypoint || 'Not set'}
                </p>
                <div className="flex items-center gap-2">
                  <WorkflowDeleteAction workflowId={workflow.id} workflowName={workflow.name} />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/workflows/${workflow.id}`}>Builder</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/workflows/${workflow.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
