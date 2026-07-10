import { executionsApi } from '@/lib/api/backend/executions';
import { serializeExecutionResult } from '@/lib/workflows/executionPayload';
import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ process_id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    const { process_id: processId } = await params;
    const executionDetail = await executionsApi.getExecution(processId, user, getInternalApiKey());
    const execution = executionDetail.execution;
    const result =
      execution.status === 'failed'
        ? execution.error ?? serializeExecutionResult(execution.output_payload)
        : serializeExecutionResult(execution.output_payload);

    return NextResponse.json({
      status: execution.status ?? 'unknown',
      result,
    });
  } catch (e) {
    return proxyErrorResponse(e);
  }
}
