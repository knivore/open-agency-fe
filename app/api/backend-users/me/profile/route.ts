import { NextResponse } from 'next/server';

import { backendUsersApi, type BackendUserProfilePatch } from '@/lib/api/backend/users';
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

    const patch = (await request.json()) as BackendUserProfilePatch;
    const backendUser = await backendUsersApi.updateCurrentUserProfile(
      user,
      patch,
      getInternalApiKey()
    );
    return NextResponse.json(backendUser);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
