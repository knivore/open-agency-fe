'use client';
import {
  getWorkflowDetail,
  getWorkflowInputs,
  getWorkflowToolOptions,
} from '@/app/api/utils/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { agentDefinitionToFormData, taskDefinitionToFormData } from '@/lib/workflows/builderForms';
import { preferredWorkflowRuntimeAdapterId } from '@/lib/workflows/runtimeAdapterSelection';
import { toolDisplayName } from '@/lib/tools/displayName';
import type { WorkflowToolOption, WorkflowWorkspaceDetail } from '@/types/workflows';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AgentCard from '@/components/workflows/builder/agents/card';
import CreateAgentForm from '@/components/workflows/builder/agents/agentForm/createAgentForm';
import CreateTaskForm from '@/components/workflows/builder/tasks/taskForm/createTaskForm';
import WorkflowRunPanel from '@/components/workflows/WorkflowRunPanel';
import TaskListContainer from '@/components/workflows/builder/tasks';
import WorkflowSettings from '@/components/workflows/WorkflowSettings';
import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../library/shadcn/accordion';
import WorkflowPermissions from '@/components/workflows/WorkflowPermissions';
import WorkflowDelete from '@/components/workflows/WorkflowDelete';

export default function WorkflowDashboard({
  workflowId,
  embedded = false,
}: {
  workflowId: string;
  embedded?: boolean;
}) {
  const { data, isLoading: workflowLoading } = useQuery<WorkflowWorkspaceDetail>({
    queryKey: queryKeys.workflowDetail(workflowId),
    queryFn: () => getWorkflowDetail(workflowId),
  });

  const workflow = data?.workflow;
  const workflowName = workflow?.name;
  const runtimeAdapterId = workflow
    ? preferredWorkflowRuntimeAdapterId(workflow.allowed_runtime_adapter_ids, workflow.default_runtime_adapter_id)
    : null;

  const { data: tools = [], isLoading: toolsLoading } = useQuery<WorkflowToolOption[]>({
    queryKey: queryKeys.tools(),
    queryFn: () => getWorkflowToolOptions(),
  });

  const { data: workflowInputs, isLoading: workflowInputsLoading } = useQuery<string[]>({
    queryKey: queryKeys.workflowInputs(workflowId),
    queryFn: () => getWorkflowInputs(workflowId),
  });
  const workflowKickoffInputs = (workflowInputs || []).reduce(
    (acc, key) => ({ ...acc, [key]: '' }),
    {} as Record<string, string>
  );

  const agents = useMemo(
    () =>
      (workflow?.agent_definitions ?? []).map((agent) =>
        agentDefinitionToFormData(agent, workflow?.tool_definitions ?? [])
      ),
    [workflow]
  );
  const tasks = useMemo(
    () => (workflow?.task_definitions ?? []).map((task) => taskDefinitionToFormData(task)),
    [workflow]
  );
  const toolDefinitionsById = useMemo(
    () => new Map((workflow?.tool_definitions ?? []).map((tool) => [tool.id, tool])),
    [workflow?.tool_definitions]
  );
  const toolNames =
    Array.from(
      new Set(
        agents.flatMap((agent) =>
          agent.tool_ids
            .map((toolId) => {
              const tool = toolDefinitionsById.get(toolId);
              return tool ? toolDisplayName(tool) : toolId;
            })
            .filter(Boolean)
        )
      )
    ).join(' • ') || 'NIL';

  const isLoading = workflowLoading || toolsLoading || workflowInputsLoading;

  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const effectiveTaskOrder =
    taskOrder.length > 0
      ? taskOrder
      : tasks.map((task) => task.id).filter((id): id is string => id !== null && id !== undefined);

  const handleOrderChange = (newOrder: string[]) => {
    if (JSON.stringify(newOrder) !== JSON.stringify(taskOrder)) {
      setTaskOrder(newOrder);
    }
  };

  const queryClient = useQueryClient();

  const handleModalClose = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
  };

  const header = (
    <div className={embedded ? '' : 'p-6 gap-6'}>
      <div
        className={`${embedded ? 'border border-primary-100' : 'agency-card'} rounded-lg bg-white p-6 pb-3`}
      >
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="agency-gradient-text py-2 text-3xl font-bold">{workflowName}</h1>

          <div className="flex gap-2">
            <WorkflowPermissions
              workflowId={workflowId}
              workflowName={workflowName ?? 'Untitled'}
              creator={data?.creator || { name: '', email: '' }}
              workflowOwners={data?.owners || []}
              onClose={handleModalClose}
            />
            <WorkflowSettings
              workflow={workflow}
              isLoading={isLoading}
              workflowInputs={workflowInputs || []}
            />
            <WorkflowDelete workflowId={workflowId} />
          </div>
        </div>

        <div className="pt-3 text-sm text-neutral-500">
          <span className="font-bold text-primary-900">Tools Used: </span>
          {toolNames}
        </div>
      </div>
    </div>
  );

  const body = (
    <div className={embedded ? 'gap-6' : 'px-6 gap-6 mb-5'}>
      <div className="grid grid-cols-12 gap-4">
        <Accordion
          type="single"
          collapsible
          defaultValue="agents"
          className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-6 min-h-96"
        >
          <AccordionItem
            value="agents"
            className="rounded-lg border border-primary-100 bg-white shadow-sm shadow-primary/5"
          >
            <AccordionTrigger className="px-6 h-[48px]">
              <span className="text-lg font-bold text-primary-950">Agents</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 space-y-2 min-h-96 h-[calc(100vh-64px-280px)] overflow-content">
              <CreateAgentForm workflowId={workflowId} tools={tools} />
              <div className="overflow-y-auto min-h-80 h-[calc(100vh-400px)]">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                ) : agents.length > 0 ? (
                  <ul className="space-y-4">
                    {agents.map((agent) => (
                      <li key={agent.id}>
                        <AgentCard agent={agent} workflowId={workflowId} tools={tools} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No agents available</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion
          type="single"
          collapsible
          defaultValue="agents"
          className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-6 min-h-96"
        >
          <AccordionItem
            value="agents"
            className="rounded-lg border border-primary-100 bg-white shadow-sm shadow-primary/5"
          >
            <AccordionTrigger className="px-6 h-[48px]">
              <span className="text-lg font-bold text-primary-950">
                Tasks ({tasks.length})
              </span>{' '}
            </AccordionTrigger>
            <AccordionContent className="px-6 space-y-2 min-h-96 h-[calc(100vh-64px-280px)] overflow-content">
              <CreateTaskForm workflowId={workflowId} agents={agents} allTasks={tasks} />
              <div className="overflow-y-auto min-h-80 h-[calc(100vh-400px)]">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks && tasks.length > 0 ? (
                      <TaskListContainer
                        allTasks={tasks}
                        allAgents={agents}
                        onOrderChange={handleOrderChange}
                        taskOrder={effectiveTaskOrder}
                        workflowId={workflowId}
                      />
                    ) : (
                      <p className="text-sm text-gray-500">No tasks available</p>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion
          type="single"
          collapsible
          defaultValue="run-workflow"
          className="col-span-12 lg:col-span-5 space-y-6 min-h-96"
        >
          <AccordionItem
            value="run-workflow"
            className="rounded-lg border border-primary-100 bg-white shadow-sm shadow-primary/5"
          >
            <AccordionTrigger className="px-6 h-[48px]">
              <span className="text-lg font-bold text-primary-950">Test Workflow</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 space-y-2 min-h-96 h-[calc(100vh-64px-280px)] overflow-auto">
              <div className="overflow-y-auto min-h-80">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                ) : (
                  <WorkflowRunPanel
                    workflowId={workflowId}
                    toolsUsed={toolNames}
                    workflowKickoffInputs={workflowKickoffInputs}
                    taskOrder={effectiveTaskOrder}
                    runtimeAdapterId={runtimeAdapterId}
                  />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );

  return (
    <div className={embedded ? 'space-y-4' : 'bg-transparent'}>
      {header}
      {body}
    </div>
  );
}
