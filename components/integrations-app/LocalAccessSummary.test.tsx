import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import LocalAccessSummary from './LocalAccessSummary';

const api = vi.hoisted(() => ({get: vi.fn()}));
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
      <LocalAccessSummary/>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
describe('Integrations device summary', () => {
  it('shows owner-authorized connection status and one setup entry', async () => {
    api.get.mockResolvedValue({chrome: {status: 'connected'}, apps: {status: 'offline'}});
    setup();
    expect(await screen.findByText('Chrome · Connected')).toBeVisible();
    expect(screen.getByText('Local apps · Offline')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Set up browser & apps'})).toHaveAttribute(
      'href',
      '/integrations/local-access'
    );
  });
  it('reports unavailable status without claiming devices are disconnected', async () => {
    api.get.mockRejectedValue(new Error('unavailable'));
    setup();
    expect(await screen.findByText('Chrome · Status unavailable')).toBeVisible();
    expect(screen.queryByText('Chrome · Not connected')).not.toBeInTheDocument();
  });
});
