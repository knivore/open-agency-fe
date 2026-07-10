'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bot, Eye, ListChecks, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { AgentDefinition } from '@/types/agents';
import { workflowTaskStarterTemplate } from '@/lib/workflows/capabilityTaskTemplates';
import { toolsRecommendedForWorkflowCapabilities } from '@/lib/workflows/capabilityTooling';
import type { ToolDefinition } from '@/types/tools';
import type {
  TaskDefinition,
  WorkflowCapabilityTag,
  WorkflowMemoryDefinition,
} from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';
import { cn } from '@/lib/utils';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import WorkflowRunPanel from '@/components/workflow/WorkflowRunPanel';
import WorkflowMemorySelectionPanel from '@/components/workflow/WorkflowMemorySelectionPanel';
import {
  applyPersonaAgentSnapshot,
  findPersonaSourceAgent,
  shortPersonaVersionId,
  type PersonaAgentVersionNotice,
} from '@/lib/workflows/personaVersioning';

const noModelProfileValue = '__no-model-profile__';

function profileNameFor(
  profileId: string | null | undefined,
  profiles: Array<{ id: string; name: string }>
) {
  if (!profileId) {
    return 'No profile';
  }
  return profiles.find((profile) => profile.id === profileId)?.name || profileId;
}

function isInteractiveEventTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button,input,textarea,select,a'));
}

function getToolLabel(toolId: string, toolMap: Map<string, ToolDefinition>) {
  const tool = toolMap.get(toolId);
  return tool ? toolDisplayName(tool) : toolId;
}

function personaSlugFromAgent(agent: AgentDefinition) {
  const slug = agent.metadata?.persona_slug;
  const generatedFromPersonaFactory = agent.metadata?.generated_from_persona_factory === true;
  return typeof slug === 'string' && slug.trim()
    ? slug.trim()
    : generatedFromPersonaFactory
      ? agent.name
      : null;
}

function personaVersionFromAgent(agent: AgentDefinition) {
  const versionId = agent.metadata?.persona_version_id;
  return typeof versionId === 'string' && versionId.trim() ? versionId.trim() : null;
}

function isPersonaBackedAgent(agent: AgentDefinition) {
  return Boolean(personaSlugFromAgent(agent) || agent.metadata?.persona_id);
}

function standaloneAgentOptionLabel(agent: AgentDefinition) {
  return agent.name;
}

function personaAgentOptionLabel(agent: AgentDefinition, notice?: PersonaAgentVersionNotice) {
  const personaSlug = notice?.personaSlug ?? personaSlugFromAgent(agent) ?? agent.name;
  const versionId = notice?.workflowPersonaVersionId ?? personaVersionFromAgent(agent);
  return `${agent.name} (@${personaSlug}${versionId ? ` ${shortPersonaVersionId(versionId)}` : ''})`;
}

function agentOptionLabel(agent: AgentDefinition, notice?: PersonaAgentVersionNotice) {
  return isPersonaBackedAgent(agent) ? personaAgentOptionLabel(agent, notice) : agent.name;
}

function agentCardTone(agent: AgentDefinition, notice?: PersonaAgentVersionNotice) {
  if (notice?.status === 'outdated') {
    return {
      accent: 'bg-warning-400',
      avatar: 'border-warning-200 bg-warning-50 text-warning-900',
      badge: 'border-warning-200 bg-warning-50 text-warning-900',
      card: 'border-warning-200 bg-warning-50/35',
    };
  }

  if (isPersonaBackedAgent(agent)) {
    return {
      accent: 'bg-secondary-500',
      avatar: 'border-secondary-200 bg-secondary-50 text-secondary-800',
      badge: 'border-secondary-200 bg-secondary-50 text-secondary-800',
      card: 'border-secondary-200 bg-secondary-50/30',
    };
  }

  if (!agent.model_profile_id) {
    return {
      accent: 'bg-warning-400',
      avatar: 'border-warning-200 bg-warning-50 text-warning-900',
      badge: 'border-warning-200 bg-warning-50 text-warning-900',
      card: 'border-warning-200 bg-warning-50/30',
    };
  }

  return {
    accent: 'bg-primary-500',
    avatar: 'border-primary-200 bg-primary-50 text-primary-800',
    badge: 'border-primary-200 bg-primary-50 text-primary-800',
    card: 'border-primary-200 bg-primary-50/25',
  };
}

