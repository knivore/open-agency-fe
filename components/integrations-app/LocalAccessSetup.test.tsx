import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import LocalAccessSetup from './LocalAccessSetup';

const transport = vi.hoisted(() => ({
  chromeConnectRequest: vi.fn(),
  detectCompanion: vi.fn(),
  offerCompanionConnection: vi.fn(),
}));
vi.mock('@/lib/integrations/localConnect', () => ({...transport, minimumChromeVersion: '0.3.2'}));
const api = vi.hoisted(() => ({get: vi.fn(), post: vi.fn()}));
vi.mock('@/lib/api/clientInstances', () => ({appApiClient: api}));
vi.mock('next/link', () => ({
  default: ({children, href}: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function setup() {
  render(
    <QueryClientProvider
      client={new QueryClient({defaultOptions: {queries: {retry: false}}})}
    >
      <LocalAccessSetup/>
    </QueryClientProvider>
  );
}

afterEach(() => vi.restoreAllMocks());
describe('LocalAccessSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      chrome: {status: 'not_paired'},
      apps: {status: 'not_paired'},
    });
    api.post.mockResolvedValue({
      pairing_code: 'synthetic-one-time-code',
      expires_in_seconds: 300,
    });
    transport.chromeConnectRequest.mockImplementation(async (action: string) =>
      action === 'detect'
        ? {status: 'available', version: '0.3.2'}
        : {status: 'awaiting_site_approval'}
    );
    transport.detectCompanion.mockResolvedValue('synthetic-challenge');
    transport.offerCompanionConnection.mockResolvedValue({status: 'awaiting_window_approval'});
  });
  it('prepares a pairing handoff without claiming connection, then cancels the unused code', async () => {
    api.get.mockResolvedValue({
      chrome: {status: 'not_paired'},
      apps: {status: 'not_paired'},
    });
    api.post.mockImplementation((_path: string, payload: { action: string }) =>
      Promise.resolve(
        payload.action === 'pair'
          ? {pairing_code: 'synthetic-one-time-code', expires_in_seconds: 300}
          : {status: 'stopped'}
      )
    );
    render(
      <QueryClientProvider
        client={new QueryClient({defaultOptions: {queries: {retry: false}}})}
      >
        <LocalAccessSetup/>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getAllByText('Manual setup fallback')[0]);
    const buttons = await screen.findAllByRole('button', {name: 'Create pairing code'});
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    fireEvent.click(buttons[0]);
    const input = await screen.findByLabelText('One-time code · expires in five minutes');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('synthetic-one-time-code');
    expect(api.post).toHaveBeenCalledWith('/api/local-access', {
      target: 'chrome',
      action: 'pair',
    });
    expect(
      screen.getByText(
        'Creating a code does not connect an app. Access starts after you pair and choose sites or windows.'
      )
    ).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', {name: 'Stop connection'})[0]);
    await waitFor(() =>
      expect(
        screen.queryByLabelText('One-time code · expires in five minutes')
      ).not.toBeInTheDocument()
    );
    expect(api.post).toHaveBeenCalledWith('/api/local-access', {
      target: 'chrome',
      action: 'stop',
    });
  });
});

