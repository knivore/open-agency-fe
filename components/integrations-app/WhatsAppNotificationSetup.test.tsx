import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import WhatsAppNotificationSetup from './WhatsAppNotificationSetup';
import {connectorsApi} from '@/lib/api/backend/connectors';

vi.mock('@/lib/api/backend/connectors', () => ({
  connectorsApi: {
    listConnectorInstallations: vi.fn(),
    whatsappSetupStatus: vi.fn(),
    whatsappSetupAction: vi.fn(),
    createConnectorSetupSession: vi.fn(),
  },
}));
const personal = {
  id: 'personal',
  provider: 'whatsapp-personal',
  name: 'Personal',
  status: 'active',
};
const business = {
  id: 'business',
  provider: 'whatsapp-cloud-api',
  name: 'Business',
  status: 'active',
};

function setup(mode?: 'personal' | 'business') {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  });
  render(
    <QueryClientProvider client={client}>
      <WhatsAppNotificationSetup mode={mode}/>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({
    items: [personal],
  } as never);
  vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue({
    mode: 'personal',
    installation_id: 'personal',
    connection_status: 'active',
    account_connected: true,
    linking: {status: 'not_linked'},
  });
});
afterEach(cleanup);
describe('WhatsApp guided setup', () => {
  it('shows a private QR handoff and no numeric account inputs', async () => {
    vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue({
      mode: 'personal',
      installation_id: 'personal',
      connection_status: 'setup_pending',
      account_connected: false,
      bridge_status: 'qr',
      qr_data_url: 'data:image/png;base64,iVBORw0KGgo=',
      linking: {status: 'not_linked'},
    });
    setup();
    expect(await screen.findByAltText('Scan this WhatsApp linking QR code')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(connectorsApi.whatsappSetupAction).not.toHaveBeenCalled();
  });
  it('requires confirmation before enabling personal alerts', async () => {
    setup();
    expect(
      await screen.findByRole('button', {name: 'Send confirmation test to myself'})
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Enable WhatsApp alerts'})
    ).not.toBeInTheDocument();
  });
  it('enables only after the human clicks', async () => {
    const verified = {
      mode: 'personal' as const,
      installation_id: 'personal',
      connection_status: 'active',
      account_connected: true,
      linking: {status: 'verified'},
    };
    vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue(verified);
    vi.mocked(connectorsApi.whatsappSetupAction).mockImplementation(async () => {
      const result = {...verified, linking: {status: 'enabled'}};
      vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue(result);
      return result;
    });
    setup();
    const button = await screen.findByRole('button', {name: 'Enable WhatsApp alerts'});
    expect(connectorsApi.whatsappSetupAction).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(await screen.findByText(/WhatsApp alerts enabled/)).toBeVisible();
    expect(connectorsApi.whatsappSetupAction).toHaveBeenCalledWith('personal', 'enable');
  });
  it('prepares the Business webhook and wa.me handoff', async () => {
    vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({
      items: [business],
    } as never);
    vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue({
      mode: 'business',
      installation_id: 'business',
      connection_status: 'active',
      account_connected: true,
      linking: {status: 'not_linked'},
    });
    vi.mocked(connectorsApi.whatsappSetupAction).mockResolvedValue({
      mode: 'business',
      installation_id: 'business',
      connection_status: 'active',
      account_connected: true,
      linking: {status: 'waiting'},
      link_url: 'https://wa.me/123?text=AGENCYLINK',
      webhook_url: 'https://agency.example/webhook',
      webhook_verify_token: 'temporary-token',
    });
    setup('business');
    fireEvent.click(await screen.findByRole('button', {name: 'Prepare Business WhatsApp link'}));
    expect(
      await screen.findByRole('link', {name: 'Open WhatsApp and send the linking message'})
    ).toHaveAttribute('href', 'https://wa.me/123?text=AGENCYLINK');
    expect(screen.getByRole('button', {name: 'Copy verification token'})).toBeVisible();
    expect(screen.queryByText('temporary-token')).not.toBeInTheDocument();
  });
  it('starts the QR session immediately after creating a personal installation', async () => {
    vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({items: []});
    vi.mocked(connectorsApi.createConnectorSetupSession).mockResolvedValue({
      installation: personal,
    } as never);
    vi.mocked(connectorsApi.whatsappSetupAction).mockResolvedValue({
      mode: 'personal',
      installation_id: 'personal',
      connection_status: 'setup_pending',
      account_connected: false,
      linking: {status: 'not_linked'},
    });
    setup('personal');
    fireEvent.click(await screen.findByRole('button', {name: 'Start personal WhatsApp setup'}));
    await waitFor(() =>
      expect(connectorsApi.whatsappSetupAction).toHaveBeenCalledWith('personal', 'start')
    );
  });
  it('offers a fresh setup when no personal account exists', async () => {
    vi.mocked(connectorsApi.listConnectorInstallations).mockResolvedValue({items: []});
    setup('personal');
    expect(
      await screen.findByRole('button', {name: 'Start personal WhatsApp setup'})
    ).toBeVisible();
  });
  it('offers disconnect instead of restarting an expired pairing session', async () => {
    vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue({
      mode: 'personal',
      installation_id: 'personal',
      connection_status: 'setup_pending',
      account_connected: false,
      setup_expired: true,
      linking: {status: 'not_linked'},
    });
    setup('personal');
    expect(await screen.findByText(/Setup expired. Disconnect this session/)).toBeVisible();
    expect(screen.queryByRole('button', {name: 'Show linking QR code'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Disconnect personal WhatsApp'})).toBeVisible();
  });
  it('can resend a confirmation after a failed delivery without waiting for expiry', async () => {
    vi.mocked(connectorsApi.whatsappSetupStatus).mockResolvedValue({
      mode: 'personal',
      installation_id: 'personal',
      connection_status: 'active',
      account_connected: true,
      linking: {status: 'waiting'},
    });
    setup('personal');
    expect(
      await screen.findByRole('button', {name: 'Resend confirmation test to myself'})
    ).toBeVisible();
  });
  it('shows recovery errors without claiming completion', async () => {
    vi.mocked(connectorsApi.whatsappSetupStatus).mockRejectedValue(
      new Error('WhatsApp bridge unavailable')
    );
    setup();
    expect(await screen.findByText('WhatsApp bridge unavailable')).toBeVisible();
    expect(screen.queryByText(/alerts enabled/)).not.toBeInTheDocument();
  });
});
