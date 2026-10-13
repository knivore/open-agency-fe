import {NextResponse} from 'next/server';
import {agencyApiClient} from '@/lib/api/clientInstances';
import {currentUserHeaders} from '@/lib/api/backend/identity';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

type Context = { params: Promise<{ installationId: string; action?: string[] }> };

async function proxy(context: Context, method: 'GET' | 'POST') {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();
    const {installationId, action = []} = await context.params;
    // Restrict the catch-all to this flow; never forward arbitrary backend paths.
    if (
      action.length > 1 ||
      (action.length === 1 &&
        (!['start', 'verify', 'test', 'enable', 'disconnect'].includes(action[0]) ||
          method !== 'POST'))
    ) {
      return NextResponse.json({detail: 'Unknown WhatsApp setup action'}, {status: 404});
    }
    await syncCurrentBackendUser(user);
    const path = `/integrations/connectors/installations/${encodeURIComponent(installationId)}/whatsapp-setup${action.length ? `/${action[0]}` : ''}`;
    const options = {headers: currentUserHeaders(user, getInternalApiKey())};
    const result =
      method === 'GET'
        ? await agencyApiClient.get(path, options)
        : await agencyApiClient.post(path, {}, options);
    return NextResponse.json(result, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export async function GET(_request: Request, context: Context) {
  return proxy(context, 'GET');
}

export async function POST(_request: Request, context: Context) {
  return proxy(context, 'POST');
}