function taskCardTone({
  isEntrypoint,
  isSelected,
  task,
}: {
  isEntrypoint: boolean;
  isSelected: boolean;
  task: TaskDefinition;
}) {
  if (isSelected) {
    return {
      accent: 'bg-primary-500',
      badge: 'border-primary-200 bg-primary-50 text-primary-800',
      card: 'border-primary-300 bg-primary-50/45 ring-2 ring-primary-100',
    };
  }

  if (isEntrypoint) {
    return {
      accent: 'bg-success-500',
      badge: 'border-success-200 bg-success-50 text-success-800',
      card: 'border-success-200 bg-success-50/30 hover:border-success-300',
    };
  }

  if (!task.agent_id) {
    return {
      accent: 'bg-warning-400',
      badge: 'border-warning-200 bg-warning-50 text-warning-900',
      card: 'border-warning-200 bg-warning-50/30 hover:border-warning-300',
    };
  }

  return {
    accent: 'bg-neutral-300',
    badge: 'border-neutral-200 bg-white text-neutral-700',
    card: 'border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/20',
  };
}

interface WorkflowBuilderPanelProps {
  workflowId: string;
  isEditing: boolean;
  behaviorProfiles: Array<{ id: string; name: string }>;
  toolDefinitions: ToolDefinition[];
  workflowCapabilityTags?: WorkflowCapabilityTag[];
  memoryDefinitions: WorkflowMemoryDefinition[];
  visibleAgentDefinitions: AgentDefinition[];
  availableAgentDefinitions: AgentDefinition[];
  personaAgentDefinitions?: AgentDefinition[];
  visibleTaskDefinitions: TaskDefinition[];
  effectiveEntrypointTaskId: string;
  selectedTaskId?: string | null;
  selectedTaskDetail?: ReactNode;
  workflowKickoffInputs: Record<string, string>;
  runtimeAdapterId?: string | null;
  toolsUsed: string;
  personaVersionNotices?: PersonaAgentVersionNotice[];
  addAgentDefinition: () => void;
  addExistingAgentDefinition: (agent: AgentDefinition) => void;
  onKeepPersonaVersion?: (notice: PersonaAgentVersionNotice, agentIndex: number) => void;
  onUseLatestPersona?: (notice: PersonaAgentVersionNotice, agentIndex: number) => void;
  addTaskDefinition: () => void;
  moveTaskDefinition: (fromIndex: number, toIndex: number) => void;
  removeAgentDefinition: (agentId: string) => void;
  removeTaskDefinition: (taskId: string) => void;
  onSelectTask: (taskId: string | null) => void;
  setEntrypoint: (taskId: string) => void;
  updateAgentDefinition: (agentIndex: number, updates: Partial<AgentDefinition>) => void;
  updateTaskDefinition: (taskIndex: number, updates: Partial<TaskDefinition>) => void;
}