describe('automatic connection handoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      chrome: {status: 'not_paired'},
      apps: {status: 'not_paired'},
    });
    api.post.mockResolvedValue({
      pairing_code: 'synthetic-one-time-code',
      expires_in_seconds: 300,
    });
    transport.chromeConnectRequest.mockImplementation(async (action: string) =>
      action === 'detect'
        ? {status: 'available', version: '0.3.2'}
        : {status: 'awaiting_site_approval'}
    );
    transport.detectCompanion.mockResolvedValue('synthetic-challenge');
    transport.offerCompanionConnection.mockResolvedValue({status: 'awaiting_window_approval'});
  });
  it('hands Chrome a code without displaying it and waits for real server connection status', async () => {
    setup();
    const button = await screen.findByRole('button', {name: 'Connect Chrome'});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText(/Choose allowed sites in the Chrome approval tab/);
    expect(transport.chromeConnectRequest).toHaveBeenNthCalledWith(1, 'detect');
    expect(transport.chromeConnectRequest).toHaveBeenNthCalledWith(
      3,
      'connect',
      'synthetic-one-time-code'
    );
    expect(screen.queryByDisplayValue('synthetic-one-time-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /^Connected$/})).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: 'Stop connection'})[0]);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/local-access', {
        target: 'chrome',
        action: 'stop',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByText(/Choose allowed sites in the Chrome approval tab/)
      ).not.toBeInTheDocument()
    );
  });
  it('does not offer Connect or create a code if the extension is missing', async () => {
    transport.chromeConnectRequest.mockRejectedValue(new Error('Extension unavailable'));
    setup();
    await screen.findByRole('link', {name: 'Download Chrome extension 0.3.2'});
    expect(screen.getByRole('button', {name: 'Connect Chrome'})).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('detects Mac setup instructions and allows an explicit Windows download without pairing', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    setup();
    const selector = await screen.findByRole('combobox', {name: 'Companion platform'});
    await waitFor(() => expect(selector).toHaveValue('macos'));
    expect(screen.getByLabelText('Terminal install command')).toBeVisible();
    expect(transport.detectCompanion).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(selector, {target: {value: 'windows'}});
    expect(screen.getByLabelText('PowerShell install command')).toBeVisible();
    expect(screen.queryByLabelText('Terminal install command')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('offers Windows pairing only after detecting a companion and still requires local window approval', async () => {
    setup();
    const button = await screen.findByRole('button', {name: 'Connect apps'});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText(/Choose allowed windows in the companion/);
    expect(transport.offerCompanionConnection).toHaveBeenCalledWith(
      'synthetic-one-time-code',
      'synthetic-challenge'
    );
    expect(screen.queryByDisplayValue('synthetic-one-time-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /^Connected$/})).not.toBeInTheDocument();
  });
});

describe('guided setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      chrome: {status: 'not_paired'},
      apps: {status: 'not_paired'},
    });
    transport.chromeConnectRequest.mockRejectedValue(new Error('Extension unavailable'));
  });
  it('shows first-install recovery without pairing or probing Windows automatically', async () => {
    setup();
    expect(
      await screen.findByRole('link', {name: 'Download Chrome extension 0.3.2'})
    ).toHaveAttribute('download');
    expect(screen.getByRole('link', {name: 'Download developer installer'})).toHaveAttribute(
      'href',
      '/api/local-access/download/windows-installer'
    );
    expect(api.post).not.toHaveBeenCalled();
    expect(transport.detectCompanion).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', {name: 'View a Chrome tab'})).not.toBeInTheDocument();
  });
  it('does not mistake backend failure for a missing installation and provides a retry', async () => {
    transport.chromeConnectRequest.mockResolvedValue({status: 'available', version: '0.3.2'});
    api.get.mockRejectedValueOnce(new Error('network unavailable'));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection status is unavailable');
    expect(screen.getByRole('button', {name: 'Connect Chrome'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Retry status check'}));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Connect Chrome'})).toBeEnabled()
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});

it('rechecks Chrome after installation without granting access or creating a pairing code', async () => {
  vi.clearAllMocks();
  transport.chromeConnectRequest.mockRejectedValue(new Error('Extension unavailable'));
  api.get.mockResolvedValue({
    chrome: {status: 'not_paired'},
    apps: {status: 'not_paired'},
  });
  setup();
  await screen.findByRole('button', {name: 'Check Chrome again'});
  transport.chromeConnectRequest.mockResolvedValue({status: 'available', version: '0.3.2'});
  fireEvent.click(screen.getByRole('button', {name: 'Check Chrome again'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Connect Chrome'})).toBeEnabled());
  expect(screen.getByText(/Chrome extension 0.3.2 is ready/)).toBeVisible();
  expect(api.post).not.toHaveBeenCalled();
});
