import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Workflow ID is required', status: 400 }, { status: 400 });
    }
    const url = new URL(req.url);
    const limitValue = url.searchParams.get('limit');
    const limit = limitValue ? Number(limitValue) : undefined;
    const response = await backendWorkflowsApi.getWorkflowGovernanceReviewQueue(
      id,
      user,
      getInternalApiKey(),
      Number.isFinite(limit) ? limit : undefined
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
