'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
  runsApi,
  runtimeAdaptersApi,
  schedulesApi,
  toolsApi,
  workflowsApi,
} from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import {
  normalizeWorkflowAgentDefinition,
  resolveWorkflowExecutionHost,
} from '@/lib/workflows/executionPayload';
import { toolDisplayName } from '@/lib/tools/displayName';
import { rebuildWorkflowGraph } from '@/lib/workflows/workflowDefinitionMutations';
import {
  applyGraphNodePositions,
  resolveRestartActiveExecutions,
  useWorkflowEditorDraft,
} from '@/components/workflow-app/useWorkflowEditorDraft';
import WorkflowBuilderPanel from '@/components/workflow-app/WorkflowBuilderPanel';
import WorkflowDetailHeader from '@/components/workflow-app/WorkflowDetailHeader';
import WorkflowDetailStatus from '@/components/workflow-app/WorkflowDetailStatus';
import WorkflowMetadataEditor from '@/components/workflow-app/WorkflowMetadataEditor';
import WorkflowMonitoringControls from '@/components/workflow-app/WorkflowMonitoringControls';
import WorkflowMonitoringProposals from '@/components/workflow-app/WorkflowMonitoringProposals';
import WorkflowRuntimeAdapterPanel from '@/components/workflow-app/WorkflowRuntimeAdapterPanel';
import WorkflowRunsPanel from '@/components/workflow-app/WorkflowRunsPanel';
import WorkflowSchedulesPanel from '@/components/workflow-app/WorkflowSchedulesPanel';
import WorkflowSharedMemoryControls from '@/components/workflow-app/WorkflowSharedMemoryControls';
import WorkflowTaskFocusPanel from '@/components/workflow-app/WorkflowTaskFocusPanel';
import WorkflowEdgeFocusPanel from '@/components/workflow-app/WorkflowEdgeFocusPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../library/shadcn/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../library/shadcn/sheet';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import WorkflowGraphComposer from '@/components/workflow-app/WorkflowGraphComposer';
import { toast } from 'sonner';
import type { ToolDefinition } from '@/types/tools';
import { localUser } from '@/lib/identity/localUser';

type WorkflowTab = 'builder' | 'graph' | 'runs';

function isWorkflowTab(value: string | null): value is WorkflowTab {
  return value === 'builder' || value === 'graph' || value === 'runs';
}

function isWorkflowMode(value: string | null): value is 'edit' {
  return value === 'edit';
}

function mergeToolDefinitions(...toolGroups: ToolDefinition[][]) {
  const toolById = new Map<string, ToolDefinition>();
  toolGroups.flat().forEach((tool) => {
    toolById.set(tool.id, tool);
  });
  return Array.from(toolById.values());
}

function toolDefinitionsForAssignedAgents(
  agents: Array<{ tool_ids?: string[] }>,
  workflowTools: ToolDefinition[],
  availableTools: ToolDefinition[]
) {
  const availableToolById = new Map(
    mergeToolDefinitions(workflowTools, availableTools).map((tool) => [tool.id, tool])
  );
  const assignedToolIds = new Set(agents.flatMap((agent) => agent.tool_ids ?? []));
  return Array.from(assignedToolIds)
    .map((toolId) => availableToolById.get(toolId))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}

