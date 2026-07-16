import { NextResponse } from 'next/server';
import { executionsApi } from '@/lib/api/backend/executions';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(req: Request, { params }: { params: Promise<{ process_id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const { process_id: processId } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  if (type === 'images') {
    try {
      const response = await executionsApi.streamArtifactImages(
        processId,
        user,
        getInternalApiKey()
      );

      if (!response.ok) {
        throw new Error(`Backend service error: ${response.status}`);
      }

      const body = response.body;
      if (!body) {
        throw new Error('No response body from backend service');
      }

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'multipart/x-mixed-replace',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      console.error('Error streaming images:', error);
      return NextResponse.json({ error: 'Failed to stream images' }, { status: 500 });
    }
  }

  return new NextResponse(
    JSON.stringify({
      error: 'Unsupported artifact type. Currently only "images" type is supported',
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
