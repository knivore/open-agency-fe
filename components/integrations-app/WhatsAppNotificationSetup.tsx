'use client';
import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {connectorsApi, type WhatsAppSetupStatus} from '@/lib/api/backend/connectors';
import {queryKeys} from '@/lib/react-query/queryKeys';
import type {ConnectorInstallationDefinition} from '@/types/integrations';
import {Button} from '@/components/library/shadcn/button';
import {Alert, AlertDescription, AlertTitle} from '@/components/library/shadcn/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';

export default function WhatsAppNotificationSetup({
                                                    installation,
                                                    mode,
                                                  }: {
  installation?: ConnectorInstallationDefinition;
  mode?: 'personal' | 'business';
}) {
  const client = useQueryClient();
  const [created, setCreated] = useState<ConnectorInstallationDefinition>();
  const [selected, setSelected] = useState('');
  const [handoff, setHandoff] = useState<
    Pick<WhatsAppSetupStatus, 'link_url' | 'webhook_url' | 'webhook_verify_token'>
  >({});
  const list = useQuery({
    queryKey: ['connectorInstallations'],
    queryFn: () => connectorsApi.listConnectorInstallations(),
    enabled: !installation,
  });
  const items = (installation ? [installation] : (list.data?.items ?? [])).filter(
    (item) =>
      ['whatsapp-personal', 'whatsapp-cloud-api'].includes(item.provider) &&
      ['setup_pending', 'active'].includes(item.status) &&
      (!mode ||
        item.provider === (mode === 'personal' ? 'whatsapp-personal' : 'whatsapp-cloud-api'))
  );
  const item = installation ?? created ?? items.find((item) => item.id === selected) ?? items[0];
  const id = item?.id;
  const personal = item ? item.provider === 'whatsapp-personal' : mode === 'personal';
  const status = useQuery({
    queryKey: ['whatsappSetup', id],
    queryFn: () => connectorsApi.whatsappSetupStatus(id!),
    enabled: Boolean(id && (personal || item?.status === 'active')),
    retry: false,
    // QR refresh and confirmation need polling; completed routes refresh on focus.
    refetchInterval: (query) =>
      query.state.data &&
      !query.state.data.setup_expired &&
      !['enabled', 'expired'].includes(query.state.data.linking.status)
        ? 3000
        : false,
  });
  const create = useMutation({
    mutationFn: () =>
      connectorsApi.createConnectorSetupSession('whatsapp-personal', {name: 'Personal WhatsApp'}),
    onSuccess: async (result) => {
      setCreated(result.installation);
      await connectorsApi.whatsappSetupAction(result.installation.id, 'start');
      await client.invalidateQueries({queryKey: ['connectorInstallations']});
    },
  });
  const action = useMutation({
    mutationFn: (step: 'start' | 'verify' | 'test' | 'enable' | 'disconnect') =>
      connectorsApi.whatsappSetupAction(id!, step),
    onSuccess: async (result, step) => {
      if (step === 'start' && !personal)
        setHandoff({
          link_url: result.link_url,
          webhook_url: result.webhook_url,
          webhook_verify_token: result.webhook_verify_token,
        });
      if (step === 'disconnect') {
        setCreated(undefined);
        setSelected('');
        setHandoff({});
      }
      await Promise.all([
        client.invalidateQueries({queryKey: ['whatsappSetup', id]}),
        client.invalidateQueries({queryKey: ['connectorInstallations']}),
        client.invalidateQueries({queryKey: queryKeys.backendIntegrations()}),
        client.invalidateQueries({queryKey: queryKeys.backendMainAgentMonitor()}),
      ]);
    },
  });
  const current = status.data;
  const state = current?.linking.status ?? 'not_linked';
  const busy = create.isPending || action.isPending;
  const error = create.error ?? action.error ?? status.error ?? list.error;
  return (
    <section
      aria-label="WhatsApp notifications"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 className="text-lg font-semibold">Connect WhatsApp notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose a connection in Integrations, verify your account, then enable main-agent alerts.
        </p>
      </div>
      {!id ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Personal WhatsApp uses a QR code. WhatsApp Business uses Meta&apos;s official API and
            OneCLI.
          </p>
          {mode === 'personal' ? (
            <Button disabled={busy} onClick={() => create.mutate()}>
              Start personal WhatsApp setup
            </Button>
          ) : null}
          <a
            className="underline"
            href="/integrations?integration-tab=communications&integration-connector=communications-whatsapp-personal"
          >
            Personal WhatsApp setup
          </a>
          <a
            className="underline"
            href="/integrations?integration-tab=communications&integration-connector=communications-whatsapp-cloud-api"
          >
            WhatsApp Business setup
          </a>
        </div>
      ) : (
        <>
          {items.length > 1 ? (
            <Select
              value={id}
              disabled={busy}
              onValueChange={(value) => {
                setSelected(value);
                setCreated(undefined);
                setHandoff({});
                action.reset();
              }}
            >
              <SelectTrigger aria-label="WhatsApp connection">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {items.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name} ·{' '}
                      {entry.provider === 'whatsapp-personal' ? 'Personal' : 'Business'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          <ol
            aria-label="WhatsApp connection progress"
            className="grid gap-2 text-sm sm:grid-cols-3"
          >
            <li>{current?.account_connected ? 'Done:' : '1.'} Account connected</li>
            <li>{['verified', 'enabled'].includes(state) ? 'Done:' : '2.'} Test confirmed</li>
            <li>{state === 'enabled' ? 'Done:' : '3.'} Alerts enabled</li>
          </ol>
          {personal ? (
            <Alert>
              <AlertTitle>Personal linked-device connection</AlertTitle>
              <AlertDescription>
                This is an unofficial WhatsApp connection. Session keys stay in the private bridge.
                Notifications go to your own account; other chats are not imported.
              </AlertDescription>
            </Alert>
          ) : null}
          {current?.qr_data_url?.startsWith('data:image/png;base64,') ? (
            <div className="flex flex-col items-center gap-2">
              {/* This QR is an authentication handoff, never an agent transcript or external image URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.qr_data_url}
                alt="Scan this WhatsApp linking QR code"
                className="size-64 max-w-full"
              />
              <p className="text-sm">On your phone: WhatsApp → Linked devices → Link a device.</p>
            </div>
          ) : null}
          {personal && !current?.account_connected && !current?.setup_expired ? (
            <Button disabled={busy} onClick={() => action.mutate('start')}>
              {current?.bridge_status === 'qr' ? 'Refresh QR connection' : 'Show linking QR code'}
            </Button>
          ) : null}
          {personal && current?.account_connected && current.connection_status !== 'active' ? (
            <Button disabled={busy} onClick={() => action.mutate('verify')}>
              Verify linked account
            </Button>
          ) : null}
          {personal &&
          current?.connection_status === 'active' &&
          ['not_linked', 'expired', 'waiting'].includes(state) ? (
            <Button disabled={busy} onClick={() => action.mutate('test')}>
              {state === 'waiting'
                ? 'Resend confirmation test to myself'
                : 'Send confirmation test to myself'}
            </Button>
          ) : null}
          {!personal && ['not_linked', 'expired'].includes(state) ? (
            <Button disabled={busy} onClick={() => action.mutate('start')}>
              Prepare Business WhatsApp link
            </Button>
          ) : null}
          {!personal && handoff.webhook_url ? (
            <Alert>
              <AlertTitle>Connect Meta&apos;s incoming messages</AlertTitle>
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  <p>
                    In Meta&apos;s WhatsApp configuration, save this callback and verification
                    token, and subscribe to messages. If your business account is configured, Agency
                    also requests its subscription automatically.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(handoff.webhook_url!)}
                  >
                    Copy callback URL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(handoff.webhook_verify_token!)}
                  >
                    Copy verification token
                  </Button>
                  <p>
                    {current?.webhook_verified
                      ? 'Incoming connection verified.'
                      : 'Waiting for Meta verification or your signed linking message.'}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          {!personal && handoff.link_url ? (
            <a
              className="underline"
              href={handoff.link_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open WhatsApp and send the linking message
            </a>
          ) : null}
          {!personal && state === 'waiting' && !handoff.link_url ? (
            <Button variant="outline" disabled={busy} onClick={() => action.mutate('start')}>
              Get a fresh linking message
            </Button>
          ) : null}
          {['waiting', 'linked'].includes(state) ? (
            <p role="status">
              {personal
                ? 'Open your WhatsApp self-chat and reply with the CONFIRM code from the test.'
                : 'Send the linking message and tap Confirm connection on the test reply.'}
            </p>
          ) : null}
          {state === 'verified' ? (
            <>
              <p role="status">
                Connection test confirmed. Enabling alerts will make this your main-agent
                notification route.
              </p>
              <Button disabled={busy} onClick={() => action.mutate('enable')}>
                Enable WhatsApp alerts
              </Button>
            </>
          ) : null}
          {state === 'enabled' ? (
            <p role="status">
              WhatsApp alerts enabled. Review and approve requests in Open Agency&apos;s Human
              Attention Inbox.
            </p>
          ) : null}
          {current?.setup_expired ? (
            <p role="status">Setup expired. Disconnect this session, then start a fresh setup.</p>
          ) : null}
          {personal ? (
            <Button variant="outline" disabled={busy} onClick={() => action.mutate('disconnect')}>
              Disconnect personal WhatsApp
            </Button>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Connection failed. Retry the setup step.'}
        </p>
      ) : null}
    </section>
  );
}
