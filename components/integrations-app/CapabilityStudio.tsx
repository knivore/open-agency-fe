'use client';
import { FormField } from '@/components/app-shell/FormSection';

import { NativeSelect } from '@/components/library/shadcn/select';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, FileText, ShieldCheck, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { agentsApi } from '@/lib/api/backend/agents';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { applyCapabilityEdits, isGeneratedCapability } from '@/lib/tools/capabilityAssignments';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { AgentDefinition } from '@/types/agents';
import { Button } from '../library/shadcn/button';
import { Alert, AlertDescription, AlertTitle } from '../library/shadcn/alert';
import { Separator } from '../library/shadcn/separator';
import ConfirmActionDialog from '../app-shell/ConfirmActionDialog';
import CapabilityCatalog, {
  type CapabilityCatalogProps,
  capabilityProviderTool,
} from './CapabilityCatalog';
import { useCapabilityDraftGuard } from './CapabilityDraftGuard';

const accessQueryKey = ['integrations', 'capability-agent-access'];

function agentToolIds(agent?: AgentDefinition) {
  return agent?.tool_ids ?? agent?.toolIds ?? [];
}

export default function CapabilityStudio(props: Omit<CapabilityCatalogProps, 'assignment'>) {
  const queryClient = useQueryClient();
  const accessQuery = useQuery({
    queryKey: accessQueryKey,
    queryFn: async () => {
      const [agents, main] = await Promise.all([
        agentsApi.listAgents(),
        conversationsApi.getMainAgent(),
      ]);
      return { agents: agents.items, main };
    },
    retry: false,
    staleTime: 30_000,
  });
  const [agentId, setAgentId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ id: string; ids: string[] } | null>(null);
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  // Fail closed until the harness is identified. Its display name is not an
  // identity boundary, and it never belongs in an editable specialist list.
  const mainId = accessQuery.data?.main.agent_id;
  const specialists = mainId
    ? (accessQuery.data?.agents.filter((agent) => agent.id !== mainId) ?? [])
    : [];
  const agent = agentId
    ? specialists.find((candidate) => candidate.id === agentId)
    : specialists[0];
  const tools = props.providers
    .filter((provider) => provider.kind === 'tool')
    .map(capabilityProviderTool);
  const originalIds = baseline && baseline.id === agent?.id ? baseline.ids : agentToolIds(agent);
  const selectedIds = new Set(originalIds);
  for (const [id, checked] of Object.entries(edits)) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
  }
  const dirty = Object.keys(edits).length > 0;
  const { setDirty } = useCapabilityDraftGuard();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  useUnsavedChangesGuard(dirty);

  function reset() {
    setEdits({});
    setBaseline(null);
  }

  function chooseAgent(id: string) {
    setAgentId(id);
    reset();
  }

  function requestAgent(id: string) {
    if (dirty) setPendingAgentId(id);
    else chooseAgent(id);
  }

  function toggle(id: string, checked: boolean) {
    setBaseline((current) =>
      current?.id === agent?.id
        ? current
        : agent
          ? { id: agent.id, ids: [...agentToolIds(agent)] }
          : null
    );
    setEdits((current) => {
      const next = { ...current };
      if (originalIds.includes(id) === checked) delete next[id];
      else next[id] = checked;
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!agent || !mainId || agent.id === mainId)
        throw new Error('Choose a specialist agent. Main-agent access is harness managed.');
      const [freshAgent, freshMain] = await Promise.all([
        agentsApi.getAgent(agent.id),
        conversationsApi.getMainAgent(),
      ]);
      if (freshAgent.id === freshMain.agent_id)
        throw new Error('Main-agent access is harness managed. Refresh to continue.');
      const toolIds = applyCapabilityEdits(agentToolIds(freshAgent), edits, tools);
      // The existing API remains authoritative for policy and reviewed generated
      // revisions. No workflow, security, approval or metadata fields change here.
      return agentsApi.updateAgent(agent.id, { tool_ids: toolIds });
    },
    onSuccess: async (saved) => {
      setBaseline({ id: saved.id, ids: agentToolIds(saved) });
      setEdits({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accessQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['agents'] }),
        queryClient.invalidateQueries({ queryKey: ['agentCatalog'] }),
      ]);
      toast.success('Specialist capability access saved.');
    },
  });
  const canEdit = Boolean(agent && mainId && !accessQuery.isError && !save.isPending);
  const selected = [...selectedIds].map((id) => ({
    id,
    tool: tools.find((tool) => tool.id === id),
  }));
  const panel = (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 xl:sticky xl:top-5">
      <div className="flex items-center gap-3">
        <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Agent access</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Choose the operations each specialist can use.
      </p>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Main agent
        </h3>
        <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
          <UserRound className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">All enabled capabilities</p>
            <p className="text-xs text-muted-foreground">Harness managed</p>
          </div>
        </div>
      </div>
      <Separator />
      {accessQuery.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading specialist access…
        </p>
      ) : accessQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Agent access unavailable</AlertTitle>
          <AlertDescription>
            We could not verify the main-agent profile. Assignments are locked.
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => accessQuery.refetch()}
            >
              Retry agent access
            </Button>
          </AlertDescription>
        </Alert>
      ) : !specialists.length ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>No specialist agents are available.</p>
          <Button asChild variant="outline">
            <Link href="/agents">Create a specialist</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="capability-specialist"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Specialist agent
            </label>
            <div className="flex items-center gap-2">
              <Bot className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <NativeSelect
                id="capability-specialist"
                className="h-11 min-w-0 w-full rounded-lg border bg-background px-3 text-sm"
                value={agent?.id ?? ''}
                disabled={save.isPending}
                onChange={(event) => requestAgent(event.target.value)}
              >
                {specialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Selected operations ({selectedIds.size})
            </h3>
            <ul
              aria-label="Selected operations"
              className="flex max-h-56 flex-col gap-1 overflow-y-auto"
            >
              {selected.map(({ id, tool }) => (
                <li key={id} className="flex min-w-0 items-center gap-2 rounded-md py-1.5 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={tool?.display_name || tool?.name || id}
                  >
                    {tool?.display_name || tool?.name || id}
                    {!tool ? ' (unavailable)' : ''}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    aria-label={'Remove ' + (tool?.display_name || tool?.name || id)}
                    disabled={!canEdit || !tool}
                    onClick={() => toggle(id, false)}
                  >
                    <X data-icon="inline-start" />
                  </Button>
                </li>
              ))}
            </ul>
            {!selected.length ? (
              <p className="text-sm text-muted-foreground">Select operations from the catalog.</p>
            ) : null}
          </div>
        </>
      )}
      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Approval rules stay enforced</AlertTitle>
        <AlertDescription>
          Specialists use explicitly assigned operations. Existing ownership checks and approval
          rules still apply.
        </AlertDescription>
      </Alert>
      {save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {save.error instanceof Error ? save.error.message : 'Could not save access.'}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button disabled={!canEdit || !dirty} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving access…' : 'Save access'}
        </Button>
        <Button
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() => {
            reset();
            save.reset();
          }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Generated tools need reviewed adoption in Agents before new access can be granted here.
      </p>
      <Button asChild variant="outline" className="xl:hidden">
        <a href="#capability-operations">Back to operations</a>
      </Button>
    </div>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 xl:hidden"
        aria-label="Assignment context"
      >
        <FormField
          label="Assign operations to"
          htmlFor="capability-specialist-compact"
          className="flex min-w-0 flex-1 flex-col gap-2"
        >
          <NativeSelect
            id="capability-specialist-compact"
            className="h-11 min-w-0 w-full rounded-lg border bg-background px-3 text-sm"
            value={agent?.id ?? ''}
            disabled={!canEdit}
            onChange={(event) => requestAgent(event.target.value)}
          >
            {!specialists.length ? (
              <option value="">
                {accessQuery.isPending ? 'Loading specialists…' : 'Specialist access unavailable'}
              </option>
            ) : (
              specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))
            )}
          </NativeSelect>
        </FormField>
        <Button asChild variant="outline">
          <a href="#capability-agent-access">
            Review access ({selectedIds.size}){dirty ? ' · Unsaved' : ''}
          </a>
        </Button>
      </div>
      <CapabilityCatalog
        {...props}
        assignment={{
          selectedIds,
          canEdit,
          onToggle: toggle,
          canAssign: (provider) =>
            !isGeneratedCapability(capabilityProviderTool(provider)) ||
            originalIds.includes(provider.id),
          panel,
        }}
      />
      <ConfirmActionDialog
        trigger={null}
        open={pendingAgentId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAgentId(null);
        }}
        title="Discard unsaved access changes?"
        description="Your current selections have not been saved. Switch specialists and discard these changes?"
        confirmLabel="Discard and switch"
        cancelLabel="Keep editing"
        onConfirm={() => {
          if (pendingAgentId) chooseAgent(pendingAgentId);
          setPendingAgentId(null);
        }}
      />
    </div>
  );
}
