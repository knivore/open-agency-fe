import { NextResponse } from 'next/server';
import { backendWorkflowsApi } from '@/lib/api/backend/workflows';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id, linkId } = await params;
    if (!id) {
      return NextResponse.json(
        { message: 'Workflow ID is required', status: 400 },
        { status: 400 }
      );
    }
    if (!linkId) {
      return NextResponse.json(
        { message: 'Workflow memory link ID is required', status: 400 },
        { status: 400 }
      );
    }
    const response = await backendWorkflowsApi.deleteWorkflowMemoryLink(
      id,
      linkId,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
