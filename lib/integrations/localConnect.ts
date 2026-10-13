export const minimumChromeVersion = '0.3.2';

function supportedChromeVersion(version: unknown): version is string {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return false;
  const actual = version.split('.').map(Number);
  const minimum = minimumChromeVersion.split('.').map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

/** Setup transports only. Connection is verified separately by the owner API. */
export function chromeConnectRequest(action: 'detect' | 'connect', code?: string) {
  return new Promise<{ status: string; version?: string }>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== 'agency-connect-extension' ||
        event.data?.request_id !== requestId
      )
        return;
      cleanup();
      if (event.data.error)
        reject(
          new Error(
            'Chrome could not open its approval screen. Update the Agency extension and try again.'
          )
        );
      else if (action === 'detect' && !supportedChromeVersion(event.data.version))
        reject(
          new Error(
            `Update the Agency Chrome extension to ${minimumChromeVersion} or newer, then refresh this page. Reloading an old extracted folder does not update its files.`
          )
        );
      else if (event.data.status === (action === 'detect' ? 'available' : 'awaiting_site_approval'))
        resolve({
          status: event.data.status,
          ...(action === 'detect' ? {version: event.data.version} : {}),
        });
      else
        reject(
          new Error('Unexpected Chrome setup response. Update the Agency extension and try again.')
        );
    };
    const timer = setTimeout(
      () => {
        cleanup();
        reject(
          new Error(
            `The Agency Chrome extension is not available in this browser profile. Open Agency in the Chrome profile where it is installed, update to ${minimumChromeVersion} or newer, then refresh this page.`
          )
        );
      },
      action === 'detect' ? 1500 : 5000
    );
    window.addEventListener('message', receive);
    window.postMessage(
      {source: 'agency-connect-page', request_id: requestId, action, ...(code ? {code} : {})},
      window.location.origin
    );
  });
}

const companionOrigin = 'http://127.0.0.1:18765';

export async function detectCompanion(waitForLaunch = false): Promise<string> {
  for (let attempt = 0; attempt < (waitForLaunch ? 15 : 1); attempt++) {
    try {
      const response = await fetch(`${companionOrigin}/status`, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(1500),
      });
      const result = response.ok ? await response.json() : null;
      if (
        result?.status === 'available' &&
        result.version === 1 &&
        typeof result.challenge === 'string' &&
        /^[A-Za-z0-9_-]{20,100}$/.test(result.challenge)
      )
        return result.challenge;
    } catch {
      /* Installed companions may take a moment to open after the OS prompt. */
    }
    if (waitForLaunch) await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(
    'The desktop companion is not running. Open it below, or install it once on this computer. Allow local-network access if your browser asks.'
  );
}

export async function offerCompanionConnection(code: string, challenge: string) {
  const response = await fetch(`${companionOrigin}/connect`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code, challenge}),
    signal: AbortSignal.timeout(5000),
  });
  const result = response.ok ? await response.json() : null;
  if (response.status !== 202 || result?.status !== 'awaiting_window_approval')
    throw new Error(
      'The companion could not accept this request. Review any pending request there, then try Connect apps again.'
    );
  return result as { status: 'awaiting_window_approval' };
}
