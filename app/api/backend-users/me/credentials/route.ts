import { NextResponse } from 'next/server';

import { backendUsersApi, type BackendLocalCredentialsPatch } from '@/lib/api/backend/users';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const patch = (await request.json()) as BackendLocalCredentialsPatch;
    const result = await backendUsersApi.updateLocalCredentials(user, patch, getInternalApiKey());
    return NextResponse.json(result);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
