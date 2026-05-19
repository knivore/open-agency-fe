import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { executionsApi } from '@/lib/api/backend';
import { ZodError } from 'zod';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ process_id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorizedResponse();
  }
  const { process_id: processId } = await params;
  const headersList = await headers();
  console.log(`Starting SSE connection for process ${processId}`);

  if (headersList.get('accept') !== 'text/event-stream') {
    return new NextResponse('This endpoint requires SSE.', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await executionsApi.streamHumanLoop(processId, user, getInternalApiKey());

        if (!response.ok) {
          throw new Error(`Backend responded with status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body from backend');
        }

        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.enqueue(encoder.encode('event: close\ndata: Stream closed\n\n'));
            controller.close();
            break;
          }

          buffer += textDecoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (event.trim()) {
              const formattedEvent = event.startsWith('data: ') ? event : `data: ${event}`;
              controller.enqueue(encoder.encode(`${formattedEvent}\n\n`));

              if (formattedEvent.includes('event: close')) {
                console.log('Stream closed by server.');
                controller.close();
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
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

    cancel() {
      console.log('Client closed connection');
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    const body = await req.json();
    const reply = await executionsApi.replyToHumanLoop(
      body.process_id,
      body.reply,
      user,
      getInternalApiKey()
    );
    return NextResponse.json({
      message: 'Reply sent successfully',
      data: reply,
      status: 200,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Validation error:', e.issues);
      return NextResponse.json({
        message: `Invalid request body: ${e.issues}`,
        status: 400,
      });
    }
    return proxyErrorResponse(e);
  }
}
