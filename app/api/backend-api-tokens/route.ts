import { NextResponse } from 'next/server';
import { backendApiTokensApi } from '@/lib/api/backend/apiTokens';
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
    const tokens = await backendApiTokensApi.listTokens(user, getInternalApiKey());
    return NextResponse.json(tokens);
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
    const token = await backendApiTokensApi.createToken(payload, user, getInternalApiKey());
    return NextResponse.json(token);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
