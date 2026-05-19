'use client';

import { useMemo, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentsApi, behaviorProfilesApi, conversationsApi, toolsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toolDisplayName } from '@/lib/tools/displayName';
import type { Agent, BehaviorTuningProfile } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
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
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import { ChevronDown, ChevronUp, FileText, RefreshCw } from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { toast } from 'sonner';

function ToolAssignmentControls({
  disabled,
  onChange,
  toolIds,
  tools,
}: {
  disabled: boolean;
  onChange: (toolIds: string[]) => void;
  toolIds: string[];
  tools: ToolDefinition[];
}) {
  const allToolIds = tools.map((tool) => tool.id);
  const assignmentMode =
    toolIds.length === 0 ? 'none' : toolIds.length === allToolIds.length ? 'all' : 'selected';
  const toggleTool = (toolId: string, checked: boolean) => {
    onChange(
      checked
        ? Array.from(new Set([...toolIds, toolId]))
        : toolIds.filter((value) => value !== toolId)
    );
  };

  if (tools.length === 0) {
    return <p className="text-xs text-neutral-500">No canonical tools available.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant={assignmentMode === 'none' ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange([])}
        >
          No tools
        </Button>
        <Button
          type="button"
          variant={assignmentMode === 'selected' ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(toolIds)}
        >
          Selected tools
        </Button>
        <Button
          type="button"
          variant={assignmentMode === 'all' ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(allToolIds)}
        >
          All tools
        </Button>
      </div>
      <p className="text-xs text-neutral-500">
        {toolIds.length} of {tools.length} tools assigned. Use all tools for broad autonomous
        agents; use selected tools for scoped agents.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {tools.map((tool) => (
          <label
            key={tool.id}
            className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
          >
            <input
              type="checkbox"
              checked={toolIds.includes(tool.id)}
              onChange={(event) => toggleTool(tool.id, event.target.checked)}
              disabled={disabled}
            />
            <span>
              <span className="block font-medium text-neutral-900">{toolDisplayName(tool)}</span>
              <span className="block text-xs text-neutral-500">{tool.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function AgentInstructionPreview({ instructions }: { instructions: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedInstructions = instructions.trim();
  const displayInstructions = normalizedInstructions || 'No instructions configured.';
  const lineCount = displayInstructions.split(/\r\n|\r|\n/).length;
  const isLongPrompt = displayInstructions.length > 360 || lineCount > 4;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary-700" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Prompt
          </p>
        </div>
        <span
          className="shrink-0 text-xs text-neutral-500"
          title={`${displayInstructions.length.toLocaleString()} chars`}
        >
          {formatPromptLength(displayInstructions.length)}
        </span>
      </div>
      <div className="relative">
        <p
          className={`whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6 text-neutral-700 ${
            isLongPrompt && !isExpanded ? 'max-h-28 overflow-hidden' : ''
          }`}
        >
          {displayInstructions}
        </p>
        {isLongPrompt && !isExpanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-neutral-50 to-transparent" />
        ) : null}
      </div>
      {isLongPrompt ? (
        <div className="border-t border-neutral-200 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-xs font-semibold text-primary-700 hover:bg-transparent hover:text-primary-800"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isExpanded ? 'Collapse prompt' : 'Show full prompt'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatPromptLength(characterCount: number) {
  if (characterCount < 1000) {
    return `${characterCount} chars`;
  }

  return `${(characterCount / 1000).toFixed(1)}k chars`;
}

function AgentCard({
  agent,
  isMainAgent,
  mainAgent,
  onRefresh,
  profiles,
  tools,
}: {
  agent: Agent;
  isMainAgent: boolean;
  mainAgent: {
    name?: string | null;
    description?: string | null;
    default_model_profile_id?: string | null;
  } | null;
  onRefresh: () => void | Promise<void>;
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
}) {
  const toolCount = agent.config.toolIds.length;
  const handoffCount = agent.config.handoffAgentIds.length;
  const instructionSummary = agent.config.instructions ?? '';
  const assignedTools = agent.config.toolIds.map((toolId) => {
    const tool = tools.find((candidate) => candidate.id === toolId);
    return {
      id: toolId,
      label: tool ? toolDisplayName(tool) : toolId,
    };
  });
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(mainAgent?.name ?? agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [instructions, setInstructions] = useState(agent.config.instructions ?? '');
  const [role, setRole] = useState(mainAgent?.description ?? agent.role ?? '');
  const [modelProfileId, setModelProfileId] = useState(agent.config.modelProfileId ?? '');
  const [toolIds, setToolIds] = useState<string[]>(agent.config.toolIds);
  const [error, setError] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const displayName = isMainAgent
    ? name.trim() || mainAgent?.name?.trim() || agent.name
    : agent.name;
  const cardDescription = isMainAgent
    ? role.trim() ||
      mainAgent?.description?.trim() ||
      agent.role ||
      agent.description ||
      'No role or description configured.'
    : agent.role || agent.description || 'No role or description configured.';

  const resetForm = () => {
    setName(mainAgent?.name ?? agent.name);
    setDescription(agent.description ?? '');
    setInstructions(agent.config.instructions ?? '');
    setRole(mainAgent?.description ?? agent.role ?? '');
    setModelProfileId(agent.config.modelProfileId ?? '');
    setToolIds(agent.config.toolIds);
    setError(null);
    setDeleteMode(false);
  };

  const handleSave = () => {
    setError(null);
    const normalizedModelProfileId = modelProfileId.trim();
    if (isMainAgent && !normalizedModelProfileId) {
      setError('The active main agent must use an LLM model preset.');
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          const normalizedName = name.trim();
          const normalizedRole = role.trim();

          if (isMainAgent) {
            const mainAgentPatch: Record<string, unknown> = {};

            if (!normalizedName) {
              setError('The active main agent must have an assistant display name.');
              return;
            }

            if (normalizedName !== (mainAgent?.name?.trim() ?? '')) {
              mainAgentPatch.name = normalizedName;
            }
            if (normalizedRole !== (mainAgent?.description?.trim() ?? '')) {
              mainAgentPatch.description = normalizedRole || null;
            }
            if (
              normalizedModelProfileId &&
              normalizedModelProfileId !== (mainAgent?.default_model_profile_id ?? '')
            ) {
              mainAgentPatch.default_model_profile_id = normalizedModelProfileId;
            }

            if (Object.keys(mainAgentPatch).length > 0) {
              await conversationsApi.updateMainAgent(mainAgentPatch);
            }
          }
          await agentsApi.updateAgent(agent.id, {
            name: normalizedName,
            description: description.trim() || null,
            instructions: instructions.trim(),
            role: normalizedRole || null,
            model_profile_id: normalizedModelProfileId || null,
            tool_ids: toolIds,
          });
          await onRefresh();
          toast.success('Agent updated.', { position: 'top-right' });
          setIsEditing(false);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Failed to update agent.');
        }
      })();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await agentsApi.deleteAgent(agent.id);
          await onRefresh();
          toast.success('Agent deleted.', { position: 'top-right' });
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete agent.');
        }
      })();
    });
  };

  return (
    <Card className="min-w-0 border-neutral-200">
      <CardHeader className="space-y-3">
        <div className="min-w-0 space-y-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg leading-6">{displayName}</CardTitle>
              {isMainAgent ? (
                <Badge className="agency-gradient text-white hover:brightness-105">
                  Main agent
                </Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1 line-clamp-2">{cardDescription}</CardDescription>
          </div>
          <Badge variant="secondary" className="max-w-full shrink-0 whitespace-normal text-left">
            {profiles.find((profile) => profile.id === agent.config.modelProfileId)?.name ||
              agent.config.modelProfileId ||
              'No profile'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-neutral-600">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {toolCount} assigned tool{toolCount === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline">
            {handoffCount} handoff{handoffCount === 1 ? '' : 's'}
          </Badge>
        </div>
        <AgentInstructionPreview instructions={instructionSummary} />
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Assigned tools
            </p>
            <span className="text-xs text-neutral-500">
              {toolCount} / {tools.length}
            </span>
          </div>
          {assignedTools.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedTools.map((tool) => (
                <Badge key={tool.id} variant="outline" title={tool.id}>
                  {tool.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              No tools assigned. Use Edit agent to assign command, computer-use, workflow, memory,
              or custom tools.
            </p>
          )}
          {tools.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              No assignable tools loaded from the backend. Run main-agent setup/sync or create tools
              first.
            </p>
          ) : null}
        </div>
        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${agent.id}-name`}>Name</Label>
              <Input
                id={`${agent.id}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${agent.id}-description`}>Description</Label>
              <Input
                id={`${agent.id}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${agent.id}-instructions`}>Instructions</Label>
              <Textarea
                id={`${agent.id}-instructions`}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${agent.id}-role`}>Role</Label>
              <Input
                id={`${agent.id}-role`}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${agent.id}-model-profile`}>Model profile</Label>
              <select
                id={`${agent.id}-model-profile`}
                value={modelProfileId}
                onChange={(event) => setModelProfileId(event.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {!isMainAgent ? <option value="">No profile</option> : null}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tool assignment</Label>
              <ToolAssignmentControls
                disabled={isPending}
                onChange={setToolIds}
                toolIds={toolIds}
                tools={tools}
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                className="agency-gradient text-white hover:brightness-105"
                disabled={isPending || !name.trim() || !instructions.trim()}
                onClick={handleSave}
              >
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  resetForm();
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setIsEditing(true);
              }}
            >
              Edit agent
            </Button>
            {isMainAgent ? (
              <p className="text-xs text-neutral-500"></p>
            ) : deleteMode ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDelete}
                >
                  {isPending ? 'Deleting...' : 'Confirm delete'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setDeleteMode(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setDeleteMode(true)}>
                Delete agent
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateAgentCard({
  onCreated,
  profiles,
  tools,
}: {
  onCreated: () => Promise<void> | void;
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [role, setRole] = useState('');
  const [modelProfileId, setModelProfileId] = useState('');
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName('');
    setDescription('');
    setInstructions('');
    setRole('');
    setModelProfileId('');
    setToolIds([]);
    setError(null);
  };

  const handleCreate = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await agentsApi.createAgent({
            name: name.trim(),
            description: description.trim() || null,
            instructions: instructions.trim(),
            role: role.trim() || null,
            model_profile_id: modelProfileId.trim() || null,
            tool_ids: toolIds,
            handoff_agent_ids: [],
          });
          await onCreated();
          reset();
          setIsOpen(false);
        } catch (createError) {
          setError(createError instanceof Error ? createError.message : 'Failed to create agent.');
        }
      })();
    });
  };

  return (
    <Card className="min-w-0 border-dashed border-neutral-300 bg-neutral-50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Create agent</CardTitle>
            <CardDescription>
              Add a canonical agent definition that can later be bound into workflows and assistant
              behavior.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setIsOpen(true);
            }}
          >
            New agent
          </Button>
        </div>
      </CardHeader>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) {
            reset();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create agent</DialogTitle>
            <DialogDescription>
              Add a canonical agent definition that can later be bound into workflows and assistant
              behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-neutral-600">
            <div className="space-y-1.5">
              <Label htmlFor="create-agent-name">Name</Label>
              <Input
                id="create-agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-agent-description">Description</Label>
              <Input
                id="create-agent-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-agent-instructions">Instructions</Label>
              <Textarea
                id="create-agent-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-agent-role">Role</Label>
              <Input
                id="create-agent-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-agent-model-profile">Model profile</Label>
              <select
                id="create-agent-model-profile"
                value={modelProfileId}
                onChange={(event) => setModelProfileId(event.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tool assignment</Label>
              <ToolAssignmentControls
                disabled={isPending}
                onChange={setToolIds}
                toolIds={toolIds}
                tools={tools}
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !name.trim() || !instructions.trim()}
              onClick={handleCreate}
            >
              {isPending ? 'Creating...' : 'Create agent'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function AgentsWorkspace() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgents(),
    queryFn: () => agentsApi.listAgentCatalog(),
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const toolsQuery = useQuery({
    queryKey: queryKeys.tools(),
    queryFn: async () => {
      const response = await toolsApi.listTools();
      return response.items;
    },
  });
  const mainAgentQuery = useQuery({
    queryKey: queryKeys.backendMainAgent(),
    queryFn: () => conversationsApi.getMainAgent(),
  });

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const tools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
  const activeMainAgentId = mainAgentQuery.data?.agent_id ?? null;
  const activeMainAgent = mainAgentQuery.data ?? null;
  const mainAgentLookupMessage = mainAgentQuery.isError
    ? 'The active main-agent lookup is currently unavailable.'
    : null;
  const refreshAgents = async () => {
    await agentsQuery.refetch();
    await mainAgentQuery.refetch();
  };

  if (agentsQuery.isLoading || profilesQuery.isLoading || toolsQuery.isLoading) {
    return <LoadingCard title="Agents" description="Loading backend agent definitions." />;
  }

  if (agentsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load agents"
        message={agentsQuery.error.message}
        onRetry={() => agentsQuery.refetch()}
      />
    );
  }

  if (profilesQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load behavior profiles"
        message={profilesQuery.error.message}
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  if (toolsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load tools"
        message={toolsQuery.error.message}
        onRetry={() => toolsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Agents</h1>
          <p className="text-sm text-neutral-500">AI Agents and their definitions</p>
          {mainAgentLookupMessage ? (
            <p className="mt-2 text-sm text-amber-700">{mainAgentLookupMessage}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => agentsQuery.refetch()}
          disabled={agentsQuery.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${agentsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <CreateAgentCard
        onCreated={async () => {
          await refreshAgents();
          toast.success('Agent created.', { position: 'top-right' });
        }}
        profiles={profiles}
        tools={tools}
      />

      {agents.length === 0 ? (
        <EmptyCard
          title="No agents yet"
          description="The transformed backend did not return any canonical agent definitions."
          actionLabel="Refresh"
          onAction={() => agentsQuery.refetch()}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isMainAgent={agent.id === activeMainAgentId}
              mainAgent={agent.id === activeMainAgentId ? activeMainAgent : null}
              onRefresh={refreshAgents}
              profiles={profiles}
              tools={tools}
            />
          ))}
        </div>
      )}
    </div>
  );
}
