import { executionsApi } from '@/lib/api/backend/executions';
import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(_req: Request, { params }: { params: Promise<{ process_id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    const { process_id: processId } = await params;
    const stopProcess = await executionsApi.cancelExecution(processId, user, getInternalApiKey());
    return NextResponse.json(stopProcess);
  } catch (e) {
    return proxyErrorResponse(e);
  }
}