export default function WorkflowDetailWorkspace({ workflowId }: { workflowId: string }) {
  const actorUserId = localUser.id;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const workflowQuery = useQuery({
    queryKey: queryKeys.backendWorkflow(workflowId),
    queryFn: () => workflowsApi.getWorkflow(workflowId),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowRuns(workflowId),
    queryFn: () => runsApi.listRunsForWorkflow(workflowId),
  });
  const monitoringEventsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
    queryFn: () => workflowsApi.listWorkflowMonitoringEvents(workflowId),
  });
  const sharedMemoryQuery = useQuery({
    queryKey: queryKeys.backendWorkflowSharedMemory(workflowId),
    queryFn: () => workflowsApi.getWorkflowSharedMemory(workflowId),
  });
  const schedulesQuery = useQuery({
    queryKey: queryKeys.backendWorkflowSchedules(workflowId),
    queryFn: async () => {
      const response = await schedulesApi.listSchedules();
      return response.items.filter((schedule) => schedule.workflow_id === workflowId);
    },
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgents(),
    queryFn: async () => {
      const response = await agentsApi.listAgents();
      return response.items;
    },
  });
  const runtimeAdaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => runtimeAdaptersApi.listRuntimeAdapters(),
  });
  const toolsQuery = useQuery({
    queryKey: queryKeys.tools(),
    queryFn: async () => {
      const response = await toolsApi.listTools();
      return response.items;
    },
  });

  const requestedTab = searchParams.get('tab');
  const activeTab: WorkflowTab = isWorkflowTab(requestedTab) ? requestedTab : 'builder';
  const requestedMode = searchParams.get('mode');
  const activeMode: 'edit' | null = isWorkflowMode(requestedMode) ? requestedMode : null;
  const isEditModeRequested = activeMode === 'edit';
  const requestedTaskId = searchParams.get('task');
  const requestedEdgeId = searchParams.get('edge');
  const [selectedRunRuntimeAdapterId, setSelectedRunRuntimeAdapterId] = useState('');
  const [selectedExecutionHost, setSelectedExecutionHost] = useState<'local' | 'docker'>('local');
  const [restartActiveExecutionsOverride, setRestartActiveExecutionsOverride] = useState<boolean | null>(null);
  const [monitoringExemptionReason, setMonitoringExemptionReason] = useState('');
  const suppressEditModeStartRef = useRef(false);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const normalizedAgentDefinitions = agentDefinitions.map((agent) => {
        const agentDefinition = { ...agent };
        delete agentDefinition.objective;
        return normalizeWorkflowAgentDefinition({
          ...agentDefinition,
          name: agent.name?.trim() || agent.id,
          description: agent.description?.trim() || null,
          instructions: agent.instructions?.trim() || null,
          system_prompt: agent.system_prompt?.trim() || null,
          role: agent.role?.trim() || null,
          backstory: agent.backstory?.trim() || null,
        });
      });
      const normalizedTaskDefinitions = taskDefinitions.map((task) => ({
        ...task,
        name: task.name?.trim() || task.id,
        description: task.description?.trim() || '',
        instructions: task.instructions?.trim() || task.description?.trim() || '',
        expected_output: task.expected_output?.trim() || null,
      }));
      const assignedToolDefinitions = toolDefinitionsForAssignedAgents(
        normalizedAgentDefinitions,
        workflow?.tool_definitions ?? [],
        toolsQuery.data ?? []
      );
      const rebuiltWorkflow = rebuildWorkflowGraph({
        ...workflow,
        id: workflowId,
        name: name.trim(),
        description: description.trim() || null,
        entrypoint: entrypoint.trim() || undefined,
        default_runtime_adapter_id: defaultRuntimeAdapterId.trim() || null,
        allowed_runtime_adapter_ids: allowedRuntimeAdapterIds,
        agent_definitions: normalizedAgentDefinitions,
        task_definitions: normalizedTaskDefinitions,
        tool_definitions: mergeToolDefinitions(
          workflow?.tool_definitions ?? [],
          assignedToolDefinitions
        ),
        metadata: {
          ...(workflow?.metadata ?? {}),
          execution_host: executionHost,
          restart_active_executions: restartActiveExecutions,
        },
      });
      const nextWorkflow = applyGraphNodePositions(rebuiltWorkflow, graphNodePositions);
      await workflowsApi.updateWorkflow(workflowId, nextWorkflow);
      return nextWorkflow;
    },
    onSuccess: async (nextWorkflow) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), nextWorkflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
      suppressEditModeStartRef.current = true;
      stopEditing();
      updateWorkflowUrl({ nextMode: null });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        restart_active_executions: effectiveRestartActiveExecutions,
      };
      if (workflow?.versioning?.is_published) {
        return workflowsApi.unpublishWorkflow(workflowId, payload);
      }
      return workflowsApi.publishWorkflow(workflowId, payload);
    },
    onSuccess: async (nextWorkflow) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), nextWorkflow);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
    },
  });

  const updateMonitoringMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workflowsApi.updateWorkflowMonitoring(workflowId, patch),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
    },
  });

  const updateSharedMemoryMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workflowsApi.updateWorkflowSharedMemory(workflowId, patch),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      queryClient.setQueryData(queryKeys.backendWorkflowSharedMemory(workflowId), response.shared_memory);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowSharedMemory(workflowId) }),
      ]);
    },
  });

  const monitorApprovalMutation = useMutation({
    mutationFn: async ({
      approvalRequestId,
      action,
      reason,
    }: {
      approvalRequestId: string;
      action: 'approve' | 'reject' | 'request_changes' | 'split';
      reason?: string | null;
    }) => {
      if (action === 'approve') {
        return conversationsApi.approveApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
        });
      }
      if (action === 'reject') {
        return conversationsApi.rejectApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
        });
      }
      if (action === 'request_changes') {
        return conversationsApi.requestChangesToApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
        });
      }
      return conversationsApi.splitApprovalRequest(approvalRequestId, {
        user_id: actorUserId,
        reason,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId) }),
      ]);
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const schedule = schedulesQuery.data?.find((item) => item.id === scheduleId);
      if (schedule?.enabled) {
        return schedulesApi.disableSchedule(scheduleId);
      }
      return schedulesApi.enableSchedule(scheduleId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, patch }: { scheduleId: string; patch: Record<string, unknown> }) =>
      schedulesApi.patchSchedule(scheduleId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const triggerScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => schedulesApi.triggerNow(scheduleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowSchedules(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowRuns(workflowId) }),
      ]);
    },
  });

  const workflow = workflowQuery.data;
  const {
    state: {
      agentDefinitions,
      allowedRuntimeAdapterIds,
      defaultRuntimeAdapterId,
      description,
      edgeMetadataByTaskPair,
      entrypoint,
      executionHost,
      graphNodePositions,
      isEditing,
      name,
      restartActiveExecutions,
      taskDefinitions,
    },
    derived: {
      currentGraphNodePositions,
      draftValidationIssues,
      effectiveEntrypointTaskId,
      hasUnsavedChanges,
      invalidEdgeConditionByTaskPair,
      invalidEdgeMetadataByTaskPair,
      visibleAgentDefinitions,
      visibleTaskDefinitions,
      workflowDescriptionInvalid,
      workflowKickoffInputs,
      workflowNameInvalid,
      workflowPreview,
    },
    actions: {
      addAgentDefinition,
      addExistingAgentDefinition,
      addTaskDefinition,
      connectTaskDependency,
      disconnectTaskDependency,
      moveTaskDefinition,
      removeAgentDefinition,
      removeTaskDefinition,
      setDescription,
      setEntrypoint,
      setExecutionHost,
      setGraphNodePositions,
      setName,
      setRestartActiveExecutions,
      startEditing,
      stopEditing,
      toggleAllowedRuntimeAdapter,
      updateAgentDefinition,
      updateEdgeMetadata,
      updateTaskDefinition,
    },
  } = useWorkflowEditorDraft({ workflow, workflowId });
  const savedRestartActiveExecutions = resolveRestartActiveExecutions(workflow);
  const effectiveRestartActiveExecutions = isEditing
    ? restartActiveExecutions
    : restartActiveExecutionsOverride ?? savedRestartActiveExecutions;

  useEffect(() => {
    setRestartActiveExecutionsOverride(null);
  }, [workflowId, savedRestartActiveExecutions]);

  useEffect(() => {
    setMonitoringExemptionReason(
      typeof workflow?.monitoring?.reason === 'string' ? workflow.monitoring.reason : ''
    );
  }, [workflow?.monitoring?.reason, workflowId]);

  useEffect(() => {
    if (workflow && isEditModeRequested && !isEditing && !suppressEditModeStartRef.current) {
      startEditing();
    }
  }, [workflow, isEditModeRequested, isEditing, startEditing]);

  useEffect(() => {
    if (!isEditModeRequested) {
      suppressEditModeStartRef.current = false;
    }
  }, [isEditModeRequested]);

  const workflowLoaded = Boolean(workflow);
  const selectedTaskStillExists = requestedTaskId
    ? !workflowLoaded || visibleTaskDefinitions.some((task) => task.id === requestedTaskId)
    : false;
  const selectedEdgeStillExists = requestedEdgeId
    ? !workflowLoaded ||
      visibleTaskDefinitions.some((task) =>
        (task.depends_on_task_ids ?? []).some(
          (dependencyId) => `${dependencyId}->${task.id}` === requestedEdgeId
        )
      )
    : false;

  const updateWorkflowUrl = useCallback(
    ({
      nextTab = activeTab,
      nextMode = activeMode,
      nextTaskId = requestedTaskId,
      nextEdgeId = requestedEdgeId,
    }: {
      nextTab?: WorkflowTab;
      nextMode?: 'edit' | null;
      nextTaskId?: string | null;
      nextEdgeId?: string | null;
    }) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      if (nextTab === 'builder') {
        nextSearchParams.delete('tab');
      } else {
        nextSearchParams.set('tab', nextTab);
      }

      if (nextMode === 'edit') {
        nextSearchParams.set('mode', 'edit');
      } else {
        nextSearchParams.delete('mode');
      }

      if (nextTaskId) {
        nextSearchParams.set('task', nextTaskId);
      } else {
        nextSearchParams.delete('task');
      }

      if (nextEdgeId) {
        nextSearchParams.set('edge', nextEdgeId);
      } else {
        nextSearchParams.delete('edge');
      }

      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [activeMode, activeTab, pathname, requestedEdgeId, requestedTaskId, router, searchParams]
  );

  useEffect(() => {
    if (workflowLoaded && requestedTaskId && !selectedTaskStillExists) {
      updateWorkflowUrl({ nextTaskId: null });
    }
  }, [requestedTaskId, selectedTaskStillExists, updateWorkflowUrl, workflowLoaded]);

  useEffect(() => {
    if (workflowLoaded && requestedEdgeId && !selectedEdgeStillExists) {
      updateWorkflowUrl({ nextEdgeId: null });
    }
  }, [requestedEdgeId, selectedEdgeStillExists, updateWorkflowUrl, workflowLoaded]);

  const behaviorProfiles = profilesQuery.data ?? [];
  const availableAgentDefinitions = (agentsQuery.data ?? []).filter(
    (agent) => !visibleAgentDefinitions.some((candidate) => candidate.id === agent.id)
  );
  const runtimeAdapters = runtimeAdaptersQuery.data?.items ?? [];
  const defaultExecutionHost = resolveWorkflowExecutionHost(workflow);
  const {
    runnableRuntimeAdapters,
    preferredRuntimeAdapterId,
    launchMutation: executeMutation,
    launchWorkflow,
  } = useWorkflowRunLauncher({
    workflowId,
    workflow,
    runtimeAdapters,
    redirectTo: (runId) => `/runs/${runId}?workflowId=${workflowId}&tab=runs`,
  });
  const workflowToolDefinitions = workflow?.tool_definitions ?? [];
  const assignableToolDefinitions = mergeToolDefinitions(
    workflowToolDefinitions,
    toolsQuery.data ?? []
  );
  const toolMap = new Map(assignableToolDefinitions.map((tool) => [tool.id, tool]));
  const agentMap = new Map(visibleAgentDefinitions.map((agent) => [agent.id, agent]));
  const selectedTaskId =
    requestedTaskId && visibleTaskDefinitions.some((task) => task.id === requestedTaskId)
      ? requestedTaskId
      : null;
  const selectedEdgeId = requestedEdgeId && selectedEdgeStillExists ? requestedEdgeId : null;
  const selectedTask = selectedTaskId
    ? (visibleTaskDefinitions.find((task) => task.id === selectedTaskId) ?? null)
    : null;
  const selectedTaskAgent = selectedTask?.agent_id
    ? (agentMap.get(selectedTask.agent_id) ?? null)
    : null;
  const selectedEdgeTasks = selectedEdgeId
    ? (() => {
        const [sourceTaskId, targetTaskId] = selectedEdgeId.split('->');
        const sourceTask = visibleTaskDefinitions.find((task) => task.id === sourceTaskId) ?? null;
        const targetTask = visibleTaskDefinitions.find((task) => task.id === targetTaskId) ?? null;
        return sourceTask && targetTask ? { sourceTask, targetTask } : null;
      })()
    : null;
  const selectedEdgeMetadata = selectedEdgeId
    ? (edgeMetadataByTaskPair[selectedEdgeId] ?? {
        edgeType: 'default',
        condition: '',
        metadataJson: '',
      })
    : null;
  const selectedTaskIndex = selectedTaskId
    ? visibleTaskDefinitions.findIndex((task) => task.id === selectedTaskId)
    : -1;
  const fallbackPreviousTask =
    selectedTaskIndex > 0 ? visibleTaskDefinitions[selectedTaskIndex - 1] : null;
  const fallbackNextTask =
    selectedTaskIndex >= 0 && selectedTaskIndex < visibleTaskDefinitions.length - 1
      ? visibleTaskDefinitions[selectedTaskIndex + 1]
      : null;
  const dependencyTasks = selectedTask
    ? visibleTaskDefinitions.filter((task) =>
        (selectedTask.depends_on_task_ids ?? []).includes(task.id)
      )
    : [];
  const dependentTasks = selectedTask
    ? visibleTaskDefinitions.filter((task) =>
        (task.depends_on_task_ids ?? []).includes(selectedTask.id)
      )
    : [];
  const dependencyLinks = dependencyTasks.map((task) => ({
    task,
    edgeType: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.edgeType || 'default',
    condition: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.condition || '',
    conditionError: invalidEdgeConditionByTaskPair[`${task.id}->${selectedTask?.id}`],
    metadataJson: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.metadataJson || '',
    metadataError: invalidEdgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`],
  }));
  const dependentLinks = dependentTasks.map((task) => ({
    task,
    edgeType: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.edgeType || 'default',
    condition: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.condition || '',
    conditionError: invalidEdgeConditionByTaskPair[`${selectedTask?.id}->${task.id}`],
    metadataJson: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.metadataJson || '',
    metadataError: invalidEdgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`],
  }));
  const previousTask = dependencyTasks[dependencyTasks.length - 1] ?? fallbackPreviousTask;
  const nextTask = dependentTasks[0] ?? fallbackNextTask;
  const previousTaskLabel = previousTask
    ? `${dependencyTasks.length > 0 ? 'Upstream' : 'Previous'}: ${previousTask.name}`
    : null;
  const nextTaskLabel = nextTask
    ? `${dependentTasks.length > 0 ? 'Downstream' : 'Next'}: ${nextTask.name}`
    : null;
  const toolsUsed =
    Array.from(
      new Set(
        visibleAgentDefinitions.flatMap((agent) =>
          (agent.tool_ids ?? [])
            .map((toolId) => {
              const tool = toolMap.get(toolId);
              return tool ? toolDisplayName(tool) : toolId;
            })
            .filter(Boolean)
        )
      )
    ).join(' • ') || 'NIL';

  useEffect(() => {
    if (!preferredRuntimeAdapterId) {
      if (selectedRunRuntimeAdapterId) {
        setSelectedRunRuntimeAdapterId('');
      }
      return;
    }

    if (
      !selectedRunRuntimeAdapterId ||
      !runnableRuntimeAdapters.some((adapter) => adapter.id === selectedRunRuntimeAdapterId)
    ) {
      setSelectedRunRuntimeAdapterId(preferredRuntimeAdapterId);
    }
  }, [preferredRuntimeAdapterId, selectedRunRuntimeAdapterId, runnableRuntimeAdapters]);

  useEffect(() => {
    setSelectedExecutionHost(defaultExecutionHost);
  }, [defaultExecutionHost]);

  const selectAdjacentTask = (direction: 'previous' | 'next') => {
    if (!selectedTask) {
      const fallbackTask =
        direction === 'next'
          ? visibleTaskDefinitions[0]
          : visibleTaskDefinitions[visibleTaskDefinitions.length - 1];
      if (fallbackTask) {
        updateWorkflowUrl({ nextTaskId: fallbackTask.id });
      }
      return;
    }

    const targetTask = direction === 'previous' ? previousTask : nextTask;
    if (targetTask) {
      updateWorkflowUrl({ nextTaskId: targetTask.id });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!selectedTask) {
          const fallbackTask = visibleTaskDefinitions[visibleTaskDefinitions.length - 1];
          if (fallbackTask) {
            updateWorkflowUrl({ nextTaskId: fallbackTask.id });
          }
          return;
        }

        if (previousTask) {
          updateWorkflowUrl({ nextTaskId: previousTask.id });
        }
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!selectedTask) {
          const fallbackTask = visibleTaskDefinitions[0];
          if (fallbackTask) {
            updateWorkflowUrl({ nextTaskId: fallbackTask.id });
          }
          return;
        }

        if (nextTask) {
          updateWorkflowUrl({ nextTaskId: nextTask.id });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextTask, previousTask, selectedTask, updateWorkflowUrl, visibleTaskDefinitions]);

  if (workflowQuery.isLoading) {
    return <LoadingCard title="Workflow" description="Native / Container workflow details" />;
  }

  if (workflowQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load workflow"
        message={workflowQuery.error.message}
        onRetry={() => workflowQuery.refetch()}
      />
    );
  }

  if (runtimeAdaptersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load runtime adapters"
        message={runtimeAdaptersQuery.error.message}
        onRetry={() => runtimeAdaptersQuery.refetch()}
      />
    );
  }

  if (!workflow) {
    return (
      <EmptyCard
        title="Workflow not found"
        description="The backend returned no workflow detail for this ID."
      />
    );
  }
  const resolvedWorkflowPreview = workflowPreview ?? workflow;
  const isWorkflowPublished = workflow.versioning?.is_published === true;

  const handleSave = async () => {
    if (draftValidationIssues.length > 0) {
      toast.error('Fix the workflow validation issues before saving.', { position: 'top-right' });
      return;
    }

    await toast.promise(updateMutation.mutateAsync(), {
      loading: 'Saving workflow changes...',
      success: 'Workflow updated.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to update workflow.'),
      position: 'top-right',
    });
  };

  const handlePublish = async () => {
    await toast.promise(publishMutation.mutateAsync(), {
      loading: isWorkflowPublished ? 'Unpublishing workflow...' : 'Publishing workflow...',
      success: isWorkflowPublished ? 'Workflow unpublished.' : 'Workflow published.',
      error: (error) =>
        error instanceof Error
          ? error.message
          : `Failed to ${isWorkflowPublished ? 'unpublish' : 'publish'} workflow.`,
      position: 'top-right',
    });
  };

  const handleMonitoringEnabledChange = (checked: boolean) => {
    const patch = checked
      ? { enabled: true }
      : {
          enabled: false,
          reason:
            monitoringExemptionReason.trim() ||
            'Human-managed workflow; do not monitor automatically.',
        };
    void toast.promise(updateMonitoringMutation.mutateAsync(patch), {
      loading: 'Updating monitoring controls...',
      success: checked ? 'Workflow monitoring enabled.' : 'Workflow monitoring disabled.',
      error: (error) =>
        error instanceof Error ? error.message : 'Failed to update monitoring controls.',
      position: 'top-right',
    });
  };

  const handleExemptionReasonSave = () => {
    if (workflow?.monitoring?.enabled !== false) {
      return;
    }
    void toast.promise(
      updateMonitoringMutation.mutateAsync({
        enabled: false,
        reason:
          monitoringExemptionReason.trim() ||
          'Human-managed workflow; do not monitor automatically.',
      }),
      {
        loading: 'Saving exemption reason...',
        success: 'Exemption reason saved.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to save exemption reason.',
        position: 'top-right',
      }
    );
  };

  const handleAllowSelfMonitoringChange = (checked: boolean) => {
    void toast.promise(
      updateMonitoringMutation.mutateAsync({ allow_self_monitoring: checked }),
      {
        loading: 'Updating monitoring controls...',
        success: checked ? 'Self-monitoring enabled.' : 'Self-monitoring disabled.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to update monitoring controls.',
        position: 'top-right',
      }
    );
  };

  const handleSharedMemoryEnabledChange = (checked: boolean, applyToAgents: boolean) => {
    void toast.promise(
      updateSharedMemoryMutation.mutateAsync({
        enabled: checked,
        apply_to_agents: applyToAgents,
      }),
      {
        loading: 'Updating shared memory...',
        success: checked ? 'Shared memory enabled.' : 'Shared memory disabled.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to update shared memory.',
        position: 'top-right',
      }
    );
  };

  const handleMonitorApprovalDecision = (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split'
  ) => {
    const reason =
      action === 'approve'
        ? 'Approved from workflow monitoring panel.'
        : window.prompt(
            action === 'reject'
              ? 'Reason for rejecting this monitor proposal?'
              : action === 'request_changes'
                ? 'What should the main agent revise?'
                : 'Why split this proposal into separate approval requests?',
            ''
          );
    if (reason === null) {
      return;
    }

    const labels = {
      approve: ['Applying approved proposal...', 'Monitor proposal approved.'],
      reject: ['Rejecting proposal...', 'Monitor proposal rejected.'],
      request_changes: ['Requesting proposal changes...', 'Changes requested.'],
      split: ['Splitting proposal...', 'Proposal split into separate approvals.'],
    } as const;
    const [loading, success] = labels[action];

    void toast.promise(
      monitorApprovalMutation.mutateAsync({
        approvalRequestId,
        action,
        reason: reason.trim() || null,
      }),
      {
        loading,
        success,
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to update monitor proposal approval.',
        position: 'top-right',
      }
    );
  };

  const handleRefresh = async () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('Discard unsaved workflow changes and refresh from the backend?')
    ) {
      return;
    }

    if (isEditing) {
      suppressEditModeStartRef.current = true;
      stopEditing();
      updateWorkflowUrl({ nextMode: null });
    }

    await Promise.all([workflowQuery.refetch(), runsQuery.refetch(), schedulesQuery.refetch()]);
  };

  const handleTabChange = (nextTab: string) => {
    if (!isWorkflowTab(nextTab) || nextTab === activeTab) {
      return;
    }

    updateWorkflowUrl({ nextTab });
  };

  const renderSelectedTaskPanel = () =>
    selectedTask ? (
      <WorkflowTaskFocusPanel
        selectedTask={selectedTask}
        selectedAgent={selectedTaskAgent}
        dependencyLinks={dependencyLinks}
        dependentLinks={dependentLinks}
        preferredDependencyTaskId={
          dependencyTasks.some((task) => task.id === previousTask?.id)
            ? (previousTask?.id ?? null)
            : null
        }
        preferredDependentTaskId={
          dependentTasks.some((task) => task.id === nextTask?.id) ? (nextTask?.id ?? null) : null
        }
        previousTaskLabel={previousTaskLabel}
        nextTaskLabel={nextTaskLabel}
        isEditing={isEditing}
        onClearSelection={() => updateWorkflowUrl({ nextTaskId: null })}
        onDependencyEdgeTypeChange={(taskId, edgeType) =>
          updateEdgeMetadata(taskId, selectedTask.id, { edgeType })
        }
        onDependencyConditionChange={(taskId, condition) =>
          updateEdgeMetadata(taskId, selectedTask.id, { condition })
        }
        onDependencyMetadataChange={(taskId, metadataJson) =>
          updateEdgeMetadata(taskId, selectedTask.id, { metadataJson })
        }
        onDependentEdgeTypeChange={(taskId, edgeType) =>
          updateEdgeMetadata(selectedTask.id, taskId, { edgeType })
        }
        onDependentConditionChange={(taskId, condition) =>
          updateEdgeMetadata(selectedTask.id, taskId, { condition })
        }
        onDependentMetadataChange={(taskId, metadataJson) =>
          updateEdgeMetadata(selectedTask.id, taskId, { metadataJson })
        }
        onSelectDependencyTask={(taskId) => updateWorkflowUrl({ nextTaskId: taskId })}
        onSelectDependentTask={(taskId) => updateWorkflowUrl({ nextTaskId: taskId })}
        onSelectPreviousTask={() => selectAdjacentTask('previous')}
        onSelectNextTask={() => selectAdjacentTask('next')}
      />
    ) : null;

  const renderSelectedEdgePanel = () =>
    selectedEdgeTasks && selectedEdgeMetadata ? (
      <WorkflowEdgeFocusPanel
        sourceTask={selectedEdgeTasks.sourceTask}
        targetTask={selectedEdgeTasks.targetTask}
        edgeType={selectedEdgeMetadata.edgeType}
        condition={selectedEdgeMetadata.condition}
        metadataJson={selectedEdgeMetadata.metadataJson}
        conditionError={invalidEdgeConditionByTaskPair[selectedEdgeId ?? '']}
        metadataError={invalidEdgeMetadataByTaskPair[selectedEdgeId ?? '']}
        isEditing={isEditing}
        onClearSelection={() => updateWorkflowUrl({ nextEdgeId: null })}
        onSelectSourceTask={() =>
          updateWorkflowUrl({ nextTaskId: selectedEdgeTasks.sourceTask.id, nextEdgeId: null })
        }
        onSelectTargetTask={() =>
          updateWorkflowUrl({ nextTaskId: selectedEdgeTasks.targetTask.id, nextEdgeId: null })
        }
        onEdgeTypeChange={(edgeType) =>
          updateEdgeMetadata(selectedEdgeTasks.sourceTask.id, selectedEdgeTasks.targetTask.id, {
            edgeType,
          })
        }
        onConditionChange={(condition) =>
          updateEdgeMetadata(selectedEdgeTasks.sourceTask.id, selectedEdgeTasks.targetTask.id, {
            condition,
          })
        }
        onMetadataChange={(metadataJson) =>
          updateEdgeMetadata(selectedEdgeTasks.sourceTask.id, selectedEdgeTasks.targetTask.id, {
            metadataJson,
          })
        }
      />
    ) : null;

  const renderSelectedTaskDrawer = () => (
    <Sheet
      modal={false}
      open={Boolean(selectedTask)}
      onOpenChange={(open) => {
        if (!open && selectedTask) {
          updateWorkflowUrl({ nextTaskId: null });
        }
      }}
    >
      <SheetContent hideOverlay side="right" className="w-full overflow-y-auto p-4 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Selected Task</SheetTitle>
          <SheetDescription>Task details, dependencies, and linked agent.</SheetDescription>
        </SheetHeader>
        {renderSelectedTaskPanel()}
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <WorkflowDetailHeader
        workflowId={workflow.id}
        workflowName={resolvedWorkflowPreview.name}
        workflowDescription={resolvedWorkflowPreview.description ?? undefined}
        isEditing={isEditing}
        isPublished={isWorkflowPublished}
        hasUnsavedChanges={hasUnsavedChanges}
        isPublishing={publishMutation.isPending}
        isExecuting={executeMutation.isPending}
        restartActiveExecutions={effectiveRestartActiveExecutions}
        onRefresh={() => {
          void handleRefresh();
        }}
        onStartEditing={() => {
          suppressEditModeStartRef.current = false;
          startEditing();
          updateWorkflowUrl({ nextMode: 'edit' });
        }}
        onCancelEditing={() => {
          suppressEditModeStartRef.current = true;
          stopEditing();
          updateWorkflowUrl({ nextMode: null, nextTaskId: null, nextEdgeId: null });
        }}
        onPublish={() => {
          void handlePublish();
        }}
        onExecute={() => executeMutation.mutate(undefined)}
        onRestartActiveExecutionsChange={(checked) => {
          if (isEditing) {
            setRestartActiveExecutions(checked);
            return;
          }
          setRestartActiveExecutionsOverride(checked);
        }}
      />

      {executeMutation.isError ? (
        <ErrorAlert title="Failed to start workflow" message={executeMutation.error.message} />
      ) : null}

      <WorkflowDetailStatus
        workflow={resolvedWorkflowPreview}
        visibleTaskDefinitions={visibleTaskDefinitions}
        visibleAgentCount={visibleAgentDefinitions.length}
        effectiveEntrypointTaskId={effectiveEntrypointTaskId}
        hasUnsavedChanges={hasUnsavedChanges}
        isEditing={isEditing}
        draftValidationIssues={draftValidationIssues}
      />

      {!isEditing ? (
        <WorkflowMonitoringControls
          monitoring={workflow.monitoring ?? null}
          isSaving={updateMonitoringMutation.isPending}
          exemptionReason={monitoringExemptionReason}
          onExemptionReasonChange={setMonitoringExemptionReason}
          onMonitoringEnabledChange={handleMonitoringEnabledChange}
          onExemptionReasonSave={handleExemptionReasonSave}
          onAllowSelfMonitoringChange={handleAllowSelfMonitoringChange}
        />
      ) : null}

      {!isEditing ? (
        <WorkflowMonitoringProposals
          events={monitoringEventsQuery.data ?? null}
          isLoading={monitoringEventsQuery.isLoading}
          isMutating={monitorApprovalMutation.isPending}
          onApprovalDecision={handleMonitorApprovalDecision}
        />
      ) : null}

      {!isEditing ? (
        <WorkflowSharedMemoryControls
          sharedMemory={sharedMemoryQuery.data ?? null}
          isLoading={sharedMemoryQuery.isLoading}
          isSaving={updateSharedMemoryMutation.isPending}
          onEnabledChange={handleSharedMemoryEnabledChange}
          onRefresh={() => {
            void sharedMemoryQuery.refetch();
          }}
        />
      ) : null}

      {!isEditing ? (
        <WorkflowRuntimeAdapterPanel
          title="Run Configuration"
          description="Native is the default execution path. Choose another adapter only for this run when the workflow is meant to support it."
          selectLabel="Runtime adapter for this run"
          selectId="workflow-run-runtime-adapter"
          adapters={runnableRuntimeAdapters}
          selectedAdapterId={selectedRunRuntimeAdapterId}
          preferredAdapterId={preferredRuntimeAdapterId}
          selectedExecutionHost={selectedExecutionHost}
          isPending={executeMutation.isPending}
          actionVariant="default"
          actionClassName="min-w-40"
          actionContent={executeMutation.isPending ? 'Starting...' : 'Run With Selected Adapter'}
          onAdapterChange={setSelectedRunRuntimeAdapterId}
          onExecutionHostChange={setSelectedExecutionHost}
          onAction={() => {
            void launchWorkflow({
              runtimeAdapterId: selectedRunRuntimeAdapterId || null,
              executionHost: selectedExecutionHost,
            });
          }}
        />
      ) : null}

      {!isEditing ? (
        <WorkflowSchedulesPanel
          schedules={schedulesQuery.data ?? []}
          isLoading={schedulesQuery.isLoading}
          errorMessage={schedulesQuery.isError ? schedulesQuery.error.message : undefined}
          isMutating={
            toggleScheduleMutation.isPending ||
            triggerScheduleMutation.isPending ||
            updateScheduleMutation.isPending
          }
          onRefresh={() => {
            void schedulesQuery.refetch();
          }}
          onToggleSchedule={(schedule) => {
            void toast.promise(toggleScheduleMutation.mutateAsync(schedule.id), {
              loading: schedule.enabled ? 'Disabling schedule...' : 'Enabling schedule...',
              success: schedule.enabled ? 'Schedule disabled.' : 'Schedule enabled.',
              error: (error) =>
                error instanceof Error ? error.message : 'Failed to update schedule.',
              position: 'top-right',
            });
          }}
          onTriggerNow={(schedule) => {
            void toast.promise(triggerScheduleMutation.mutateAsync(schedule.id), {
              loading: 'Triggering schedule...',
              success: 'Schedule triggered.',
              error: (error) =>
                error instanceof Error ? error.message : 'Failed to trigger schedule.',
              position: 'top-right',
            });
          }}
          onUpdateSchedule={async (schedule, patch) => {
            const promise = updateScheduleMutation.mutateAsync({ scheduleId: schedule.id, patch });
            void toast.promise(promise, {
              loading: 'Saving schedule...',
              success: 'Schedule updated.',
              error: (error) =>
                error instanceof Error ? error.message : 'Failed to update schedule.',
              position: 'top-right',
            });
            await promise;
          }}
        />
      ) : null}

      {isEditing ? (
        <WorkflowMetadataEditor
          workflow={workflow}
          name={name}
          description={description}
          entrypoint={entrypoint}
          executionHost={executionHost}
          restartActiveExecutions={restartActiveExecutions}
          allowedRuntimeAdapterIds={allowedRuntimeAdapterIds}
          visibleTaskDefinitions={visibleTaskDefinitions}
          runtimeAdapters={runtimeAdapters}
          workflowNameInvalid={workflowNameInvalid}
          workflowDescriptionInvalid={workflowDescriptionInvalid}
          draftValidationIssues={draftValidationIssues}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={updateMutation.isPending}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onEntrypointChange={setEntrypoint}
          onExecutionHostChange={setExecutionHost}
          onRestartActiveExecutionsChange={setRestartActiveExecutions}
          onAllowedRuntimeAdapterToggle={toggleAllowedRuntimeAdapter}
          onSave={() => {
            void handleSave();
          }}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <WorkflowBuilderPanel
            workflowId={workflowId}
            isEditing={isEditing}
            behaviorProfiles={behaviorProfiles}
            toolDefinitions={assignableToolDefinitions}
            visibleAgentDefinitions={visibleAgentDefinitions}
            availableAgentDefinitions={availableAgentDefinitions}
            visibleTaskDefinitions={visibleTaskDefinitions}
            effectiveEntrypointTaskId={effectiveEntrypointTaskId}
            selectedTaskId={selectedTaskId}
            workflowKickoffInputs={workflowKickoffInputs}
            runtimeAdapterId={selectedRunRuntimeAdapterId || preferredRuntimeAdapterId || null}
            toolsUsed={toolsUsed}
            addAgentDefinition={addAgentDefinition}
            addExistingAgentDefinition={addExistingAgentDefinition}
            addTaskDefinition={addTaskDefinition}
            moveTaskDefinition={moveTaskDefinition}
            removeAgentDefinition={removeAgentDefinition}
            removeTaskDefinition={removeTaskDefinition}
            onSelectTask={(taskId) => updateWorkflowUrl({ nextTaskId: taskId })}
            setEntrypoint={setEntrypoint}
            updateAgentDefinition={updateAgentDefinition}
            updateTaskDefinition={updateTaskDefinition}
          />
        </TabsContent>

        <TabsContent value="graph">
          <div className="space-y-4">
            <WorkflowGraphComposer
              tasks={visibleTaskDefinitions}
              agents={visibleAgentDefinitions}
              tools={assignableToolDefinitions}
              entrypointTaskId={effectiveEntrypointTaskId}
              selectedTaskId={selectedTaskId}
              selectedEdgeId={selectedEdgeId}
              edgeConditions={Object.fromEntries(
                Object.entries(edgeMetadataByTaskPair)
                  .map(([key, value]) => [key, value.condition])
                  .filter(([, value]) => value)
              )}
              positions={currentGraphNodePositions}
              editable={isEditing}
              onPositionsChange={setGraphNodePositions}
              onSelectTask={(taskId) => updateWorkflowUrl({ nextTaskId: taskId, nextEdgeId: null })}
              onSelectEdge={(edgeId) => updateWorkflowUrl({ nextEdgeId: edgeId, nextTaskId: null })}
              onConnectTasks={(sourceTaskId, targetTaskId) => {
                const connected = connectTaskDependency(sourceTaskId, targetTaskId);
                if (!connected) {
                  toast.error('That dependency would create a cycle.', { position: 'top-right' });
                }
              }}
              onDisconnectTasks={disconnectTaskDependency}
            />
            {renderSelectedEdgePanel()}
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <WorkflowRunsPanel
            workflowId={workflowId}
            isLoading={runsQuery.isLoading}
            errorMessage={runsQuery.isError ? runsQuery.error.message : undefined}
            runs={runsQuery.data ?? []}
            onRetry={() => {
              void runsQuery.refetch();
            }}
          />
        </TabsContent>
      </Tabs>

      {renderSelectedTaskDrawer()}
    </div>
  );
}
