import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { backendWorkflowsApi } from '@/lib/api/backend';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const owners = await backendWorkflowsApi.listOwners(id, user, getInternalApiKey());
    return NextResponse.json(owners);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const owner_ids = await req.json();
    await backendWorkflowsApi.addOwners(id, owner_ids, user, getInternalApiKey());
    return NextResponse.json({ msg: 'success', status: 200 });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod error: ', e.issues);
      return NextResponse.json({ message: `Invalid request body: ${e.issues}`, status: 400 });
    }
    console.error('Failed to add new owners: ', e);
    return proxyErrorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required', status: 400 });
    }

    await backendWorkflowsApi.removeOwner(id, userId, user, getInternalApiKey());
    return NextResponse.json({ msg: 'success', status: 200 });
  } catch (e) {
    console.error('Error removing owner:', e);
    return proxyErrorResponse(e);
  }
}