export default function WorkflowBuilderPanel({
  workflowId,
  isEditing,
  behaviorProfiles,
  toolDefinitions,
  workflowCapabilityTags = [],
  memoryDefinitions,
  visibleAgentDefinitions,
  availableAgentDefinitions,
  personaAgentDefinitions = [],
  visibleTaskDefinitions,
  effectiveEntrypointTaskId,
  selectedTaskId,
  selectedTaskDetail,
  workflowKickoffInputs,
  runtimeAdapterId,
  toolsUsed,
  personaVersionNotices = [],
  addAgentDefinition,
  addExistingAgentDefinition,
  onKeepPersonaVersion,
  onUseLatestPersona,
  addTaskDefinition,
  moveTaskDefinition,
  removeAgentDefinition,
  removeTaskDefinition,
  onSelectTask,
  setEntrypoint,
  updateAgentDefinition,
  updateTaskDefinition,
}: WorkflowBuilderPanelProps) {
  const [selectedExistingAgentId, setSelectedExistingAgentId] = useState('');
  const agentMap = new Map(visibleAgentDefinitions.map((agent) => [agent.id, agent]));
  const toolMap = new Map(toolDefinitions.map((tool) => [tool.id, tool]));
  const personaNoticeByAgentId = new Map(
    personaVersionNotices.map((notice) => [notice.agentId, notice])
  );
  const availableStandaloneAgents = useMemo(
    () => availableAgentDefinitions.filter((agent) => !isPersonaBackedAgent(agent)),
    [availableAgentDefinitions]
  );
  const recommendedTools = useMemo(
    () => toolsRecommendedForWorkflowCapabilities(toolDefinitions, workflowCapabilityTags),
    [toolDefinitions, workflowCapabilityTags]
  );
  const taskStarterTemplate = useMemo(
    () => workflowTaskStarterTemplate(workflowCapabilityTags, visibleTaskDefinitions.length),
    [visibleTaskDefinitions.length, workflowCapabilityTags]
  );
  const recommendedToolIds = new Set(recommendedTools.map((tool) => tool.id));
  const otherTools = toolDefinitions.filter((tool) => !recommendedToolIds.has(tool.id));
  const selectedExistingAgent = useMemo(
    () =>
      availableStandaloneAgents.find((agent) => agent.id === selectedExistingAgentId) ??
      availableStandaloneAgents[0] ??
      null,
    [availableStandaloneAgents, selectedExistingAgentId]
  );
  const personaSourceAgents = useMemo(
    () => personaAgentDefinitions.filter(isPersonaBackedAgent),
    [personaAgentDefinitions]
  );
  const renderAgentToolsSection = (agent: AgentDefinition, agentIndex: number) => (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Tools</p>
        <Badge variant="outline">
          {(agent.tool_ids ?? []).length}/{toolDefinitions.length} assigned
        </Badge>
      </div>
      {toolDefinitions.length === 0 ? (
        <p className="text-sm text-neutral-500">No workflow tools available.</p>
      ) : isEditing ? (
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {recommendedTools.length > 0 ? (
            <div className="space-y-2 rounded-md border border-sky-200/70 bg-sky-50/70 p-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-sky-700">
                Recommended for this workflow
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendedTools.map((tool) => {
                  const isAssigned = (agent.tool_ids ?? []).includes(tool.id);
                  return (
                    <Button
                      key={tool.id}
                      type="button"
                      variant={isAssigned ? 'default' : 'outline'}
                      size="sm"
                      className="h-auto max-w-full justify-start whitespace-normal text-left"
                      onClick={() => {
                        const currentToolIds = agent.tool_ids ?? [];
                        updateAgentDefinition(agentIndex, {
                          tool_ids: isAssigned
                            ? currentToolIds.filter((toolId) => toolId !== tool.id)
                            : [...currentToolIds, tool.id],
                        });
                      }}
                    >
                      {toolDisplayName(tool)}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {otherTools.length > 0 ? (
            <div className="space-y-2">
              {recommendedTools.length > 0 ? (
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                  Other workflow tools
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {otherTools.map((tool) => {
                  const isAssigned = (agent.tool_ids ?? []).includes(tool.id);
                  return (
                    <Button
                      key={tool.id}
                      type="button"
                      variant={isAssigned ? 'default' : 'outline'}
                      size="sm"
                      className="h-auto max-w-full justify-start whitespace-normal text-left"
                      onClick={() => {
                        const currentToolIds = agent.tool_ids ?? [];
                        updateAgentDefinition(agentIndex, {
                          tool_ids: isAssigned
                            ? currentToolIds.filter((toolId) => toolId !== tool.id)
                            : [...currentToolIds, tool.id],
                        });
                      }}
                    >
                      {toolDisplayName(tool)}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : (agent.tool_ids ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(agent.tool_ids ?? []).map((toolId) => (
            <Badge key={toolId} variant="outline">
              {getToolLabel(toolId, toolMap)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No tools assigned.</p>
      )}
    </div>
  );
  const renderAgentModelProfileSelect = (agent: AgentDefinition, agentIndex: number) => {
    const selectedProfileId = agent.model_profile_id ?? '';
    const selectedProfileKnown = behaviorProfiles.some(
      (profile) => profile.id === selectedProfileId
    );

    return (
      <div className="space-y-1.5">
        <Label htmlFor={`builder-agent-model-profile-${agent.id}`}>Model profile</Label>
        <select
          id={`builder-agent-model-profile-${agent.id}`}
          value={selectedProfileId || noModelProfileValue}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) =>
            updateAgentDefinition(agentIndex, {
              model_profile_id:
                event.target.value === noModelProfileValue ? null : event.target.value,
            })
          }
        >
          <option value={noModelProfileValue}>No profile</option>
          {selectedProfileId && !selectedProfileKnown ? (
            <option value={selectedProfileId}>
              {profileNameFor(selectedProfileId, behaviorProfiles)}
            </option>
          ) : null}
          {behaviorProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderPersonaSourceSelect = (agent: AgentDefinition, agentIndex: number) => {
    const selectedPersonaSourceAgent = findPersonaSourceAgent(agent, personaSourceAgents);

    return (
      <div className="space-y-1.5 rounded-md border border-secondary-100 bg-secondary-50/40 p-3">
        <Label htmlFor={`builder-agent-persona-${agent.id}`}>Persona source</Label>
        <select
          id={`builder-agent-persona-${agent.id}`}
          value={selectedPersonaSourceAgent?.id ?? ''}
          disabled={!isEditing || personaSourceAgents.length === 0}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => {
            const personaAgent = personaSourceAgents.find(
              (candidate) => candidate.id === event.target.value
            );
            if (!personaAgent) {
              return;
            }

            updateAgentDefinition(agentIndex, applyPersonaAgentSnapshot(agent, personaAgent));
          }}
        >
          <option value="">
            {personaSourceAgents.length === 0
              ? 'No published persona agents available'
              : 'Choose persona to fill this agent'}
          </option>
          {personaSourceAgents.map((personaAgent) => (
            <option key={personaAgent.id} value={personaAgent.id}>
              {personaAgentOptionLabel(personaAgent, personaNoticeByAgentId.get(personaAgent.id))}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500">
          Selecting a persona replaces this agent&apos;s name, role, instructions, model profile,
          tools, and persona metadata while keeping task and graph links intact.
        </p>
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            Add standalone agents or published persona agents, then assign them to workflow tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="space-y-2">
              <div className="grid gap-2">
                <div className="grid gap-2 rounded-lg border border-primary-100 bg-primary-50/35 p-2">
                  <select
                    aria-label="Existing agent"
                    value={selectedExistingAgent?.id ?? ''}
                    onChange={(event) => setSelectedExistingAgentId(event.target.value)}
                    disabled={availableStandaloneAgents.length === 0}
                    className="flex h-9 min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {availableStandaloneAgents.length === 0 ? (
                      <option value="">No standalone agents available</option>
                    ) : (
                      availableStandaloneAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {standaloneAgentOptionLabel(agent)}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-primary-200 bg-white text-primary-800 hover:bg-primary-50"
                      disabled={!selectedExistingAgent}
                      onClick={() => {
                        if (!selectedExistingAgent) {
                          return;
                        }
                        addExistingAgentDefinition(selectedExistingAgent);
                        setSelectedExistingAgentId('');
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add existing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-primary-200 bg-white text-primary-800 hover:bg-primary-50"
                      onClick={addAgentDefinition}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New agent
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {visibleAgentDefinitions.length === 0 ? (
            <p className="text-sm text-neutral-500">No agents available.</p>
          ) : (
            visibleAgentDefinitions.map((agent, agentIndex) => {
              const notice = personaNoticeByAgentId.get(agent.id);
              const tone = agentCardTone(agent, notice);
              const personaSlug = notice?.personaSlug ?? personaSlugFromAgent(agent);

              return (
                <div
                  key={agent.id}
                  className={cn(
                    'relative space-y-4 overflow-hidden rounded-lg border p-4',
                    tone.card
                  )}
                >
                  <span className={cn('absolute inset-x-0 top-0 h-1', tone.accent)} />
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex min-w-0 gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                          tone.avatar
                        )}
                      >
                        {personaSlug ? (
                          <Sparkles className="h-5 w-5" />
                        ) : (
                          <Bot className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{agent.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {agent.role || agent.description || 'No role configured.'}
                        </p>
                      </div>
                    </div>
                    {isEditing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAgentDefinition(agent.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className={tone.badge}>
                      {profileNameFor(agent.model_profile_id, behaviorProfiles)}
                    </Badge>
                    {personaSlug ? (
                      <Badge variant="outline" className={tone.badge}>
                        @{personaSlug}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{(agent.tool_ids ?? []).length} tools</Badge>
                    <Badge variant="outline">{(agent.memory_ids ?? []).length} memories</Badge>
                    <Badge variant="outline">
                      {(agent.handoff_agent_ids ?? []).length} handoffs
                    </Badge>
                  </div>
                  {notice?.status === 'outdated' ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">Newer persona version available</p>
                      <p className="mt-1">
                        {personaNoticeByAgentId.get(agent.id)?.message ??
                          `This workflow uses @${personaNoticeByAgentId.get(agent.id)?.personaSlug} ${shortPersonaVersionId(
                            personaNoticeByAgentId.get(agent.id)?.workflowPersonaVersionId
                          )}. The published persona is now ${shortPersonaVersionId(
                            personaNoticeByAgentId.get(agent.id)?.currentPersonaVersionId
                          )}.`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !isEditing || !personaNoticeByAgentId.get(agent.id)?.publishedAgentId
                          }
                          onClick={() => {
                            const notice = personaNoticeByAgentId.get(agent.id);
                            if (notice) {
                              onUseLatestPersona?.(notice, agentIndex);
                            }
                          }}
                        >
                          Use latest persona
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isEditing}
                          onClick={() => {
                            const notice = personaNoticeByAgentId.get(agent.id);
                            if (notice) {
                              onKeepPersonaVersion?.(notice, agentIndex);
                            }
                          }}
                        >
                          Keep current
                        </Button>
                      </div>
                      {!isEditing ? (
                        <p className="mt-2 text-xs text-amber-800">
                          Enter edit mode to update this workflow persona snapshot.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {isEditing ? (
                    <div className="mt-4 grid gap-3">
                      {renderPersonaSourceSelect(agent, agentIndex)}
                      <div className="space-y-1.5">
                        <Label htmlFor={`builder-agent-name-${agent.id}`}>Name</Label>
                        <Input
                          id={`builder-agent-name-${agent.id}`}
                          value={agent.name}
                          onChange={(event) =>
                            updateAgentDefinition(agentIndex, { name: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`builder-agent-role-${agent.id}`}>Role</Label>
                        <Input
                          id={`builder-agent-role-${agent.id}`}
                          value={agent.role ?? ''}
                          onChange={(event) =>
                            updateAgentDefinition(agentIndex, {
                              role: event.target.value,
                              system_prompt: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`builder-agent-instructions-${agent.id}`}>
                          Instructions
                        </Label>
                        <Textarea
                          id={`builder-agent-instructions-${agent.id}`}
                          value={agent.instructions ?? agent.description ?? ''}
                          onChange={(event) =>
                            updateAgentDefinition(agentIndex, {
                              description: event.target.value,
                              instructions: event.target.value,
                            })
                          }
                          className="min-h-24"
                        />
                      </div>
                      {renderAgentModelProfileSelect(agent, agentIndex)}
                      {renderAgentToolsSection(agent, agentIndex)}
                      <WorkflowMemorySelectionPanel
                        title="Memory List"
                        description="Select memories this agent can use during workflow execution."
                        memories={memoryDefinitions}
                        selectedMemoryIds={agent.memory_ids ?? []}
                        isEditing={isEditing}
                        onSelectedMemoryIdsChange={(memoryIds) =>
                          updateAgentDefinition(agentIndex, { memory_ids: memoryIds })
                        }
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {renderAgentToolsSection(agent, agentIndex)}
                      <WorkflowMemorySelectionPanel
                        title="Memory List"
                        description="Memories available to this agent during workflow execution."
                        memories={memoryDefinitions}
                        selectedMemoryIds={agent.memory_ids ?? []}
                        isEditing={false}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Link tasks to agents, define sequence, and use dependencies for non-linear paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="space-y-2">
              {taskStarterTemplate ? (
                <div className="rounded-md border border-sky-200/70 bg-sky-50/70 p-3 text-sm text-sky-900">
                  <p className="font-medium">{taskStarterTemplate.label} starter</p>
                  <p className="mt-1 text-xs text-sky-800">
                    New tasks start with a {taskStarterTemplate.label.toLowerCase()}-oriented
                    outline based on this workflow&apos;s declared capabilities.
                  </p>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={addTaskDefinition}>
                  <Plus className="mr-2 h-4 w-4" />
                  {taskStarterTemplate ? taskStarterTemplate.addTaskLabel : 'Add task'}
                </Button>
              </div>
            </div>
          ) : null}
          {visibleTaskDefinitions.length === 0 ? (
            <p className="text-sm text-neutral-500">No tasks available.</p>
          ) : (
            visibleTaskDefinitions.map((task, taskIndex) => {
              const isSelectedTask = selectedTaskId === task.id;
              const isEntrypointTask = effectiveEntrypointTaskId === task.id;
              const tone = taskCardTone({
                isEntrypoint: isEntrypointTask,
                isSelected: isSelectedTask,
                task,
              });

              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelectedTask}
                  aria-label={`Select task ${task.name || task.id}`}
                  className={cn(
                    'relative overflow-hidden rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                    isSelectedTask ? '' : 'cursor-pointer',
                    tone.card
                  )}
                  onClick={() => onSelectTask(task.id)}
                  onKeyDown={(event) => {
                    if (isInteractiveEventTarget(event.target)) {
                      return;
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTask(task.id);
                    }
                  }}
                >
                  <span className={cn('absolute inset-x-0 top-0 h-1', tone.accent)} />
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <div className="flex min-w-0 gap-3">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                            tone.badge
                          )}
                        >
                          <ListChecks className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={tone.badge}>
                              Step {taskIndex + 1}
                            </Badge>
                            {(task.depends_on_task_ids ?? []).length === 0 ? (
                              <Badge variant="outline">Root</Badge>
                            ) : null}
                            {isEntrypointTask ? (
                              <Badge
                                variant="outline"
                                className="border-success-200 bg-success-50 text-success-800"
                              >
                                Entrypoint
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 font-medium text-neutral-900">{task.name}</p>
                          <p className="mt-1 text-sm text-neutral-500">
                            {task.description || 'No task description configured.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={selectedTaskId === task.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectTask(task.id);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {selectedTaskId === task.id ? 'Selected' : 'View'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskIndex === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveTaskDefinition(taskIndex, taskIndex - 1);
                          }}
                        >
                          Move up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={taskIndex === visibleTaskDefinitions.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveTaskDefinition(taskIndex, taskIndex + 1);
                          }}
                        >
                          Move down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTaskDefinition(task.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant={selectedTaskId === task.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectTask(task.id);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {selectedTaskId === task.id ? 'Selected' : 'View'}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={
                        task.agent_id
                          ? 'border-primary-200 bg-primary-50 text-primary-800'
                          : 'border-warning-200 bg-warning-50 text-warning-900'
                      }
                    >
                      Agent:{' '}
                      {task.agent_id
                        ? agentMap.get(task.agent_id)?.name || task.agent_id
                        : 'Unassigned'}
                    </Badge>
                    <Badge variant="outline">
                      {(task.depends_on_task_ids ?? []).length} dependencies
                    </Badge>
                    <Badge variant="outline">{(task.memory_ids ?? []).length} memories</Badge>
                    {task.human_approval_required ? (
                      <Badge variant="secondary">Approval</Badge>
                    ) : null}
                  </div>
                  {selectedTaskId === task.id && selectedTaskDetail ? (
                    <div className="mt-4" onClick={(event) => event.stopPropagation()}>
                      {selectedTaskDetail}
                    </div>
                  ) : isEditing ? (
                    <div className="mt-4 grid gap-3" onClick={(event) => event.stopPropagation()}>
                      <div className="space-y-1.5">
                        <Label htmlFor={`builder-task-name-${task.id}`}>Task name</Label>
                        <Input
                          id={`builder-task-name-${task.id}`}
                          value={task.name}
                          onChange={(event) =>
                            updateTaskDefinition(taskIndex, { name: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`builder-task-description-${task.id}`}>Description</Label>
                        <Textarea
                          id={`builder-task-description-${task.id}`}
                          value={task.description}
                          onChange={(event) =>
                            updateTaskDefinition(taskIndex, {
                              description: event.target.value,
                              instructions: event.target.value,
                            })
                          }
                          className="min-h-24"
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`builder-task-agent-${task.id}`}>Assigned agent</Label>
                          <select
                            id={`builder-task-agent-${task.id}`}
                            value={task.agent_id ?? ''}
                            onChange={(event) =>
                              updateTaskDefinition(taskIndex, {
                                agent_id: event.target.value || null,
                              })
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Unassigned</option>
                            {visibleAgentDefinitions.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agentOptionLabel(agent, personaNoticeByAgentId.get(agent.id))}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`builder-task-entrypoint-${task.id}`}>Entrypoint</Label>
                          <Button
                            id={`builder-task-entrypoint-${task.id}`}
                            type="button"
                            variant={effectiveEntrypointTaskId === task.id ? 'default' : 'outline'}
                            className="w-full"
                            onClick={() => setEntrypoint(task.id)}
                          >
                            {effectiveEntrypointTaskId === task.id
                              ? 'Current entrypoint'
                              : 'Set as entrypoint'}
                          </Button>
                        </div>
                      </div>
                      <WorkflowMemorySelectionPanel
                        title="Memory List"
                        description="Select memories this task can use during workflow execution."
                        memories={memoryDefinitions}
                        selectedMemoryIds={task.memory_ids ?? []}
                        isEditing={isEditing}
                        onSelectedMemoryIdsChange={(memoryIds) =>
                          updateTaskDefinition(taskIndex, { memory_ids: memoryIds })
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-4" onClick={(event) => event.stopPropagation()}>
                      <WorkflowMemorySelectionPanel
                        title="Memory List"
                        description="Memories available to this task during workflow execution."
                        memories={memoryDefinitions}
                        selectedMemoryIds={task.memory_ids ?? []}
                        isEditing={false}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Test Workflow</CardTitle>
            <CardDescription>
              Run the saved workflow. Use the task sequence below to verify the current intended
              order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {visibleTaskDefinitions.length === 0 ? (
                <p className="text-sm text-neutral-500">No tasks available yet.</p>
              ) : (
                visibleTaskDefinitions.map((task, taskIndex) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedTaskId === task.id}
                    aria-label={`Select task ${task.name || task.id}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                      selectedTaskId === task.id
                        ? 'border-sky-500 bg-sky-50/60'
                        : 'cursor-pointer border-neutral-200 hover:border-sky-300 hover:bg-sky-50/40'
                    }`}
                    onClick={() => onSelectTask(task.id)}
                    onKeyDown={(event) => {
                      if (isInteractiveEventTarget(event.target)) {
                        return;
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectTask(task.id);
                      }
                    }}
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {taskIndex + 1}. {task.name}
                      </p>
                      <p className="text-neutral-500">
                        {task.agent_id
                          ? agentMap.get(task.agent_id)?.name || task.agent_id
                          : 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {(task.depends_on_task_ids ?? []).length} deps
                      </Badge>
                      <Button
                        type="button"
                        variant={selectedTaskId === task.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectTask(task.id);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {selectedTaskId === task.id ? 'Selected' : 'View'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {isEditing ? (
              <p className="text-sm text-amber-700">
                Save the draft before running so execution uses the same workflow shown in Builder
                and Graph modes.
              </p>
            ) : (
              <WorkflowRunPanel
                workflowId={workflowId}
                toolsUsed={toolsUsed}
                workflowKickoffInputs={workflowKickoffInputs}
                taskOrder={visibleTaskDefinitions.map((task) => task.id)}
                runtimeAdapterId={runtimeAdapterId}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
