import { createApiClient } from '@/lib/api/client';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

export const appApiClient = createApiClient({
  baseUrl: '',
});

export const agencyApiClient = createApiClient({
  baseUrl: getAgencyApiBaseUrl(),
});
