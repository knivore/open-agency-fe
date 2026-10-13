import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import TelegramNotificationSetup from './TelegramNotificationSetup';
import {connectorsApi} from '@/lib/api/backend/connectors';

vi.mock('@/lib/api/backend/connectors', () => ({
  connectorsApi: {
    listConnectorInstallations: vi.fn(),
    telegramLinkStatus: vi.fn(),
    startTelegramLink: vi.fn(),
    enableTelegramNotifications: vi.fn(),
  },
}));
const bot = {id: 'bot', provider: 'telegram-bot', status: 'active', name: 'My bot'};

function setup() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  });
  render(
    <QueryClientProvider client={client}>
      <TelegramNotificationSetup/>
    </QueryClientProvider>
  );
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({items: [bot]} as never);
  vi.mocked(connectorsApi.telegramLinkStatus).mockResolvedValue({status: 'not_linked'});
});
afterEach(cleanup);
describe('Telegram notification setup', () => {
  it('opens an expiring Telegram link without asking for numeric IDs', async () => {
    vi.mocked(connectorsApi.startTelegramLink).mockResolvedValue({
      status: 'waiting',
      link_url: 'https://t.me/my_bot?start=agency_test',
    });
    setup();
    const button = await screen.findByRole('button', {name: 'Link my Telegram account'});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const link = await screen.findByRole('link', {name: 'Open Telegram'});
    expect(link).toHaveAttribute('href', 'https://t.me/my_bot?start=agency_test');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(connectorsApi.enableTelegramNotifications).not.toHaveBeenCalled();
  });
  it('waits for owner confirmation before enabling the verified destination', async () => {
    vi.mocked(connectorsApi.telegramLinkStatus).mockResolvedValue({
      status: 'verified',
      display_name: 'alice',
    });
    vi.mocked(connectorsApi.enableTelegramNotifications).mockResolvedValue({
      status: 'enabled',
      display_name: 'alice',
    });
    setup();
    const enable = await screen.findByRole('button', {name: 'Enable approvals and alerts'});
    expect(connectorsApi.enableTelegramNotifications).not.toHaveBeenCalled();
    fireEvent.click(enable);
    expect(await screen.findByText(/Notifications enabled for alice/)).toBeVisible();
    expect(connectorsApi.enableTelegramNotifications).toHaveBeenCalledWith('bot');
  });
  it('shows a useful recovery action for expired links', async () => {
    vi.mocked(connectorsApi.telegramLinkStatus).mockResolvedValue({status: 'expired'});
    setup();
    expect(
      await screen.findByRole('button', {name: 'Create a new connection link'})
    ).toBeVisible();
  });
  it('shows public connection errors without claiming success', async () => {
    vi.mocked(connectorsApi.startTelegramLink).mockRejectedValue(
      new Error('Start the public connection and retry.')
    );
    setup();
    const button = await screen.findByRole('button', {name: 'Link my Telegram account'});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Start the public connection');
    expect(screen.queryByRole('link', {name: 'Open Telegram'})).not.toBeInTheDocument();
  });
  it('directs a user without a connected bot to Integrations', async () => {
    vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({items: []});
    setup();
    await waitFor(() =>
      expect(screen.getByRole('link', {name: 'Open Integrations'})).toHaveAttribute(
        'href',
        '/integrations'
      )
    );
    expect(connectorsApi.telegramLinkStatus).not.toHaveBeenCalled();
  });
});
