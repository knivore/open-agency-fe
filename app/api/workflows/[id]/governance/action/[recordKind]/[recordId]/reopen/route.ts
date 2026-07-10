import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; recordKind: string; recordId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id, recordKind, recordId } = await params;
    if (!id || !recordKind || !recordId) {
      return NextResponse.json(
        { message: 'Workflow ID, record kind, and record id are required', status: 400 },
        { status: 400 }
      );
    }
    const response = await backendWorkflowsApi.reopenWorkflowGovernanceRecord(
      id,
      recordKind,
      recordId,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
