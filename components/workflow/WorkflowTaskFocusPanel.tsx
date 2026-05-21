'use client';

import type { AgentDefinition } from '@/types/agents';
import type { TaskDefinition } from '@/types/workflows';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import WorkflowEdgeMetadataEditor from '@/components/workflow/WorkflowEdgeMetadataEditor';
import DocumentIngestionControl, {
  type DocumentIngestionOption,
} from '@/components/memory-app/DocumentIngestionControl';

interface WorkflowTaskDependencyLink {
  task: TaskDefinition;
  edgeType: string;
  condition: string;
  conditionError?: string;
  metadataJson: string;
  metadataError?: string;
}

interface WorkflowTaskFocusPanelProps {
  agentOptions?: DocumentIngestionOption[];
  selectedTask: TaskDefinition;
  selectedAgent?: AgentDefinition | null;
  workflowId: string;
  workflowLabel: string;
  dependencyLinks: WorkflowTaskDependencyLink[];
  dependentLinks: WorkflowTaskDependencyLink[];
  preferredDependencyTaskId?: string | null;
  preferredDependentTaskId?: string | null;
  previousTaskLabel?: string | null;
  nextTaskLabel?: string | null;
  isEditing: boolean;
  onClearSelection: () => void;
  onDocumentIngested?: () => Promise<void> | void;
  onDependencyEdgeTypeChange: (taskId: string, edgeType: string) => void;
  onDependencyConditionChange: (taskId: string, condition: string) => void;
  onDependencyMetadataChange: (taskId: string, metadataJson: string) => void;
  onDependentEdgeTypeChange: (taskId: string, edgeType: string) => void;
  onDependentConditionChange: (taskId: string, condition: string) => void;
  onDependentMetadataChange: (taskId: string, metadataJson: string) => void;
  onSelectDependencyTask: (taskId: string) => void;
  onSelectDependentTask: (taskId: string) => void;
  onSelectPreviousTask: () => void;
  onSelectNextTask: () => void;
}

