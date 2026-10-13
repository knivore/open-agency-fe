'use client';
import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '@/lib/react-query/queryKeys';
import {connectorsApi} from '@/lib/api/backend/connectors';
import type {ConnectorInstallationDefinition} from '@/types/integrations';
import {Button} from '@/components/library/shadcn/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';

export default function TelegramNotificationSetup({
                                                    installation,
                                                  }: {
  installation?: ConnectorInstallationDefinition;
}) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [link, setLink] = useState<string>();
  const installations = useQuery({
    queryKey: ['connectorInstallations'],
    queryFn: () => connectorsApi.listConnectorInstallations(),
    enabled: !installation,
  });
  const bots = (installation ? [installation] : (installations.data?.items ?? [])).filter(
    (item) => item.provider === 'telegram-bot' && item.status === 'active'
  );
  const id =
    installation?.id ?? (bots.some((bot) => bot.id === selectedId) ? selectedId : bots[0]?.id);
  const status = useQuery({
    queryKey: ['telegramLink', id],
    queryFn: () => connectorsApi.telegramLinkStatus(id!),
    enabled: Boolean(id),
    // Stop polling once the handshake finishes or its ten-minute window expires.
    refetchInterval: (query) =>
      ['waiting', 'linked'].includes(query.state.data?.status ?? '') ? 3000 : false,
    retry: false,
  });
  const start = useMutation({
    mutationFn: () => connectorsApi.startTelegramLink(id!),
    onSuccess: (result) => {
      setLink(result.link_url);
      client.setQueryData(['telegramLink', id], result);
    },
  });
  const enable = useMutation({
    mutationFn: () => connectorsApi.enableTelegramNotifications(id!),
    onSuccess: async (result) => {
      client.setQueryData(['telegramLink', id], result);
      await client.invalidateQueries({queryKey: queryKeys.backendMainAgentMonitor()});
    },
  });
  const state = status.data?.status ?? 'not_linked';
  const error = start.error ?? enable.error ?? status.error ?? installations.error;
  return (
    <section
      aria-label="Telegram notifications"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 className="text-lg font-semibold">Connect Telegram notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive main-agent approval requests and alerts in your private Telegram chat.
        </p>
      </div>
      <ol aria-label="Telegram connection progress" className="grid gap-2 text-sm sm:grid-cols-3">
        <li>{id ? 'Done:' : '1.'} Bot connected</li>
        <li>
          {['verified', 'enabled'].includes(state) ? 'Done:' : '2.'} Telegram account verified
        </li>
        <li>{state === 'enabled' ? 'Done:' : '3.'} Notifications enabled</li>
      </ol>
      {!id ? (
        <div>
          <p className="text-sm">
            Connect your bot through OneCLI in Integrations first. Open Agency discovers its details
            automatically.
          </p>
          <a className="mt-2 inline-block underline" href="/integrations">
            Open Integrations
          </a>
        </div>
      ) : (
        <>
          {bots.length > 1 ? (
            <Select
              value={id}
              disabled={start.isPending || enable.isPending}
              onValueChange={(value) => {
                setSelectedId(value);
                setLink(undefined);
                start.reset();
                enable.reset();
              }}
            >
              <SelectTrigger aria-label="Telegram bot">
                <SelectValue placeholder="Choose a Telegram bot"/>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          {state === 'enabled' ? (
            <p role="status">
              Notifications enabled for {status.data?.display_name ?? 'your Telegram account'}.
              Approval requests remain available in the Human Attention Inbox.
            </p>
          ) : (
            <>
              {state === 'verified' ? (
                <div className="flex flex-col gap-3">
                  <p role="status">
                    Telegram confirmed {status.data?.display_name}. Check this is your account, then
                    enable approvals and alerts.
                  </p>
                  <Button disabled={enable.isPending} onClick={() => enable.mutate()}>
                    {enable.isPending ? 'Enabling...' : 'Enable approvals and alerts'}
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    disabled={start.isPending || status.isLoading}
                    onClick={() => {
                      setLink(undefined);
                      enable.reset();
                      start.mutate();
                    }}
                  >
                    {start.isPending
                      ? 'Preparing connection...'
                      : state === 'expired'
                        ? 'Create a new connection link'
                        : link
                          ? 'Restart connection'
                          : 'Link my Telegram account'}
                  </Button>
                  {link && ['waiting', 'linked'].includes(state) ? (
                    <div className="flex flex-col gap-2">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block font-medium underline"
                      >
                        Open Telegram
                      </a>
                      <p role="status" className="text-sm">
                        {state === 'linked'
                          ? 'Tap Confirm connection in the Telegram test message. If no message arrived, press Start again. This page updates automatically.'
                          : 'Press Start in Telegram. We will send you a test message to confirm the connection.'}
                      </p>
                    </div>
                  ) : null}
                  {state === 'expired' ? (
                    <p role="status" className="text-sm">
                      Your connection link expired. Create a new link to continue.
                    </p>
                  ) : null}
                  {['waiting', 'linked'].includes(state) && !link ? (
                    <p className="text-sm">
                      Create a fresh link to resume setup after returning to this page.
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Connection failed. Please try again.'}
        </p>
      ) : null}
    </section>
  );
}
