export interface OneCLIBrowserLocation {
  hostname: string;
  protocol: string;
}

export interface OneCLIGenericSecretPrefill {
  format?: string;
  header?: string;
  host: string;
  name?: string;
  parameter?: string;
  parameterFormat?: string;
  path?: string;
}

const DEFAULT_LOCAL_ONECLI_URL = 'http://127.0.0.1:10254';

function currentBrowserLocation(): OneCLIBrowserLocation | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location;
}

export function isTrustedOneCLIEmbedUrl(
  value: string,
  configuredAppUrl: string,
  agencyOrigin = typeof window === 'undefined' ? undefined : window.location.origin
) {
  if (!agencyOrigin) return false;

  try {
    const embedUrl = new URL(value);
    const trustedUrl = new URL(configuredAppUrl);
    const agencyUrl = new URL(agencyOrigin);
    if (!['http:', 'https:'].includes(embedUrl.protocol)) return false;
    if (embedUrl.origin !== trustedUrl.origin || embedUrl.origin === agencyUrl.origin) return false;
    // Avoid mixed-content downgrades in deployed HTTPS environments while
    // retaining explicit HTTP origins for local development.
    return agencyUrl.protocol !== 'https:' || embedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Rewrites container-only and loopback hosts for the browser that is viewing Open Agency.
 * This keeps local, LAN, and Tailscale access working without exposing Docker DNS names.
 */
export function normalizeOneCLIUrl(
  value: string,
  browserLocation: OneCLIBrowserLocation | undefined = currentBrowserLocation()
) {
  try {
    const url = new URL(value);
    const browserHostname = browserLocation?.hostname;

    if (
      browserHostname &&
      (url.hostname === 'onecli' || url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      url.hostname = browserHostname;
    }

    return url.toString();
  } catch {
    return value;
  }
}

export function getOneCLIAppUrl(
  configuredUrl = process.env.NEXT_PUBLIC_ONECLI_APP_URL,
  browserLocation: OneCLIBrowserLocation | undefined = currentBrowserLocation()
) {
  return normalizeOneCLIUrl(configuredUrl?.trim() || DEFAULT_LOCAL_ONECLI_URL, browserLocation);
}

export function buildOneCLIConnectionsUrl(appUrl: string) {
  try {
    const url = new URL(appUrl);
    url.pathname = '/connections';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return appUrl;
  }
}

/**
 * Routes Open Agency sessions into a OneCLI screen that can actually collect credentials.
 * Unknown connectors stay in OneCLI's Generic Secret chooser. The backend owns
 * the native app id/profile so navigation and server-side verification cannot drift.
 */
export function buildOneCLIConnectorSetupUrl({
  genericSecret,
  nativeAppId,
  setupUrl,
}: {
  genericSecret?: OneCLIGenericSecretPrefill;
  nativeAppId?: string | null;
  setupUrl: string;
}) {
  const normalized = normalizeOneCLIUrl(setupUrl);

  try {
    const url = new URL(normalized);
    url.search = '';
    url.hash = '';

    if (nativeAppId) {
      url.pathname = '/connections';
      url.searchParams.set('connect', nativeAppId);
      return url.toString();
    }

    url.pathname = '/connections/custom';
    if (!genericSecret?.host) {
      url.searchParams.set('action', 'new');
      return url.toString();
    }

    url.searchParams.set('create', 'generic');
    url.searchParams.set('host', genericSecret.host);
    if (genericSecret.name) url.searchParams.set('name', genericSecret.name);
    if (genericSecret.path) url.searchParams.set('path', genericSecret.path);
    if (genericSecret.header) url.searchParams.set('header', genericSecret.header);
    if (genericSecret.format) url.searchParams.set('format', genericSecret.format);
    if (genericSecret.parameter) url.searchParams.set('param', genericSecret.parameter);
    if (genericSecret.parameterFormat) {
      url.searchParams.set('paramFormat', genericSecret.parameterFormat);
    }
    return url.toString();
  } catch {
    return normalized;
  }
}
