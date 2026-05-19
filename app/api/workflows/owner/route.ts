import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { workflowsApi } from '@/lib/api/backend';
import { getAuthenticatedUser } from '@/app/api/backend-users/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ authorized: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const url = new URL(request.url);
    const workflowId = url.searchParams.get('workflowId');

    if (!workflowId) {
      return NextResponse.json({ authorized: false, error: 'Missing workflowId' }, { status: 400 });
    }

    const workflow = await workflowsApi.getWorkflow(workflowId);
    const ownerIds = Array.isArray(workflow.metadata?.owner_ids) ? workflow.metadata.owner_ids : [];
    const userOwnsWorkflow = ownerIds.length === 0 || ownerIds.includes(userId);

    if (!userOwnsWorkflow) {
      return NextResponse.json({ authorized: false, error: 'User does not have access to this workflow' }, { status: 403 });
    }

    return NextResponse.json({ authorized: true });
  } catch (e) {
    console.error('Failed to check user-workflow relationship: ', e);
    return NextResponse.json({ message: `Internal Server Error: ${e}`, status: 500 });
  }
}
