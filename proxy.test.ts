import { describe, expect, it, vi } from 'vitest';
import { config } from './proxy';
import proxy from './proxy';
import { NextRequest } from 'next/server';

describe('proxy matcher', () => {
  it('does not invoke auth proxy for first-run setup pages', () => {
    const [matcher] = config.matcher;

    expect(matcher).toContain('setup(?:/|$)');
  });

  it('does not exempt the local backend rewrite path from frontend auth', () => {
    const [matcher] = config.matcher;

    expect(matcher).not.toContain('backend|');
    expect(matcher).not.toContain('backend');
  });
});

describe('proxy auth redirects', () => {
  it('allows a signed-out visitor to reach first-run setup routes', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    try {
      const paths = ['/setup', '/backend/setup/status', '/backend/auth/bootstrap'];

      for (const path of paths) {
        const request = new NextRequest(`http://localhost:3000${path}`);
        const response = await proxy(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('preserves the full protected target in the login callback url', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const request = new NextRequest('http://localhost:3000/memory-graph?view=connected&mode=3d');
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

  it('does not let a slash-backslash callback escape the application origin', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ user: { id: 'dev-user' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const request = new NextRequest(
        'http://localhost:3000/login?callbackUrl=%2F%5Cattacker.example'
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/workflows');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('recovers a stale unauthorized setup callback back to public setup', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const request = new NextRequest(
        'http://localhost:3000/login?callbackUrl=%2Fsetup&status=unauthorized'
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/setup');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
