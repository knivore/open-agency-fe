import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend/credentials';
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
    const credential = await backendCredentialsApi.getCredential(id, user, getInternalApiKey());
    return NextResponse.json(credential);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const payload = await req.json();
    const credential = await backendCredentialsApi.updateCredential(id, payload, user, getInternalApiKey());
    return NextResponse.json(credential);
  } catch (error) {
    return proxyErrorResponse(error);
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
    const result = await backendCredentialsApi.deleteCredential(id, user, getInternalApiKey());
    return NextResponse.json(result);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
