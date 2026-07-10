import { NextResponse } from 'next/server';
import { backendUsersApi } from '@/lib/api/backend/users';
import { getAuthenticatedUser, proxyErrorResponse, unauthorizedResponse } from '@/app/api/backend-users/utils';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const url = new URL(req.url);
    const email = url.searchParams.get('email') || '';
    const users = email ? await backendUsersApi.searchUsers(email) : { items: [] };
    return NextResponse.json(users);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
