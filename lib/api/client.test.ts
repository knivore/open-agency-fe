import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not expose text/html server traceback bodies as 5xx error messages', async () => {
    const tracebackBody = `
      <html>
        <body>
          validation = self.context.tool_service.validate_definition(proposed_tool)
          async def _workflow_from_update_request(self, *, current_workflow):
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(tracebackBody, {
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      })
    );

    const client = createApiClient({ baseUrl: 'http://api.test', includeAuthToken: false });

    await expect(client.get('/assistant')).rejects.toMatchObject({
      status: 500,
      message: 'The server failed to process the request.',
    });
  });

  it('preserves structured JSON error messages from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ detail: 'Invalid request payload.' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      })
    );

    const client = createApiClient({ baseUrl: 'http://api.test', includeAuthToken: false });

    await expect(client.get('/assistant')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid request payload.',
    });
  });
});
