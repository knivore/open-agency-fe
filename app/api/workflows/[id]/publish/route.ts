import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const payload = await req.json().catch(() => ({}));
    const workflow = await backendWorkflowsApi.publishWorkflow(id, payload, user, getInternalApiKey());
    return NextResponse.json(workflow);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
