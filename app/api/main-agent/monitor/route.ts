import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const response = await backendWorkflowsApi.getMainAgentMonitorCommandCenter(
      user,
      getInternalApiKey()
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const payload = await req.json();
    const response = await backendWorkflowsApi.updateMainAgentMonitorRoutes(
      payload,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
