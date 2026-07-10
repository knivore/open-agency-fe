import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; revision: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id, revision } = await params;
    const parsedRevision = Number(revision);
    if (!id || !Number.isInteger(parsedRevision) || parsedRevision < 1) {
      return NextResponse.json(
        { message: 'Workflow ID and numeric revision are required', status: 400 },
        { status: 400 }
      );
    }
    const response = await backendWorkflowsApi.getWorkflowVersion(
      id,
      parsedRevision,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
