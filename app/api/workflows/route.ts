import { WorkflowEditorFormSchema } from '@/types/workflows';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { backendWorkflowsApi, workflowsApi } from '@/lib/api/backend';
import { workflowBuilderBaseToWorkflowDefinition } from '@/lib/workflows/workflowDefinitionMutations';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

function looksLikeWorkflowDefinition(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'entrypoint' in value &&
      'nodes' in value &&
      'task_definitions' in value
  );
}

function assignWorkflowOwner(payload: Record<string, unknown>, userId: string) {
  const metadata = typeof payload.metadata === 'object' && payload.metadata !== null
    ? payload.metadata as Record<string, unknown>
    : {};
  const existingOwnerIds = Array.isArray(metadata.owner_ids)
    ? metadata.owner_ids.filter((ownerId): ownerId is string => typeof ownerId === 'string' && ownerId.length > 0)
    : [];
  return {
    ...payload,
    metadata: {
      ...metadata,
      created_by: typeof metadata.created_by === 'string' && metadata.created_by.length > 0 ? metadata.created_by : userId,
      owner_ids: Array.from(new Set([...existingOwnerIds, userId])),
    },
  };
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const response = await workflowsApi.listWorkflows();
    const workflows = response.items
      .filter((workflow) => {
        const ownerIds = Array.isArray(workflow.metadata?.owner_ids) ? workflow.metadata.owner_ids : [];
        return ownerIds.length === 0 || (user ? ownerIds.includes(user.id) : true);
      });
    return NextResponse.json({ workflows });
  } catch (e) {
    console.error('Failed to get workflows: ', e);
    return NextResponse.json({ message: `Internal Server Error: ${e}`, status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const body = await req.json();
    const workflowPayload = looksLikeWorkflowDefinition(body)
      ? assignWorkflowOwner(body, user.id)
      : workflowBuilderBaseToWorkflowDefinition(
          {
            ...WorkflowEditorFormSchema.parse({ ...body }),
            owned_by: [user.id],
            created_by: user.id,
          },
          user.id
        );

    const createdWorkflow = await backendWorkflowsApi.createWorkflow(workflowPayload, user, getInternalApiKey());
    return NextResponse.json({
      message: 'Workflow created successfully',
      data: createdWorkflow,
      status: 201,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod Validation error:', e.issues);
      return NextResponse.json({
        message: `Invalid request body: ${e.issues}`,
        status: 400,
      });
    }
    console.error('Failed to create workflow:', e);
    return proxyErrorResponse(e);
  }
}
