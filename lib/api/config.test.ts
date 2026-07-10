import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

const ORIGINAL_ENV = process.env;

describe('getAgencyApiBaseUrl', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('uses an explicit public backend URL when configured', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_AGENCY_API_BASE_URL: 'https://agency-runtime.example.com/',
    };

    expect(getAgencyApiBaseUrl()).toBe('https://agency-runtime.example.com');
  });

  it('uses the local backend URL for local app mode when no explicit URL is configured', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_AGENCY_API_BASE_URL: '',
      LOCAL_BACKEND: '',
      NEXT_PUBLIC_APP_ENV: 'local',
    };

    expect(getAgencyApiBaseUrl()).toBe('http://127.0.0.1:8000');
  });

  it('preserves explicit local rewrite paths for browser callers', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_AGENCY_API_BASE_URL: '/backend',
    };
    vi.stubGlobal('window', {});

    expect(getAgencyApiBaseUrl()).toBe('/backend');
  });
});
