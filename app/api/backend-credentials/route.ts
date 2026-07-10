import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend/credentials';
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
    const credentials = await backendCredentialsApi.listCredentials(user, getInternalApiKey());
    return NextResponse.json(credentials);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const payload = await req.json();
    const credential = await backendCredentialsApi.createCredential(payload, user, getInternalApiKey());
    return NextResponse.json(credential);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
