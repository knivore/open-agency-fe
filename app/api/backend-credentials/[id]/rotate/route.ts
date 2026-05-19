import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend';
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
    const payload = await req.json().catch(() => ({}));
    const credential = await backendCredentialsApi.rotateCredential(id, payload, user, getInternalApiKey());
    return NextResponse.json(credential);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
