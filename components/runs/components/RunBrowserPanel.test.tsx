import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import RunBrowserPanel from './RunBrowserPanel';

const api = vi.hoisted(() => ({get: vi.fn(), delete: vi.fn()}));
vi.mock('@/lib/api/clientInstances', () => ({agencyApiClient: api}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.get.mockReset();
  api.delete.mockReset();
});

describe('RunBrowserPanel private snapshots', () => {
  it('revokes old image URLs on refresh, session switch, and unmount', async () => {
    const create = vi.fn().mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:refresh').mockReturnValueOnce('blob:second');
    const revoke = vi.fn();
    const TestURL = class extends URL {
    };
    Object.assign(TestURL, {createObjectURL: create, revokeObjectURL: revoke});
    vi.stubGlobal('URL', TestURL);
    api.get.mockImplementation(async (url: string) => url.endsWith('/screenshot')
      ? {blob: async () => new Blob(['private capture'])}
      : {
        sessions: [{session_id: 'first', current_url: 'https://first.test', status: 'open'},
          {session_id: 'second', current_url: 'https://second.test', status: 'open'}]
      });
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    const {unmount} = render(<QueryClientProvider client={client}><RunBrowserPanel runId="fixture"/></QueryClientProvider>);
    const buttons = await screen.findAllByRole('button', {name: 'View page'});
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:first'));
    fireEvent.click(screen.getByRole('button', {name: 'Refresh page image'}));
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:refresh'));
    expect(revoke).toHaveBeenCalledWith('blob:first');
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:second'));
    expect(revoke).toHaveBeenCalledWith('blob:refresh');
    unmount();
    expect(create).toHaveBeenCalledTimes(3);
    expect(revoke).toHaveBeenCalledWith('blob:second');
    client.clear();
  });
});
