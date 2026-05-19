import type { RunSessionSummary } from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';

export interface ObservatoryRuntimeDemoAgent {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
}

export interface ObservatoryRuntimeDemoEvent {
  agentId?: string | null;
  eventType: string;
  message: string;
  sequence: number;
  taskId?: string | null;
  timestamp?: string | null;
}

export interface ObservatoryRuntimeDemoContext {
  events: ObservatoryRuntimeDemoEvent[];
  logs: string[];
  run: RunSessionSummary;
  workflow: WorkflowDefinition;
}

export interface ObservatoryRuntimeDemoFixture {
  agents: ObservatoryRuntimeDemoAgent[];
  description: string;
  id: string;
  label: string;
  runtimeContext: ObservatoryRuntimeDemoContext[];
}

const demoTimestamp = '2026-05-11T01:00:00.000Z';

const baseDemoAgents: ObservatoryRuntimeDemoAgent[] = [
  { id: 'agent:atlas', name: 'Atlas', role: 'main-agent', description: 'Coordinates workflow execution and final review.' },
  { id: 'agent:byte', name: 'Byte', role: 'builder', description: 'Implements code and runtime tasks.' },
  { id: 'agent:clio', name: 'Clio', role: 'planner', description: 'Plans, reviews, and writes execution notes.' },
  { id: 'agent:delta', name: 'Delta', role: 'qa', description: 'Runs regression checks and investigates failures.' },
  { id: 'agent:echo', name: 'Echo', role: 'ops', description: 'Handles deployment, approvals, and operational checks.' },
];

export const observatoryRuntimeDemoFixtures: ObservatoryRuntimeDemoFixture[] = [
  {
    id: 'active-agency-floor',
    label: 'Active agency floor',
    description: 'Three concurrent workflows: executing, planning, and waiting for approval.',
    agents: baseDemoAgents,
    runtimeContext: [
      createDemoContext({
        agentIds: ['agent:atlas', 'agent:byte'],
        logs: [
          '[atlas] Loaded workflow graph and assigned Byte to implementation.',
          '[byte] Running workspace checks before applying code changes.',
          '[byte] Updated runtime viewer wiring and queued validation.',
          '[atlas] Waiting for focused browser verification output.',
        ],
        runId: 'run:demo-content-pipeline',
        sequenceBase: 100,
        status: 'running',
        taskTitle: 'Render active workflow canvas',
        workflowId: 'workflow:demo-content-pipeline',
        workflowName: 'Content Pipeline Build',
      }),
      createDemoContext({
        agentIds: ['agent:clio'],
        logs: [
          '[clio] Gathering requirements from the prompt and master plan.',
          '[clio] Drafting next execution plan at the workflow whiteboard.',
        ],
        runId: 'run:demo-planning-pass',
        sequenceBase: 200,
        status: 'queued',
        taskTitle: 'Plan visual behavior states',
        workflowId: 'workflow:demo-planning-pass',
        workflowName: 'Planning Pass',
      }),
      createDemoContext({
        agentIds: ['agent:echo', 'agent:delta'],
        logs: [
          '[echo] Deployment requires human approval before continuing.',
          '[delta] Regression checks are ready but blocked by approval gate.',
        ],
        runId: 'run:demo-approval-gate',
        sequenceBase: 300,
        status: 'waiting_for_approval',
        taskTitle: 'Approve runtime deployment',
        workflowId: 'workflow:demo-approval-gate',
        workflowName: 'Approval Gate',
      }),
    ],
  },
  {
    id: 'overflow-load',
    label: 'Overflow load',
    description: 'Ten active workflows to force generated runtime overflow floors.',
    agents: baseDemoAgents,
    runtimeContext: Array.from({ length: 10 }, (_, index) =>
      createDemoContext({
        agentIds: [baseDemoAgents[index % baseDemoAgents.length]?.id ?? 'agent:atlas'],
        logs: [
          `[runtime] Workflow ${index + 1} acquired an execution room.`,
          `[runtime] Agent heartbeat received for overflow workflow ${index + 1}.`,
          `[runtime] Streaming progress event ${index + 1}/10 into Observatory.`,
        ],
        runId: `run:demo-overflow-${index + 1}`,
        sequenceBase: 400 + index * 10,
        status: index % 3 === 0 ? 'running' : index % 3 === 1 ? 'queued' : 'paused',
        taskTitle: `Overflow workflow ${index + 1}`,
        workflowId: `workflow:demo-overflow-${index + 1}`,
        workflowName: `Overflow Workflow ${index + 1}`,
      })
    ),
  },
];

function createDemoContext({
  agentIds,
  logs,
  runId,
  sequenceBase,
  status,
  taskTitle,
  workflowId,
  workflowName,
}: {
  agentIds: string[];
  logs: string[];
  runId: string;
  sequenceBase: number;
  status: RunSessionSummary['status'];
  taskTitle: string;
  workflowId: string;
  workflowName: string;
}): ObservatoryRuntimeDemoContext {
  const agents = agentIds.map((agentId) => baseDemoAgents.find((agent) => agent.id === agentId) ?? baseDemoAgents[0]).filter(Boolean);

  return {
    events: agents.flatMap((agent, index) => [
      {
        agentId: agent.id,
        eventType: status === 'waiting_for_approval' ? 'approval_required' : 'task_started',
        message: `${agent.name} ${status === 'waiting_for_approval' ? 'requires approval for' : 'started'} ${taskTitle}.`,
        sequence: sequenceBase + index * 3,
        taskId: `task:${workflowId}:primary`,
        timestamp: demoTimestamp,
      },
      {
        agentId: agent.id,
        eventType: 'log_received',
        message: `${agent.name} streamed runtime logs for ${workflowName}.`,
        sequence: sequenceBase + index * 3 + 1,
        taskId: `task:${workflowId}:primary`,
        timestamp: demoTimestamp,
      },
      {
        agentId: agent.id,
        eventType: status === 'paused' ? 'agent_status_changed' : 'task_progress',
        message: `${agent.name} is ${status.replaceAll('_', ' ')} on ${workflowName}.`,
        sequence: sequenceBase + index * 3 + 2,
        taskId: `task:${workflowId}:primary`,
        timestamp: demoTimestamp,
      },
    ]),
    logs,
    run: {
      id: runId,
      createdAt: demoTimestamp,
      runtimeAdapterId: 'runtime:observatory-demo',
      startedAt: demoTimestamp,
      status,
      triggerType: 'observatory-demo-fixture',
      updatedAt: demoTimestamp,
      workflowId,
    },
    workflow: {
      id: workflowId,
      name: workflowName,
      description: `Deterministic Observatory demo workflow for ${workflowName}.`,
      agent_definitions: agents.map((agent) => ({
        description: agent.description ?? null,
        id: agent.id,
        name: agent.name,
        role: agent.role ?? null,
      })),
      task_definitions: [
        {
          id: `task:${workflowId}:primary`,
          name: taskTitle,
          description: `Demo task for ${workflowName}.`,
          agent_id: agents[0]?.id ?? 'agent:atlas',
          tool_ids: [],
        },
      ],
    },
  };
}
