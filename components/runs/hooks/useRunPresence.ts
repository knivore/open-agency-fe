'use client';

import { useMemo } from 'react';
import type { ApprovalRequest } from '@/types/conversations';
import type {
  ExecutionEventRecord,
  ExecutionStateSnapshot,
  RunSessionSummary,
} from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';
import {
  deriveAgentPresences,
  deriveTaskPresences,
} from '@/components/runs/lib/presenceDerivation';

export function useRunPresence(params: {
  run: RunSessionSummary;
  workflow?: WorkflowDefinition;
  state: ExecutionStateSnapshot;
  events: ExecutionEventRecord[];
  approvals: ApprovalRequest[];
}) {
  const { run, workflow, state, events, approvals } = params;

  const agents = useMemo(
    () => deriveAgentPresences({ run, workflow, state, events, approvals }),
    [run, workflow, state, events, approvals]
  );
  const tasks = useMemo(
    () => deriveTaskPresences({ run, workflow, state, events, approvals }),
    [run, workflow, state, events, approvals]
  );

  return { agents, tasks };
}
