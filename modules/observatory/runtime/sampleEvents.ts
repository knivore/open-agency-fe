import type { ObservatoryExternalRuntimeEvent } from '@/modules/observatory/runtime/events';

export const observatorySampleExternalRuntimeEvents: ObservatoryExternalRuntimeEvent[] = [
  {
    id: 'evt-local-agent-status-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'agent_status_changed',
    timestamp: '2026-05-09T00:00:00.000Z',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
      role: 'runtime-observer',
      avatarAssetId: 'human:atlas',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      name: 'Sample Runtime',
      roomId: 'room:runtime-floor',
    },
    level: 'info',
    message: 'Atlas is observing runtime activity.',
  },
  {
    id: 'evt-local-task-started-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'task_started',
    timestamp: '2026-05-09T00:00:05.000Z',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:runtime-floor',
    },
    task: {
      id: 'task:collect-logs',
      title: 'Collect logs',
      progress: 0,
    },
    message: 'Started collecting runtime logs.',
  },
  {
    id: 'evt-local-log-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'log_received',
    timestamp: '2026-05-09T00:00:10.000Z',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
    },
    task: {
      id: 'task:collect-logs',
      title: 'Collect logs',
      progress: 0.5,
    },
    level: 'debug',
    message: 'Collected 24 runtime log entries.',
  },
  {
    id: 'evt-local-task-progress-2',
    source: 'local-sample',
    sourceType: 'local',
    type: 'task_progress',
    timestamp: '2026-05-09T00:00:15.000Z',
    actor: {
      id: 'agent:byte',
      name: 'Byte',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:workflow-pod',
    },
    task: {
      id: 'task:wire-ui',
      title: 'Wire UI events',
      progress: 0.72,
    },
    message: 'Byte is wiring runtime UI state into the preview.',
  },
  {
    id: 'evt-local-task-complete-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'task_completed',
    timestamp: '2026-05-09T00:00:20.000Z',
    actor: {
      id: 'agent:clio',
      name: 'Clio',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:commons',
    },
    task: {
      id: 'task:review-output',
      title: 'Review output',
      progress: 1,
    },
    message: 'Clio completed the output review.',
  },
  {
    id: 'evt-local-task-failed-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'task_failed',
    timestamp: '2026-05-09T00:00:25.000Z',
    actor: {
      id: 'agent:delta',
      name: 'Delta',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:workflow-pod',
    },
    task: {
      id: 'task:ship-regression',
      title: 'Ship regression check',
      progress: 0.33,
    },
    level: 'error',
    message: 'Delta found a regression in the preview wiring.',
  },
  {
    id: 'evt-local-approval-required-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'approval_required',
    timestamp: '2026-05-09T00:00:30.000Z',
    actor: {
      id: 'agent:echo',
      name: 'Echo',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:runtime-floor',
    },
    task: {
      id: 'task:deploy-preview',
      title: 'Deploy preview',
      progress: 0.82,
    },
    level: 'warning',
    message: 'Echo needs approval before deploying the preview build.',
  },
  {
    id: 'evt-local-action-sit-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'agent_status_changed',
    timestamp: '2026-05-09T00:00:35.000Z',
    actor: {
      id: 'agent:byte',
      name: 'Byte',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:workflow-pod',
    },
    level: 'info',
    message: 'Byte is sitting for a planning pass.',
    metadata: {
      status: 'working',
      visualAction: 'sit',
      visualDirection: 'right',
    },
  },
  {
    id: 'evt-local-action-sleep-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'agent_status_changed',
    timestamp: '2026-05-09T00:00:40.000Z',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:commons',
    },
    level: 'info',
    message: 'Atlas is in a low-power waiting state.',
    metadata: {
      status: 'idle',
      visualAction: 'sleep',
    },
  },
  {
    id: 'evt-local-action-high-chair-1',
    source: 'local-sample',
    sourceType: 'local',
    type: 'agent_status_changed',
    timestamp: '2026-05-09T00:00:45.000Z',
    actor: {
      id: 'agent:clio',
      name: 'Clio',
    },
    workflow: {
      id: 'workflow:sample-runtime',
      roomId: 'room:commons',
    },
    level: 'info',
    message: 'Clio is using a high-chair workstation.',
    metadata: {
      status: 'working',
      visualAction: 'high-chair-sit',
      visualDirection: 'left',
    },
  },
];
