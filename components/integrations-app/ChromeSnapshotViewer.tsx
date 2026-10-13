'use client';
import { NativeSelect } from '@/components/library/shadcn/select';
import {useEffect, useRef, useState} from 'react';
import {appApiClient} from '@/lib/api/clientInstances';

type Tab = { tab_id: number; title?: string; url: string; active?: boolean };
type Result = {
  status: string;
  message?: string;
  tabs?: Tab[];
  snapshot_path?: string;
  expires_in_seconds?: number;
  title?: string;
};

function ChromeSnapshotSession({connected}: { connected: boolean }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selected, setSelected] = useState<number>();
  const [snapshot, setSnapshot] = useState<Result>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    []
  );
  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(
      () => setSnapshot(undefined),
      (snapshot.expires_in_seconds || 120) * 1000
    );
    return () => clearTimeout(timer);
  }, [snapshot]);

  async function request(action: 'tabs' | 'screenshot') {
    const current = ++epoch.current;
    setPending(true);
    setError('');
    if (action === 'screenshot') setSnapshot(undefined);
    try {
      const result = await appApiClient.post<Result>(
        '/api/local-access/chrome-view',
        {
          action,
          ...(action === 'screenshot' ? {tab_id: selected} : {}),
        },
        {timeoutMs: 70000}
      );
      if (current !== epoch.current) return;
      if (result.status !== 'ok')
        throw new Error(
          result.message || 'Browser request did not complete. Inspect Chrome before retrying.'
        );
      if (action === 'tabs') {
        setTabs(result.tabs || []);
        setSelected(undefined);
      } else if (
        result.snapshot_path &&
        /^\/api\/local-access\/chrome-snapshots\/[A-Za-z0-9_-]+$/.test(result.snapshot_path)
      ) {
        setSnapshot(result);
      } else throw new Error('No private browser snapshot was returned.');
    } catch (cause) {
      if (current === epoch.current)
        setError(cause instanceof Error ? cause.message : 'Browser request failed.');
    } finally {
      if (current === epoch.current) setPending(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">View a Chrome tab</h3>
      <p className="text-sm">
        Take a snapshot of an allowed tab. Select that tab in Chrome, open the Agency extension and
        allow the screenshot. This is a temporary image, not a live video.
      </p>
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-50"
        disabled={!connected || pending}
        onClick={() => void request('tabs')}
      >
        List allowed tabs
      </button>
      {tabs.length ? (
        <label className="block text-sm">
          Tab to view
          <NativeSelect
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={selected ?? ''}
            onChange={(event) =>
              setSelected(event.target.value ? Number(event.target.value) : undefined)
            }
            disabled={pending}
          >
            <option value="">Choose a tab</option>
            {tabs.map((tab) => (
              <option key={tab.tab_id} value={tab.tab_id}>
                {tab.title || tab.url}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <button
        className="rounded-lg border px-3 py-2 disabled:opacity-50"
        disabled={!connected || pending || selected === undefined}
        onClick={() => void request('screenshot')}
      >
        Request screenshot
      </button>
      {pending ? (
        <p role="status">
          Waiting for Chrome. Review any screenshot request in the Agency extension.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {snapshot ? (
        <figure className="space-y-2">
          {/* Authenticated, no-store image: keep it out of Next's public image optimizer/cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snapshot.snapshot_path}
            alt={`Chrome snapshot: ${snapshot.title || 'selected tab'}`}
            className="w-full rounded border"
            onError={() => {
              setSnapshot(undefined);
              setError(
                'Snapshot expired or unavailable. Inspect Chrome before requesting another.'
              );
            }}
          />
          <figcaption className="text-xs">
            Latest captured view · expires after two minutes or when the connection stops.
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

export default function ChromeSnapshotViewer({connected}: { connected: boolean }) {
  // A connection boundary drops observations and invalidates in-flight requests.
  return (
    <ChromeSnapshotSession key={connected ? 'connected' : 'disconnected'} connected={connected}/>
  );
}
