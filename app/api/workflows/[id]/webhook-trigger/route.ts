import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const trigger = await backendWorkflowsApi.getWorkflowWebhookTrigger(
      id,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(trigger);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const trigger = await backendWorkflowsApi.createWorkflowWebhookTrigger(
      id,
      await request.json(),
      user,
      getInternalApiKey()
    );
    return NextResponse.json(trigger, { status: 201 });
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