export default function WorkflowTaskFocusPanel({
  agentOptions = [],
  selectedTask,
  selectedAgent,
  workflowId,
  workflowLabel,
  dependencyLinks,
  dependentLinks,
  preferredDependencyTaskId,
  preferredDependentTaskId,
  previousTaskLabel,
  nextTaskLabel,
  isEditing,
  onClearSelection,
  onDocumentIngested,
  onDependencyEdgeTypeChange,
  onDependencyConditionChange,
  onDependencyMetadataChange,
  onDependentEdgeTypeChange,
  onDependentConditionChange,
  onDependentMetadataChange,
  onSelectDependencyTask,
  onSelectDependentTask,
  onSelectPreviousTask,
  onSelectNextTask,
}: WorkflowTaskFocusPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Selected Task</CardTitle>
          <CardDescription>Task details, dependencies, and linked agent.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
          Clear Selection
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full justify-start whitespace-normal text-left"
            onClick={onSelectPreviousTask}
            disabled={!previousTaskLabel}
          >
            {previousTaskLabel || 'Previous Task'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full justify-start whitespace-normal text-left"
            onClick={onSelectNextTask}
            disabled={!nextTaskLabel}
          >
            {nextTaskLabel || 'Next Task'}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-neutral-900">{selectedTask.name}</p>
            {selectedTask.human_approval_required ? (
              <Badge variant="secondary">Approval</Badge>
            ) : null}
            {(selectedTask.depends_on_task_ids ?? []).length === 0 ? (
              <Badge variant="outline">Root</Badge>
            ) : null}
          </div>
          <p className="text-sm text-neutral-600">
            {selectedTask.description || 'No task description configured.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Assigned Agent
            </p>
            <p className="text-sm text-neutral-900">{selectedAgent?.name || 'Unassigned'}</p>
            <p className="text-sm text-neutral-500">
              {selectedAgent?.role || selectedAgent?.description || 'No agent role configured.'}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Expected Output
            </p>
            <p className="text-sm text-neutral-900">
              {selectedTask.expected_output || 'No expected output defined.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            Instructions
          </p>
          <p className="text-sm text-neutral-700">
            {selectedTask.instructions || 'No task instructions configured.'}
          </p>
        </div>

        <DocumentIngestionControl
          frame="inline"
          title="Task documents"
          description="Upload source material for this task. Files are stored as workflow memory with task tags."
          scope="workflow"
          lockedScope
          workflowId={workflowId}
          workflows={[{ id: workflowId, label: `${workflowLabel} (${workflowId})` }]}
          agentId={selectedTask.agent_id ?? undefined}
          lockedAgent={Boolean(selectedTask.agent_id)}
          agents={agentOptions}
          defaultTags={['task-rag', `workflow:${workflowId}`, `task:${selectedTask.id}`]}
          onIngested={onDocumentIngested}
        />

        <div className="grid gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Depends On
            </p>
            {preferredDependencyTaskId ? (
              <p className="text-xs text-neutral-500">
                Filled button = preferred upstream path for `Previous`.
              </p>
            ) : null}
            {dependencyLinks.length === 0 ? (
              <p className="text-sm text-neutral-500">No dependencies.</p>
            ) : (
              <div className="space-y-2">
                {dependencyLinks.map(
                  ({ task, edgeType, condition, conditionError, metadataJson, metadataError }) => (
                    <div key={task.id} className="rounded-md border border-neutral-200 p-2">
                      <Button
                        type="button"
                        variant={task.id === preferredDependencyTaskId ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto max-w-full justify-start whitespace-normal text-left"
                        onClick={() => onSelectDependencyTask(task.id)}
                      >
                        {task.id === preferredDependencyTaskId
                          ? `Preferred: ${task.name}`
                          : task.name}
                      </Button>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Edge Type</Label>
                            <select
                              value={edgeType}
                              onChange={(event) =>
                                onDependencyEdgeTypeChange(task.id, event.target.value)
                              }
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="default">default</option>
                              <option value="conditional">conditional</option>
                              <option value="success">success</option>
                              <option value="failure">failure</option>
                            </select>
                            <p className="text-xs text-neutral-500">
                              `conditional` requires a condition. `success` and `failure` are
                              descriptive labels only.
                            </p>
                          </div>
                          <Input
                            value={condition}
                            onChange={(event) =>
                              onDependencyConditionChange(task.id, event.target.value)
                            }
                            placeholder="Edge condition"
                            className={conditionError ? 'border-red-500' : ''}
                          />
                          {conditionError ? (
                            <p className="text-xs text-red-600">Condition {conditionError}</p>
                          ) : null}
                          <WorkflowEdgeMetadataEditor
                            idPrefix={`dependency-edge-${task.id}`}
                            metadataJson={metadataJson}
                            metadataError={metadataError}
                            onChange={(nextMetadataJson) =>
                              onDependencyMetadataChange(task.id, nextMetadataJson)
                            }
                          />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs text-neutral-500">
                          <p>Type: {edgeType}</p>
                          {condition ? <p>Condition: {condition}</p> : null}
                          {metadataJson ? <p>Metadata: {metadataJson}</p> : null}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Required By
            </p>
            {preferredDependentTaskId ? (
              <p className="text-xs text-neutral-500">
                Filled button = preferred downstream path for `Next`.
              </p>
            ) : null}
            {dependentLinks.length === 0 ? (
              <p className="text-sm text-neutral-500">No downstream tasks.</p>
            ) : (
              <div className="space-y-2">
                {dependentLinks.map(
                  ({ task, edgeType, condition, conditionError, metadataJson, metadataError }) => (
                    <div key={task.id} className="rounded-md border border-neutral-200 p-2">
                      <Button
                        type="button"
                        variant={task.id === preferredDependentTaskId ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto max-w-full justify-start whitespace-normal text-left"
                        onClick={() => onSelectDependentTask(task.id)}
                      >
                        {task.id === preferredDependentTaskId
                          ? `Preferred: ${task.name}`
                          : task.name}
                      </Button>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Edge Type</Label>
                            <select
                              value={edgeType}
                              onChange={(event) =>
                                onDependentEdgeTypeChange(task.id, event.target.value)
                              }
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="default">default</option>
                              <option value="conditional">conditional</option>
                              <option value="success">success</option>
                              <option value="failure">failure</option>
                            </select>
                            <p className="text-xs text-neutral-500">
                              `conditional` requires a condition. `success` and `failure` are
                              descriptive labels only.
                            </p>
                          </div>
                          <Input
                            value={condition}
                            onChange={(event) =>
                              onDependentConditionChange(task.id, event.target.value)
                            }
                            placeholder="Edge condition"
                            className={conditionError ? 'border-red-500' : ''}
                          />
                          {conditionError ? (
                            <p className="text-xs text-red-600">Condition {conditionError}</p>
                          ) : null}
                          <WorkflowEdgeMetadataEditor
                            idPrefix={`dependent-edge-${task.id}`}
                            metadataJson={metadataJson}
                            metadataError={metadataError}
                            onChange={(nextMetadataJson) =>
                              onDependentMetadataChange(task.id, nextMetadataJson)
                            }
                          />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs text-neutral-500">
                          <p>Type: {edgeType}</p>
                          {condition ? <p>Condition: {condition}</p> : null}
                          {metadataJson ? <p>Metadata: {metadataJson}</p> : null}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
