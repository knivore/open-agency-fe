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

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();
    await syncCurrentBackendUser(user);
    const {jobId} = await context.params;
    return NextResponse.json(
      await agencyApiClient.post(
        `/main-agent/monitor/reviews/${encodeURIComponent(jobId)}/retry`,
        {},
        {headers: currentUserHeaders(user, getInternalApiKey())}
      ),
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
