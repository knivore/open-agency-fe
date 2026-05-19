import { NextRequest, NextResponse } from 'next/server';
import type { WorkflowExecutionStartPayload } from '@/types/workflows';
import { executionsApi, workflowsApi } from '@/lib/api/backend';
import { toAgentRun } from '@/lib/api/backend/agentTransforms';
import { isApiError } from '@/lib/api/errors';
import {
  buildExecutionWorkflowDefinition,
  normalizeExecutionHost,
  resolveWorkflowExecutionHost,
} from '@/lib/workflows/executionPayload';
import { preferredWorkflowRuntimeAdapterId } from '@/lib/workflows/runtimeAdapterSelection';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

interface RequestBody {
  inputs?: Record<string, string>;
  taskOrder?: string[];
  agentConfigs?: WorkflowExecutionStartPayload['agentConfigs'];
  runtimeAdapterId?: string | null;
  executionHost?: string | null;
  [key: string]: unknown;
}

function isUnsupportedAdapterError(error: unknown) {
  if (!isApiError(error)) {
    return false;
  }

  const details = typeof error.details === 'string' ? error.details : '';
  return error.message.includes('is not supported by adapter') || details.includes('is not supported by adapter');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const body = (await request.json()) as RequestBody;
    const inputs = body.inputs ?? {};
    const tasks = body.taskOrder ?? [];
    const agentConfigs = body.agentConfigs;

    const workflow = await workflowsApi.getWorkflow(id);
    const preferredRuntimeAdapterId = preferredWorkflowRuntimeAdapterId(
      workflow.allowed_runtime_adapter_ids,
      workflow.default_runtime_adapter_id
    );
    const runtimeAdapterId = (body.runtimeAdapterId ?? preferredRuntimeAdapterId) || null;
    const executionHost = normalizeExecutionHost(body.executionHost) ?? resolveWorkflowExecutionHost(workflow);
    const startExecution = (nextRuntimeAdapterId: string | null) => {
      const workflowDefinition = buildExecutionWorkflowDefinition(workflow, {
        taskOrder: tasks,
        agentConfigs,
        runtimeAdapterId: nextRuntimeAdapterId,
        executionHost,
      });

      return executionsApi.startWorkflowExecution(
        id,
        {
          input: {
            inputs,
            taskOrder: tasks,
            agentConfigs: agentConfigs ?? {},
          },
          trigger: {
            type: 'manual',
            requested_by: user.id,
            execution_host: executionHost,
          },
          runtimeAdapterId: nextRuntimeAdapterId ?? undefined,
          executionHost,
          workflow_definition: workflowDefinition,
        },
        user,
        getInternalApiKey()
      );
    };

    const startedExecution = await startExecution(runtimeAdapterId).catch((error) => {
      if (runtimeAdapterId !== preferredRuntimeAdapterId && preferredRuntimeAdapterId && isUnsupportedAdapterError(error)) {
        return startExecution(preferredRuntimeAdapterId);
      }

      throw error;
    });

    return NextResponse.json({
      status: startedExecution.status ?? 'queued',
      process_id: startedExecution.process_id,
      run_id: startedExecution.execution.id,
      execution: startedExecution.execution,
      run: toAgentRun(startedExecution.execution),
      output: null,
    });
  } catch (error) {
    console.error('Error running workflow:', error);
    return proxyErrorResponse(error);
  }
}
