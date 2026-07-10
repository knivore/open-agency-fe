import { describe, expect, it } from 'vitest';
import { config } from './proxy';
import proxy from './proxy';
import { NextRequest } from 'next/server';

describe('proxy matcher', () => {
  it('does not exempt the local backend rewrite path from frontend auth', () => {
    const [matcher] = config.matcher;

    expect(matcher).not.toContain('backend|');
    expect(matcher).not.toContain('backend');
  });
});

describe('proxy auth redirects', () => {
  it('preserves the full protected target in the login callback url', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const request = new NextRequest(
        'http://localhost:3000/memory-graph?view=connected&mode=3d'
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?callbackUrl=%2Fmemory-graph%3Fview%3Dconnected%26mode%3D3d&status=unauthorized'
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns authenticated users on the login route to the requested callback url', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ user: { id: 'dev-user' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const request = new NextRequest(
        'http://localhost:3000/login?callbackUrl=%2Fmemory-graph%3Fview%3Dconnected'
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/memory-graph?view=connected'
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
