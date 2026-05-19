import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { executionsApi } from '@/lib/api/backend';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ process_id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const { process_id: processId } = await params;
  const headersList = await headers();

  if (headersList.get('accept') !== 'text/event-stream') {
    return new NextResponse('This endpoint requires SSE.', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await executionsApi.streamExecutionEvents(processId, 0, user, getInternalApiKey());

        if (!response.body) {
          throw new Error('No response body from backend');
        }

        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += textDecoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (event.trim()) {
              controller.enqueue(encoder.encode(event + '\n\n'));

              if (event.includes('event: close')) {
                controller.close();
                return;
              }
            }
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
