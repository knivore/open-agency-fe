import {afterEach, describe, expect, it, vi} from 'vitest';
import {chromeConnectRequest, detectCompanion, offerCompanionConnection} from './localConnect';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('local connection transports', () => {
  it('accepts only the matching same-window, same-origin extension response', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      const data = {
        source: 'agency-connect-extension',
        request_id: message.request_id,
        status: 'available',
        version: '0.3.2',
      };
      window.dispatchEvent(
        new MessageEvent('message', {source: window, origin: 'https://evil.example', data})
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: {...data, request_id: 'wrong'},
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {source: window, origin: window.location.origin, data})
      );
    });
    await expect(chromeConnectRequest('detect')).resolves.toEqual({
      status: 'available',
      version: '0.3.2',
    });
  });
  it('times out missing extensions and removes the response listener', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'postMessage').mockImplementation(() => {
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const result = expect(chromeConnectRequest('detect')).rejects.toThrow('not available');
    await vi.advanceTimersByTimeAsync(1501);
    await result;
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });
  it('does not mistake an offered request for a paired Chrome session', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      expect(message.code).toBe('synthetic-code');
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: {
            source: 'agency-connect-extension',
            request_id: message.request_id,
            status: 'awaiting_site_approval',
          },
        })
      );
    });
    await expect(chromeConnectRequest('connect', 'synthetic-code')).resolves.toEqual({
      status: 'awaiting_site_approval',
    });
  });
  it('uses only the fixed loopback setup API, omits credentials and rejects redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'available',
          version: 1,
          challenge: 'synthetic-challenge-123456',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({status: 'awaiting_window_approval'}),
      });
    vi.stubGlobal('fetch', fetchMock);
    const challenge = await detectCompanion();
    await offerCompanionConnection('synthetic-pair-code', challenge);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:18765/status',
      expect.objectContaining({credentials: 'omit', redirect: 'error', cache: 'no-store'})
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:18765/connect',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        body: JSON.stringify({code: 'synthetic-pair-code', challenge}),
      })
    );
  });
  it('rejects a service with an unexpected protocol before any pairing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'available',
          version: 2,
          challenge: 'synthetic-challenge-123456',
        }),
      })
    );
    await expect(detectCompanion()).rejects.toThrow('not running');
  });
});

describe('Chrome version readiness', () => {
  it.each(['0.2.0', '0.3.0', '0.3.1', '0.3.2-beta', '0.3', '1.0.0.0', undefined, 'invalid'])(
    'rejects unsupported version %s without offering pairing',
    async (version) => {
      const send = vi.spyOn(window, 'postMessage').mockImplementation((message) => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: window,
            origin: window.location.origin,
            data: {
              source: 'agency-connect-extension',
              request_id: message.request_id,
              status: 'available',
              version,
            },
          })
        );
      });
      await expect(chromeConnectRequest('detect')).rejects.toThrow('0.3.2 or newer');
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0].action).toBe('detect');
    }
  );
  it.each(['0.3.2', '0.3.12', '0.4.0', '1.0.0'])(
    'accepts supported release %s',
    async (version) => {
      vi.spyOn(window, 'postMessage').mockImplementation((message) => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: window,
            origin: window.location.origin,
            data: {
              source: 'agency-connect-extension',
              request_id: message.request_id,
              status: 'available',
              version,
            },
          })
        );
      });
      await expect(chromeConnectRequest('detect')).resolves.toEqual({
        status: 'available',
        version,
      });
    }
  );
});
