'use client';
import { Input } from '@/components/library/shadcn/input';
import { NativeSelect } from '@/components/library/shadcn/select';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {appApiClient} from '@/lib/api/clientInstances';
import PageHeader from '@/components/app-shell/PageHeader';
import ChromeSnapshotViewer from './ChromeSnapshotViewer';
import LocalAccessInstall from './LocalAccessInstall';
import {Button} from '../library/shadcn/button';
import {Badge} from '../library/shadcn/badge';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '../library/shadcn/card';
import {Alert, AlertDescription, AlertTitle} from '../library/shadcn/alert';
import {CheckCircle2, ShieldCheck} from 'lucide-react';
import {
  localAccessQueryKey,
  localConnectionLabel,
  type LocalTarget,
  useDesktopPlatform,
  useLocalAccess,
} from '@/lib/integrations/useLocalAccess';
import {
  chromeConnectRequest,
  detectCompanion,
  offerCompanionConnection,
} from '@/lib/integrations/localConnect';

type Target = LocalTarget;
type Pairing = { pairing_code?: string; expires_in_seconds?: number };
const queryKey = localAccessQueryKey;
export default function LocalAccessSetup() {
  const client = useQueryClient();
  const [desktopPlatform, setDesktopPlatform] = useDesktopPlatform();
  // Pairing codes stay in component memory only and disappear on navigation.
  const [codes, setCodes] = useState<Partial<Record<Target, { code: string; expires: number }>>>(
    {}
  );
  const [handoffs, setHandoffs] = useState<
    Partial<Record<Target, { message: string; expires: number }>>
  >({});
  const [copied, setCopied] = useState<Target | null>(null);
  useEffect(() => {
    const expiries = Object.values(codes)
      .filter(Boolean)
      .map((code) => code!.expires);
    if (!expiries.length) return;
    const timer = setTimeout(
      () =>
        setCodes((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(([, code]) => code && code.expires > Date.now())
          )
        ),
      Math.max(0, Math.min(...expiries) - Date.now())
    );
    return () => clearTimeout(timer);
  }, [codes]);
  const status = useLocalAccess();
  // Only inspect Chrome's setup bridge automatically. Probing Native loopback
  // stays behind a user action because browsers may ask for local-network access.
  const extension = useQuery({
    queryKey: ['local-access-extension'],
    queryFn: () => chromeConnectRequest('detect'),
    retry: false,
    staleTime: 0,
  });
  const action = useMutation({
    mutationFn: ({target, action}: { target: Target; action: 'pair' | 'stop' }) =>
      appApiClient.post<Pairing>('/api/local-access', {target, action}),
    onSuccess: (result, variables) => {
      setCopied(null);
      setHandoffs((previous) => ({...previous, [variables.target]: undefined}));
      setCodes((previous) => ({
        ...previous,
        [variables.target]: result.pairing_code
          ? {
            code: result.pairing_code,
            expires: Date.now() + (result.expires_in_seconds || 300) * 1000,
          }
          : undefined,
      }));
      void client.invalidateQueries({queryKey});
    },
  });
  const connect = useMutation({
    mutationFn: async ({
                         target,
                         waitForLaunch = false,
                       }: {
      target: Target;
      waitForLaunch?: boolean;
    }) => {
      // Detect before creating an owner-bound code; never offer a code to an
      // incompatible setup transport or expose it in a URL, browser storage or clipboard.
      const challenge =
        target === 'chrome'
          ? (await chromeConnectRequest('detect'), null)
          : await detectCompanion(waitForLaunch);
      const pairing = await appApiClient.post<Pairing>('/api/local-access', {
        target,
        action: 'pair',
      });
      if (!pairing.pairing_code) throw new Error('Could not prepare the connection. Try again.');
      setHandoffs((previous) => ({
        ...previous,
        [target]: {
          message: 'Connection prepared. Complete local approval, or Stop connection to cancel.',
          expires: Date.now() + 300000,
        },
      }));
      if (target === 'chrome') await chromeConnectRequest('connect', pairing.pairing_code);
      else await offerCompanionConnection(pairing.pairing_code, challenge!);
      return target;
    },
    onSuccess: (target) => {
      setCodes((previous) => ({...previous, [target]: undefined}));
      setHandoffs((previous) => ({
        ...previous,
        [target]: {
          expires: Date.now() + 300000,
          message:
            target === 'chrome'
              ? 'Choose allowed sites in the Chrome approval tab. Agency will show Connected after pairing succeeds.'
              : 'Choose allowed windows in the companion and click Connect selected apps. Agency will show Connected after pairing succeeds.',
        },
      }));
      void client.invalidateQueries({queryKey});
    },
  });
  useEffect(() => {
    const pending = Object.values(handoffs).filter(Boolean);
    if (!pending.length) return;
    const timer = setTimeout(
      () =>
        setHandoffs((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(
              ([, handoff]) => handoff && handoff.expires > Date.now()
            )
          )
        ),
      Math.max(0, Math.min(...pending.map((handoff) => handoff!.expires)) - Date.now())
    );
    return () => clearTimeout(timer);
  }, [handoffs]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Browser & local apps"
        tone="integration"
        description="Connect your signed-in browser and selected Windows or macOS apps to Open Agency."
        actions={
          <Link className="rounded-lg border px-4 py-2" href="/integrations">
            Back to integrations
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Connect this computer
          </CardTitle>
          <CardDescription>
            Install once, choose access, then let Agency handle pairing. You can connect Chrome,
            Local apps, or both.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-3 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true"/>
          <p>
            You approve the sites and windows Agency may use. Installation alone grants no access.
            Stop connection revokes access at any time.
          </p>
        </CardContent>
      </Card>
      {status.error ? (
        <Alert variant="destructive">
          <AlertTitle>Connection status is unavailable</AlertTitle>
          <AlertDescription>
            Agency could not check your connections. Your extension or companion may still be
            installed.
          </AlertDescription>
          <Button className="mt-3" variant="outline" onClick={() => void status.refetch()}>
            Retry status check
          </Button>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {(['chrome', 'apps'] as const).map((target) => {
          const current = status.data?.[target];
          const code = codes[target];
          const connected = current?.status === 'connected';
          const awaiting = !connected && Boolean(handoffs[target]);
          const targetError = connect.variables?.target === target ? connect.error : null;
          const actionError = action.variables?.target === target ? action.error : null;
          const ready = target === 'chrome' && extension.isSuccess;
          return (
            <section
              key={target}
              className="space-y-4 rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-950"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {target === 'chrome' ? 'Signed-in Chrome' : 'Local apps'}
                </h2>
                <Badge role="status" variant={connected ? 'successful' : 'outline'}>
                  {status.error
                    ? 'Status unavailable'
                    : connected
                      ? 'Connected'
                      : awaiting
                        ? 'Awaiting approval'
                        : localConnectionLabel(current?.status)}
                </Badge>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {target === 'chrome'
                  ? 'Agency uses your existing sign-in on sites you select. Your browser stays separate from the managed testing browser.'
                  : 'Agency can read selected open app windows. Each click or text change asks for your approval in the companion.'}
              </p>
              {target === 'apps' ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label htmlFor="companion-platform">Install for</label>
                  <NativeSelect
                    id="companion-platform"
                    aria-label="Companion platform"
                    className="rounded-md border bg-background p-2"
                    value={desktopPlatform}
                    onChange={(event) =>
                      setDesktopPlatform(event.target.value === 'macos' ? 'macos' : 'windows')
                    }
                  >
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                  </NativeSelect>
                  {connected && current?.platform ? (
                    <span>
                      Connected companion: {current.platform === 'macos' ? 'macOS' : 'Windows'}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <ol
                aria-label={`${target === 'chrome' ? 'Chrome' : 'Local apps'} setup progress`}
                className="flex flex-col gap-2 rounded-lg border p-4 text-sm"
              >
                <li aria-current={!ready && !awaiting && !connected ? 'step' : undefined}>
                  <strong>1. Install once</strong> ·{' '}
                  {connected || awaiting || ready
                    ? 'Ready'
                    : target === 'chrome'
                      ? extension.isFetching
                        ? 'Checking extension…'
                        : 'Install or update required'
                      : 'Open or install the companion below'}
                </li>
                <li aria-current={!connected && (ready || awaiting) ? 'step' : undefined}>
                  <strong>2. Approve access</strong> ·{' '}
                  {connected
                    ? 'Approved'
                    : target === 'chrome'
                      ? 'Choose allowed sites in Chrome'
                      : 'Choose allowed app windows'}
                </li>
                <li aria-current={connected ? 'step' : undefined}>
                  <strong>3. Connect automatically</strong> ·{' '}
                  {connected
                    ? 'Connected to Agency'
                    : awaiting
                      ? 'Waiting for your approval'
                      : 'No pairing code to copy'}
                </li>
              </ol>
              {!connected &&
              !awaiting &&
              !ready &&
              !(target === 'chrome' && extension.isFetching) ? (
                <LocalAccessInstall
                  target={target}
                  platform={desktopPlatform}
                  busy={connect.isPending}
                  onLaunch={() => connect.mutate({target, waitForLaunch: true})}
                  onCheckChrome={() => void extension.refetch()}
                />
              ) : null}
              {ready && !connected && !awaiting ? (
                <p role="status" className="text-sm">
                  Chrome extension {extension.data?.version || ''} is ready. Continue to choose
                  allowed sites.
                </p>
              ) : null}
              {targetError || actionError ? (
                <Alert variant="destructive">
                  <AlertTitle>Connection needs attention</AlertTitle>
                  <AlertDescription>{(targetError || actionError)?.message}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-lg bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
                  disabled={
                    action.isPending ||
                    connect.isPending ||
                    status.isLoading ||
                    status.isError ||
                    (target === 'chrome' && !ready) ||
                    connected ||
                    awaiting
                  }
                  onClick={() => {
                    action.reset();
                    connect.mutate({target});
                  }}
                >
                  {connected
                    ? 'Connected'
                    : connect.isPending && connect.variables?.target === target
                      ? 'Opening connection...'
                      : target === 'chrome'
                        ? 'Connect Chrome'
                        : 'Connect apps'}
                </button>
                <button
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
                  disabled={
                    action.isPending ||
                    connect.isPending ||
                    (!handoffs[target] && !code && (!current || current.status === 'not_paired'))
                  }
                  onClick={() => {
                    connect.reset();
                    action.mutate({target, action: 'stop'});
                  }}
                >
                  Stop connection
                </button>
              </div>
              {!connected && handoffs[target] ? (
                <p role="status" className="rounded-lg border border-violet-200 p-3 text-sm">
                  {handoffs[target]?.message}
                </p>
              ) : null}
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Manual setup fallback</summary>
                <ol className="mt-3 list-decimal space-y-3 pl-5">
                  <li>
                    <a className="underline" href={`/api/local-access/download/${target}`}>
                      Download{' '}
                      {target === 'chrome' ? 'the Chrome connection' : 'the Windows companion'}
                    </a>{' '}
                    and extract it.
                  </li>
                  <li>
                    {target === 'chrome'
                      ? 'In Chrome Extensions, turn on Developer mode, choose Load unpacked, then select the extracted agency-chrome folder.'
                      : 'Open desktop_companion and double-click Start-Companion.'}
                  </li>
                  <li>
                    {target === 'chrome'
                      ? 'Create a code below and paste it in the Agency extension, then choose allowed sites.'
                      : 'Create a code below and paste it in the companion, then select allowed windows.'}
                  </li>
                </ol>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-lg border px-4 py-2 disabled:opacity-50"
                    disabled={action.isPending || connect.isPending || status.isLoading}
                    onClick={() => action.mutate({target, action: 'pair'})}
                  >
                    {connected ? 'Create replacement code' : 'Create pairing code'}
                  </button>
                </div>
                {/* Expiry is handled by the timer effect; render stays independent of the clock. */}
                {code ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <label className="block text-sm" htmlFor={`${target}-code`}>
                      One-time code · expires in five minutes
                    </label>
                    <Input
                      id={`${target}-code`}
                      type="password"
                      readOnly
                      value={code.code}
                      className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm"
                    />
                    <button
                      className="text-sm underline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(code.code);
                          setCopied(target);
                        } catch {
                          setCopied(null);
                        }
                      }}
                    >
                      {copied === target ? 'Copied' : 'Copy code'}
                    </button>
                    <p className="text-xs">
                      Creating a code does not connect an app. Access starts after you pair and
                      choose sites or windows.
                    </p>
                  </div>
                ) : null}
              </details>
              {current?.pending_action ? (
                <p role="status">
                  Awaiting action: {current.pending_action}. Review it in{' '}
                  {target === 'chrome' ? 'the extension' : 'the companion'}.
                </p>
              ) : null}
              {connected ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true"/>
                  Agency confirmed this connection.
                </p>
              ) : null}
              {target === 'chrome' && connected ? (
                <details className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Test browser access</summary>
                  <ChromeSnapshotViewer connected/>
                </details>
              ) : null}
            </section>
          );
        })}
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Pairing lasts up to eight hours and ends on Agency restart. Stop prevents future commands;
        completed actions remain. Workflow fixes are reviewed in{' '}
        <Link href="/operations/main-agent-monitor" className="underline">
          Monitor
        </Link>{' '}
        and the associated Main Agent chat.
      </p>
    </div>
  );
}
