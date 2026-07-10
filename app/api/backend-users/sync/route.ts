import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    const backendUser = await syncCurrentBackendUser(user);
    return NextResponse.json(backendUser);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
