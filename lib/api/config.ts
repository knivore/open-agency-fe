const DEFAULT_PUBLIC_BACKEND_PATH = '';
const DEFAULT_LOCAL_BACKEND_URL = 'http://127.0.0.1:8000';

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getAgencyApiBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_AGENCY_API_BASE_URL ||
    process.env.LOCAL_BACKEND ||
    DEFAULT_PUBLIC_BACKEND_PATH;

  if (configuredUrl) {
    if (typeof window === 'undefined' && configuredUrl.startsWith('/')) {
      return stripTrailingSlash(
        process.env.AGENCY_INTERNAL_API_BASE_URL || DEFAULT_LOCAL_BACKEND_URL
      );
    }
    return stripTrailingSlash(configuredUrl);
  }

  if (process.env.NEXT_PUBLIC_APP_ENV === 'local') {
    return DEFAULT_LOCAL_BACKEND_URL;
  }

  return '';
}

export function isAgencyDevAuthEnabled() {
  if (process.env.NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED === 'true') {
    return true;
  }

  return process.env.NEXT_PUBLIC_APP_ENV === 'local';
}
