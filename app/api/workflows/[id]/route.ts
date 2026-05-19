import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { WorkflowEditorFormSchema } from '@/types/workflows';
import { backendWorkflowsApi, workflowsApi } from '@/lib/api/backend';
import type { User } from '@/types/users';
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
      'nodes' in value &&
      'task_definitions' in value
  );
}

function normalizeRuntimeAdapterIds(payload: Record<string, unknown>) {
  const allowedRuntimeAdapterIds = Array.isArray(payload.allowed_runtime_adapter_ids)
    ? payload.allowed_runtime_adapter_ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const defaultRuntimeAdapterId =
    typeof payload.default_runtime_adapter_id === 'string' && payload.default_runtime_adapter_id.trim()
      ? payload.default_runtime_adapter_id.trim()
      : null;

  return {
    ...payload,
    default_runtime_adapter_id: defaultRuntimeAdapterId,
    allowed_runtime_adapter_ids:
      defaultRuntimeAdapterId && !allowedRuntimeAdapterIds.includes(defaultRuntimeAdapterId)
        ? [...allowedRuntimeAdapterIds, defaultRuntimeAdapterId]
        : allowedRuntimeAdapterIds,
  };
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Workflow ID is required', status: 400 });
    }

    const body = await req.json();
    const workflow = await workflowsApi.getWorkflow(id);

    if (looksLikeWorkflowDefinition(body)) {
      const metadata = typeof body.metadata === 'object' && body.metadata !== null
        ? body.metadata as Record<string, unknown>
        : {};
      await backendWorkflowsApi.updateWorkflow(
        id,
        normalizeRuntimeAdapterIds({
          ...body,
          id,
          metadata: {
            ...(workflow.metadata ?? {}),
            ...metadata,
          },
        }),
        user,
        getInternalApiKey()
      );
      return NextResponse.json({ msg: 'success', status: 200 });
    }

    const parsedBody = WorkflowEditorFormSchema.parse(body);

    await backendWorkflowsApi.updateWorkflow(id, {
      name: parsedBody.name,
      description: parsedBody.description,
      metadata: {
        ...(workflow.metadata ?? {}),
        inputs: parsedBody.inputs ?? workflow.metadata?.inputs ?? [],
        process: parsedBody.process ?? workflow.metadata?.process ?? 'sequential',
      },
    }, user, getInternalApiKey());
    return NextResponse.json({ msg: 'success', status: 200 });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod error: ', e.issues);
      return NextResponse.json({ message: `Invalid request body: ${e.issues}`, status: 400 });
    }
    console.error("Failed to update workflow's tasks: ", e);
    return proxyErrorResponse(e);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Workflow ID is required', status: 400 });
    }

    const workflow = await workflowsApi.getWorkflow(id);
    const ownerIds = Array.isArray(workflow.metadata?.owner_ids)
      ? workflow.metadata.owner_ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];
    const creatorId =
      typeof workflow.metadata?.created_by === 'string' && workflow.metadata.created_by.length > 0
        ? workflow.metadata.created_by
        : null;

    const userIds = Array.from(new Set([...ownerIds, ...(creatorId ? [creatorId] : [])]));
    const users: User[] = userIds.map((userId) => ({
      id: userId,
      name: userId,
      email: `${userId}@agency.local`,
      image: null,
    }));
    const usersById = new Map(
      users
        .filter((user): user is User => Boolean(user?.id))
        .map((user) => [user.id, user])
    );

    return NextResponse.json({
      workflow,
      owners: ownerIds
        .map((ownerId) => usersById.get(ownerId))
        .filter((user): user is User => Boolean(user?.id)),
      creator: creatorId ? usersById.get(creatorId) : undefined,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod error: ', e.issues);
      return NextResponse.json({ message: `Invalid request body: ${e.issues}`, status: 400 });
    }
    console.error("Failed to get workflow detail: ", e);
    return NextResponse.json({ message: `Internal Server Error ${e}`, status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Workflow ID is required', status: 400 });
    }
    await backendWorkflowsApi.deleteWorkflow(id, user, getInternalApiKey());
    return NextResponse.json({ message: 'Workflow deleted successfully', status: 200 });
  } catch (e) {
    console.error('Failed to delete workflow: ', e);
    return proxyErrorResponse(e);
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Workflow ID is required', status: 400 });
    }
    const clonedWorkflow = await backendWorkflowsApi.cloneWorkflow(id, user, getInternalApiKey());
    return NextResponse.json({
      message: 'Workflow cloned successfully',
      data: clonedWorkflow,
      status: 201,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod Validation Error:', e.issues);
      return NextResponse.json({
        message: `Invalid request body: ${e.issues}`,
        status: 400,
      });
    }
    console.error('Failed to clone workflow:', e);
    return proxyErrorResponse(e);
  }
}
