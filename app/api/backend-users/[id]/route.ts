import { NextResponse } from 'next/server';
import { backendUsersApi } from '@/lib/api/backend/users';
import { getAuthenticatedUser, proxyErrorResponse, unauthorizedResponse } from '@/app/api/backend-users/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const backendUser = await backendUsersApi.getUser(id);
    return NextResponse.json(backendUser);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
