type TokenProvider = () => string | null | undefined | Promise<string | null | undefined>;
type IdentityHeadersProvider = () =>
  | HeadersInit
  | null
  | undefined
  | Promise<HeadersInit | null | undefined>;

const DEFAULT_TOKEN_KEYS = ['agency_api_token', 'agencyApiToken'];

let tokenProvider: TokenProvider | null = null;
let identityHeadersProvider: IdentityHeadersProvider | null = null;

export function setApiClientTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

export function setApiClientIdentityHeadersProvider(provider: IdentityHeadersProvider | null) {
  identityHeadersProvider = provider;
}

async function getTokenFromProvider() {
  if (!tokenProvider) {
    return null;
  }

  return (await tokenProvider()) ?? null;
}

async function getIdentityHeadersFromProvider() {
  if (!identityHeadersProvider) {
    return null;
  }

  return (await identityHeadersProvider()) ?? null;
}

function getTokenFromStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const key of DEFAULT_TOKEN_KEYS) {
    const localValue = window.localStorage.getItem(key);
    if (localValue) {
      return localValue;
    }

    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) {
      return sessionValue;
    }
  }

  return null;
}

export async function getApiClientAuthToken() {
  const providedToken = await getTokenFromProvider();
  if (providedToken || tokenProvider) {
    return providedToken;
  }

  return getTokenFromStorage();
}

export async function getApiClientIdentityHeaders() {
  return getIdentityHeadersFromProvider();
}
