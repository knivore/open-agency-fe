'use client';

import { useMemo, useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import type { AgentDefinition } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import type { TaskDefinition } from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import WorkflowRunPanel from '@/components/workflows/WorkflowRunPanel';

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

interface WorkflowBuilderPanelProps {
  workflowId: string;
  isEditing: boolean;
  behaviorProfiles: Array<{ id: string; name: string }>;
  toolDefinitions: ToolDefinition[];
  visibleAgentDefinitions: AgentDefinition[];
  availableAgentDefinitions: AgentDefinition[];
  visibleTaskDefinitions: TaskDefinition[];
  effectiveEntrypointTaskId: string;
  selectedTaskId?: string | null;
  workflowKickoffInputs: Record<string, string>;
  runtimeAdapterId?: string | null;
  toolsUsed: string;
  addAgentDefinition: () => void;
  addExistingAgentDefinition: (agent: AgentDefinition) => void;
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
  visibleAgentDefinitions,
  availableAgentDefinitions,
  visibleTaskDefinitions,
  effectiveEntrypointTaskId,
  selectedTaskId,
  workflowKickoffInputs,
  runtimeAdapterId,
  toolsUsed,
  addAgentDefinition,
  addExistingAgentDefinition,
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
  const selectedExistingAgent = useMemo(
    () =>
      availableAgentDefinitions.find((agent) => agent.id === selectedExistingAgentId) ??
      availableAgentDefinitions[0] ??
      null,
    [availableAgentDefinitions, selectedExistingAgentId]
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
        <div className="max-h-64 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {toolDefinitions.map((tool) => {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            Create agents and assign their tools, profiles, and handoffs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-2">
                <select
                  aria-label="Existing agent"
                  value={selectedExistingAgent?.id ?? ''}
                  onChange={(event) => setSelectedExistingAgentId(event.target.value)}
                  disabled={availableAgentDefinitions.length === 0}
                  className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {availableAgentDefinitions.length === 0 ? (
                    <option value="">No existing agents available</option>
                  ) : (
                    availableAgentDefinitions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAgentDefinition}>
                <Plus className="mr-2 h-4 w-4" />
                New agent
              </Button>
            </div>
          ) : null}
          {visibleAgentDefinitions.length === 0 ? (
            <p className="text-sm text-neutral-500">No agents available.</p>
          ) : (
            visibleAgentDefinitions.map((agent, agentIndex) => (
              <div key={agent.id} className="space-y-4 rounded-lg border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-900">{agent.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {agent.role || agent.description || 'No role configured.'}
                    </p>
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
                  <Badge variant="secondary">
                    {profileNameFor(agent.model_profile_id, behaviorProfiles)}
                  </Badge>
                  <Badge variant="outline">{(agent.tool_ids ?? []).length} tools</Badge>
                  <Badge variant="outline">{(agent.handoff_agent_ids ?? []).length} handoffs</Badge>
                </div>
                {isEditing ? (
                  <div className="mt-4 grid gap-3">
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
                      <Label htmlFor={`builder-agent-instructions-${agent.id}`}>Instructions</Label>
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
                    {renderAgentToolsSection(agent, agentIndex)}
                  </div>
                ) : (
                  renderAgentToolsSection(agent, agentIndex)
                )}
              </div>
            ))
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
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addTaskDefinition}>
                <Plus className="mr-2 h-4 w-4" />
                Add task
              </Button>
            </div>
          ) : null}
          {visibleTaskDefinitions.length === 0 ? (
            <p className="text-sm text-neutral-500">No tasks available.</p>
          ) : (
            visibleTaskDefinitions.map((task, taskIndex) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedTaskId === task.id}
                aria-label={`Select task ${task.name || task.id}`}
                className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Step {taskIndex + 1}</Badge>
                      {(task.depends_on_task_ids ?? []).length === 0 ? (
                        <Badge variant="outline">Root</Badge>
                      ) : null}
                      {effectiveEntrypointTaskId === task.id ? (
                        <Badge variant="secondary">Entrypoint</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium text-neutral-900">{task.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {task.description || 'No task description configured.'}
                    </p>
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
                  <Badge variant="outline">
                    Agent:{' '}
                    {task.agent_id
                      ? agentMap.get(task.agent_id)?.name || task.agent_id
                      : 'Unassigned'}
                  </Badge>
                  <Badge variant="outline">
                    {(task.depends_on_task_ids ?? []).length} dependencies
                  </Badge>
                  {task.human_approval_required ? (
                    <Badge variant="secondary">Approval</Badge>
                  ) : null}
                </div>
                {isEditing ? (
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
                              {agent.name}
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
                  </div>
                ) : null}
              </div>
            ))
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
