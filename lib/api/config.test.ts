import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

const ORIGINAL_ENV = process.env;

describe('getAgencyApiBaseUrl', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('uses the internal backend URL on the server when the public base is a rewrite path', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_AGENCY_API_BASE_URL: '/backend',
      AGENCY_INTERNAL_API_BASE_URL: 'http://127.0.0.1:8000/',
    };
    vi.stubGlobal('window', undefined);

    expect(getAgencyApiBaseUrl()).toBe('http://127.0.0.1:8000');
  });
});
