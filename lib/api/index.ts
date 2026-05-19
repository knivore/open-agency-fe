import { createApiClient } from '@/lib/api/client';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

export { createApiClient } from '@/lib/api/client';
export { getAgencyApiBaseUrl } from '@/lib/api/config';
export { ApiError, isApiError } from '@/lib/api/errors';

export const appApiClient = createApiClient({
  baseUrl: '',
});

export const agencyApiClient = createApiClient({
  baseUrl: getAgencyApiBaseUrl(),
});
