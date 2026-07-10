'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { createGraphEdgeId } from '@/modules/react-flow-graph/ids';
import type {
  GraphDocument,
  GraphEdge,
  GraphJsonObject,
  GraphNode,
} from '@/modules/react-flow-graph/types';
import type { GraphInspectorRendererProps } from '@/modules/react-flow-graph/GraphCanvas';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import { Textarea } from '@/components/library/shadcn/textarea';
import {
  workflowGraphEdgeTypes,
  workflowGraphNodeTypes,
} from '@/lib/workflows/workflowGraphAdapter';

const noAgentValue = '__no-agent__';

function readDataString(data: GraphJsonObject | undefined, key: string) {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

function readDataBoolean(data: GraphJsonObject | undefined, key: string) {
  const value = data?.[key];
  return typeof value === 'boolean' ? value : false;
}

function readDataStringArray(data: GraphJsonObject | undefined, key: string) {
  const value = data?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function typeLabel(type: string) {
  if (type === workflowGraphNodeTypes.agent) {
    return 'Agent';
  }

  if (type === workflowGraphNodeTypes.task) {
    return 'Task';
  }

  if (type === workflowGraphNodeTypes.tool) {
    return 'Tool';
  }

  if (type === workflowGraphNodeTypes.memory) {
    return 'Memory';
  }

  if (type === workflowGraphNodeTypes.artifact) {
    return 'Artifact';
  }

  if (type === workflowGraphNodeTypes.approval) {
    return 'Approval';
  }

  if (type === workflowGraphNodeTypes.router) {
    return 'Router';
  }

  if (type === workflowGraphEdgeTypes.dependency) {
    return 'Dependency';
  }

  if (type === workflowGraphEdgeTypes.dataFlow) {
    return 'Data flow';
  }

  if (type === workflowGraphEdgeTypes.condition) {
    return 'Condition';
  }

  if (type === workflowGraphEdgeTypes.assignment) {
    return 'Assignment';
  }

  if (type === workflowGraphEdgeTypes.tool) {
    return 'Tool access';
  }

  if (type === workflowGraphEdgeTypes.memory) {
    return 'Memory access';
  }

  return type;
}

function updateNodeData(node: GraphNode, data: GraphJsonObject): GraphNode {
  return {
    ...node,
    data: {
      ...(node.data ?? {}),
      ...data,
    },
  };
}

function taskIdForNode(node: GraphNode | undefined) {
  return readDataString(node?.data, 'taskId');
}

function agentIdForNode(node: GraphNode | undefined) {
  return readDataString(node?.data, 'agentId');
}

function updateTaskAssignment(
  document: GraphDocument,
  taskNode: GraphNode,
  agentId: string | null
): GraphDocument {
  const nextTaskNode = updateNodeData(taskNode, { agentId });
  const nextNodes = document.nodes.map((node) => (node.id === taskNode.id ? nextTaskNode : node));
  const taskId = taskIdForNode(taskNode);
  const nextEdges = document.edges.filter((edge) => {
    return edge.type !== workflowGraphEdgeTypes.assignment || edge.target !== taskNode.id;
  });

  if (!agentId || !taskId) {
    return {
      ...document,
      nodes: nextNodes,
      edges: nextEdges,
    };
  }

  const agentNode = document.nodes.find(
    (node) => node.type === workflowGraphNodeTypes.agent && agentIdForNode(node) === agentId
  );

  if (!agentNode) {
    return {
      ...document,
      nodes: nextNodes,
      edges: nextEdges,
    };
  }

  return {
    ...document,
    nodes: nextNodes,
    edges: [
      ...nextEdges,
      {
        id: createGraphEdgeId({
          source: agentNode.id,
          target: taskNode.id,
          type: workflowGraphEdgeTypes.assignment,
        }),
        source: agentNode.id,
        target: taskNode.id,
        type: workflowGraphEdgeTypes.assignment,
        data: {
          agentId,
          taskId,
        },
        metadata: {
          source: 'workflowGraphInspector',
        },
      },
    ],
  };
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-neutral-600 dark:text-slate-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReadOnlyReference({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500 dark:text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-neutral-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return <p className="text-xs text-red-600">{children}</p>;
}

function TaskInspector({
  document,
  node,
  readOnly,
  onUpdateDocument,
  onUpdateNode,
}: Pick<
  GraphInspectorRendererProps,
  'document' | 'readOnly' | 'onUpdateDocument' | 'onUpdateNode'
> & {
  node: GraphNode;
}) {
  const taskId = taskIdForNode(node);
  const nameInvalid = !node.label.trim();
  const descriptionInvalid = !node.description?.trim();
  const agentOptions = useMemo(
    () =>
      document.nodes
        .filter((candidate) => candidate.type === workflowGraphNodeTypes.agent)
        .map((candidate) => ({
          id: agentIdForNode(candidate),
          label: candidate.label,
        }))
        .filter((candidate) => candidate.id),
    [document.nodes]
  );

  return (
    <div className="space-y-3">
      <Field id={`${node.id}-name`} label="Name">
        <Input
          id={`${node.id}-name`}
          value={node.label}
          disabled={readOnly}
          onChange={(event) => onUpdateNode({ ...node, label: event.target.value })}
        />
        {nameInvalid ? <FieldError>Each task must have a name.</FieldError> : null}
      </Field>

      <Field id={`${node.id}-description`} label="Description">
        <Textarea
          id={`${node.id}-description`}
          value={node.description ?? ''}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) => onUpdateNode({ ...node, description: event.target.value })}
        />
        {descriptionInvalid ? (
          <FieldError>{`Task "${node.label || taskId}" must have a description.`}</FieldError>
        ) : null}
      </Field>

      <Field id={`${node.id}-instructions`} label="Instructions">
        <Textarea
          id={`${node.id}-instructions`}
          value={readDataString(node.data, 'instructions')}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { instructions: event.target.value }))
          }
        />
      </Field>

      <Field id={`${node.id}-expected-output`} label="Expected output">
        <Textarea
          id={`${node.id}-expected-output`}
          value={readDataString(node.data, 'expectedOutput')}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { expectedOutput: event.target.value }))
          }
        />
      </Field>

      <Field id={`${node.id}-agent`} label="Assigned agent">
        <select
          id={`${node.id}-agent`}
          value={readDataString(node.data, 'agentId') || noAgentValue}
          disabled={readOnly}
          className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:shadow-none"
          onChange={(event) =>
            onUpdateDocument(
              updateTaskAssignment(
                document,
                node,
                event.target.value === noAgentValue ? null : event.target.value
              )
            )
          }
        >
          <option value={noAgentValue}>No agent</option>
          {agentOptions.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${node.id}-approval`}
          checked={readDataBoolean(node.data, 'humanApprovalRequired')}
          disabled={readOnly}
          className="cursor-pointer disabled:cursor-not-allowed"
          onCheckedChange={(checked) =>
            onUpdateNode(updateNodeData(node, { humanApprovalRequired: checked === true }))
          }
        />
        <Label
          htmlFor={`${node.id}-approval`}
          className="cursor-pointer text-xs text-neutral-700 dark:text-slate-300"
        >
          Human approval required
        </Label>
      </div>

      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Task" value={taskId} />
      </dl>
    </div>
  );
}

function AgentInspector({
  node,
  readOnly,
  onUpdateNode,
}: Pick<GraphInspectorRendererProps, 'readOnly' | 'onUpdateNode'> & {
  node: GraphNode;
}) {
  const agentId = agentIdForNode(node);
  const nameInvalid = !node.label.trim();

  return (
    <div className="space-y-3">
      <Field id={`${node.id}-name`} label="Name">
        <Input
          id={`${node.id}-name`}
          value={node.label}
          disabled={readOnly}
          onChange={(event) => onUpdateNode({ ...node, label: event.target.value })}
        />
        {nameInvalid ? <FieldError>Each agent must have a name.</FieldError> : null}
      </Field>

      <Field id={`${node.id}-role`} label="Role">
        <Input
          id={`${node.id}-role`}
          value={readDataString(node.data, 'role')}
          disabled={readOnly}
          onChange={(event) => onUpdateNode(updateNodeData(node, { role: event.target.value }))}
        />
      </Field>

      <Field id={`${node.id}-description`} label="Description">
        <Textarea
          id={`${node.id}-description`}
          value={node.description ?? ''}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) => onUpdateNode({ ...node, description: event.target.value })}
        />
      </Field>

      <Field id={`${node.id}-instructions`} label="Instructions">
        <Textarea
          id={`${node.id}-instructions`}
          value={readDataString(node.data, 'instructions')}
          disabled={readOnly}
          className="min-h-24"
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { instructions: event.target.value }))
          }
        />
      </Field>

      <Field id={`${node.id}-model-profile`} label="Model profile">
        <Input
          id={`${node.id}-model-profile`}
          value={readDataString(node.data, 'modelProfileId')}
          disabled={readOnly}
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { modelProfileId: event.target.value || null }))
          }
        />
      </Field>

      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Agent" value={agentId} />
      </dl>
    </div>
  );
}

function MemoryInspector({
  node,
  readOnly,
  onUpdateNode,
}: Pick<GraphInspectorRendererProps, 'readOnly' | 'onUpdateNode'> & {
  node: GraphNode;
}) {
  const memoryId = readDataString(node.data, 'memoryId');
  const nameInvalid = !node.label.trim();

  return (
    <div className="space-y-3">
      <Field id={`${node.id}-name`} label="Name">
        <Input
          id={`${node.id}-name`}
          value={node.label}
          disabled={readOnly}
          onChange={(event) => onUpdateNode({ ...node, label: event.target.value })}
        />
        {nameInvalid ? <FieldError>Each memory node must have a name.</FieldError> : null}
      </Field>

      <Field id={`${node.id}-description`} label="Description">
        <Textarea
          id={`${node.id}-description`}
          value={node.description ?? ''}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) => onUpdateNode({ ...node, description: event.target.value })}
        />
      </Field>

      <Field id={`${node.id}-memory-type`} label="Memory type">
        <Input
          id={`${node.id}-memory-type`}
          value={readDataString(node.data, 'memoryType')}
          disabled={readOnly}
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { memoryType: event.target.value || null }))
          }
        />
      </Field>

      <Field id={`${node.id}-scope`} label="Scope">
        <Input
          id={`${node.id}-scope`}
          value={readDataString(node.data, 'scope')}
          disabled={readOnly}
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { scope: event.target.value || null }))
          }
        />
      </Field>

      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Memory" value={memoryId} />
      </dl>
    </div>
  );
}

function ArtifactInspector({
  node,
  readOnly,
  onUpdateNode,
}: Pick<GraphInspectorRendererProps, 'readOnly' | 'onUpdateNode'> & {
  node: GraphNode;
}) {
  const artifactId = readDataString(node.data, 'artifactId');
  const producerTaskId = readDataString(node.data, 'producerTaskId');
  const nameInvalid = !node.label.trim();

  return (
    <div className="space-y-3">
      <Field id={`${node.id}-name`} label="Name">
        <Input
          id={`${node.id}-name`}
          value={node.label}
          disabled={readOnly}
          onChange={(event) => onUpdateNode({ ...node, label: event.target.value })}
        />
        {nameInvalid ? <FieldError>Each artifact node must have a name.</FieldError> : null}
      </Field>

      <Field id={`${node.id}-description`} label="Description">
        <Textarea
          id={`${node.id}-description`}
          value={node.description ?? ''}
          disabled={readOnly}
          className="min-h-20"
          onChange={(event) => onUpdateNode({ ...node, description: event.target.value })}
        />
      </Field>

      <Field id={`${node.id}-artifact-type`} label="Artifact type">
        <Input
          id={`${node.id}-artifact-type`}
          value={readDataString(node.data, 'artifactType')}
          disabled={readOnly}
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { artifactType: event.target.value || null }))
          }
        />
      </Field>

      <Field id={`${node.id}-media-type`} label="Media type">
        <Input
          id={`${node.id}-media-type`}
          value={readDataString(node.data, 'mediaType')}
          disabled={readOnly}
          onChange={(event) =>
            onUpdateNode(updateNodeData(node, { mediaType: event.target.value || null }))
          }
        />
      </Field>

      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Artifact" value={artifactId} />
        <ReadOnlyReference label="Producer task" value={producerTaskId} />
      </dl>
    </div>
  );
}

function EdgeInspector({
  edge,
  readOnly,
  onUpdateEdge,
}: Pick<GraphInspectorRendererProps, 'readOnly' | 'onUpdateEdge'> & {
  edge: GraphEdge;
}) {
  const [metadataText, setMetadataText] = useState(() =>
    JSON.stringify(edge.metadata ?? {}, null, 2)
  );
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const editableEdge =
    edge.type === workflowGraphEdgeTypes.dependency ||
    edge.type === workflowGraphEdgeTypes.dataFlow ||
    edge.type === workflowGraphEdgeTypes.condition;
  const conditionInvalid = edge.type === workflowGraphEdgeTypes.condition && !edge.label?.trim();

  const applyMetadata = () => {
    try {
      const parsed = JSON.parse(metadataText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setMetadataError('Metadata must be a JSON object.');
        return;
      }

      setMetadataError(null);
      onUpdateEdge({ ...edge, metadata: parsed as GraphJsonObject });
    } catch {
      setMetadataError('Metadata must be valid JSON.');
    }
  };

  return (
    <div className="space-y-3">
      {editableEdge ? (
        <>
          <Field id={`${edge.id}-type`} label="Edge type">
            <select
              id={`${edge.id}-type`}
              value={edge.type}
              disabled={readOnly}
              className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:shadow-none"
              onChange={(event) =>
                onUpdateEdge({
                  ...edge,
                  type: event.target.value,
                  data: {
                    ...(edge.data ?? {}),
                    edgeType:
                      event.target.value === workflowGraphEdgeTypes.condition
                        ? 'conditional'
                        : 'default',
                  },
                })
              }
            >
              <option value={workflowGraphEdgeTypes.dependency}>Dependency</option>
              <option value={workflowGraphEdgeTypes.condition}>Condition</option>
              <option value={workflowGraphEdgeTypes.dataFlow}>Data flow</option>
            </select>
          </Field>

          <Field id={`${edge.id}-condition`} label="Condition">
            <Input
              id={`${edge.id}-condition`}
              value={edge.label ?? ''}
              disabled={readOnly}
              onChange={(event) => onUpdateEdge({ ...edge, label: event.target.value })}
            />
            {conditionInvalid ? (
              <FieldError>Condition is required when edge type is conditional.</FieldError>
            ) : null}
          </Field>
        </>
      ) : null}

      <Field id={`${edge.id}-metadata`} label="Metadata JSON">
        <Textarea
          id={`${edge.id}-metadata`}
          value={metadataText}
          disabled={readOnly}
          className="min-h-24 font-mono text-xs"
          onBlur={applyMetadata}
          onChange={(event) => setMetadataText(event.target.value)}
        />
      </Field>
      {metadataError ? <FieldError>{metadataError}</FieldError> : null}

      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Source" value={edge.source} />
        <ReadOnlyReference label="Target" value={edge.target} />
      </dl>
    </div>
  );
}

function ReadOnlyInspector({ node, edge }: Pick<GraphInspectorRendererProps, 'node' | 'edge'>) {
  const taskId = readDataString(node?.data, 'taskId');
  const agentId = readDataString(node?.data, 'agentId') || readDataString(edge?.data, 'agentId');
  const toolId = readDataString(node?.data, 'toolId') || readDataString(edge?.data, 'toolId');
  const toolIds = [
    ...readDataStringArray(node?.data, 'toolIds'),
    ...readDataStringArray(edge?.data, 'toolIds'),
  ];
  const memoryId = readDataString(node?.data, 'memoryId') || readDataString(edge?.data, 'memoryId');

  return (
    <div className="space-y-3">
      {node?.description ? (
        <p className="text-sm leading-6 text-neutral-600 dark:text-slate-300">{node.description}</p>
      ) : null}
      <dl className="grid gap-2 text-xs">
        <ReadOnlyReference label="Task" value={taskId} />
        <ReadOnlyReference label="Agent" value={agentId} />
        <ReadOnlyReference
          label={toolIds.length > 1 ? 'Tools' : 'Tool'}
          value={toolIds.length > 0 ? toolIds.join(', ') : toolId}
        />
        <ReadOnlyReference label="Memory" value={memoryId} />
        {edge ? (
          <>
            <ReadOnlyReference label="Source" value={edge.source} />
            <ReadOnlyReference label="Target" value={edge.target} />
          </>
        ) : null}
      </dl>
    </div>
  );
}

export default function WorkflowGraphInspector(props: GraphInspectorRendererProps) {
  const { node, edge, onClose, readOnly } = props;

  if (!node && !edge) {
    return null;
  }

  const title = node?.label ?? edge?.label ?? 'Connection';
  const type = node?.type ?? edge?.type ?? 'workflow';
  const canEditTask = node?.type === workflowGraphNodeTypes.task;
  const canEditAgent = node?.type === workflowGraphNodeTypes.agent;
  const canEditMemory = node?.type === workflowGraphNodeTypes.memory;
  const canEditArtifact = node?.type === workflowGraphNodeTypes.artifact;
  const canEditEdge = Boolean(edge);

  return (
    <div className="max-h-[calc(100vh-7rem)] space-y-3 overflow-y-auto pr-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline">{typeLabel(type)}</Badge>
          <h3 className="mt-2 truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">
            {title}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {canEditTask && node ? (
        <TaskInspector {...props} node={node} />
      ) : canEditAgent && node ? (
        <AgentInspector {...props} node={node} />
      ) : canEditMemory && node ? (
        <MemoryInspector {...props} node={node} />
      ) : canEditArtifact && node ? (
        <ArtifactInspector {...props} node={node} />
      ) : canEditEdge && edge ? (
        <EdgeInspector key={edge.id} {...props} edge={edge} />
      ) : (
        <ReadOnlyInspector node={node} edge={edge} />
      )}

      {readOnly ? (
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Switch to edit mode to modify this item.
        </p>
      ) : null}
    </div>
  );
}
