import { describe, expect, it } from 'vitest';
import { backendRewrites } from './next.config.mjs';

describe('backendRewrites', () => {
  it('does not expose the backend tunnel by default', () => {
    expect(
      backendRewrites({
        ...process.env,
        AGENCY_FE_ENABLE_BACKEND_REWRITE: undefined,
        AGENCY_INTERNAL_API_BASE_URL: undefined,
      })
    ).toEqual([]);
  });

  it('does not expose the backend tunnel when the local flag is false', () => {
    expect(
      backendRewrites({
        ...process.env,
        AGENCY_FE_ENABLE_BACKEND_REWRITE: 'false',
        AGENCY_INTERNAL_API_BASE_URL: 'http://127.0.0.1:8000',
      })
    ).toEqual([]);
  });

  it('exposes the backend tunnel only when explicitly enabled', () => {
    expect(
      backendRewrites({
        ...process.env,
        AGENCY_FE_ENABLE_BACKEND_REWRITE: 'true',
        AGENCY_INTERNAL_API_BASE_URL: 'http://127.0.0.1:8000/',
      })
    ).toEqual([
      {
        source: '/backend/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
    ]);
  });
});
