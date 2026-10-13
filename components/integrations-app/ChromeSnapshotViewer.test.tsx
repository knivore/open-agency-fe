import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ChromeSnapshotViewer from './ChromeSnapshotViewer';

const api = vi.hoisted(() => ({post: vi.fn()}));
vi.mock('@/lib/api/clientInstances', () => ({appApiClient: api}));
beforeEach(() => api.post.mockReset());

async function chooseTab() {
  fireEvent.click(screen.getByRole('button', {name: 'List allowed tabs'}));
  const select = await screen.findByLabelText('Tab to view');
  fireEvent.change(select, {target: {value: '7'}});
}

describe('ChromeSnapshotViewer', () => {
  it('discards a late capture response across a stopped connection', async () => {
    let finish: (value: unknown) => void = () => {
    };
    api.post
      .mockResolvedValueOnce({status: 'ok', tabs: [{tab_id: 7, url: 'https://example.test'}]})
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    const {rerender} = render(<ChromeSnapshotViewer connected/>);
    await chooseTab();
    fireEvent.click(screen.getByRole('button', {name: 'Request screenshot'}));
    rerender(<ChromeSnapshotViewer connected={false}/>);
    await act(async () => {
      finish({status: 'ok', snapshot_path: '/api/local-access/chrome-snapshots/fixture'});
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'List allowed tabs'})).toBeDisabled();
  });

  it('lists tabs only on request, then displays a reviewed private capture', async () => {
    api.post
      .mockResolvedValueOnce({
        status: 'ok',
        tabs: [{tab_id: 7, title: 'Fixture', url: 'https://example.test'}],
      })
      .mockResolvedValueOnce({
        status: 'ok',
        title: 'Fixture',
        snapshot_path: '/api/local-access/chrome-snapshots/fixture',
        expires_in_seconds: 120,
      });
    const {rerender} = render(<ChromeSnapshotViewer connected/>);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Request screenshot'})).toBeDisabled();
    await chooseTab();
    fireEvent.click(screen.getByRole('button', {name: 'Request screenshot'}));
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      '/api/local-access/chrome-snapshots/fixture'
    );
    expect(api.post).toHaveBeenLastCalledWith(
      '/api/local-access/chrome-view',
      {
        action: 'screenshot',
        tab_id: 7,
      },
      {timeoutMs: 70000}
    );
    rerender(<ChromeSnapshotViewer connected={false}/>);
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(screen.getByRole('button', {name: 'List allowed tabs'})).toBeDisabled();
  });
  it('never renders an external image URL from a tool result', async () => {
    api.post
      .mockResolvedValueOnce({status: 'ok', tabs: [{tab_id: 7, url: 'https://example.test'}]})
      .mockResolvedValueOnce({status: 'ok', snapshot_path: 'https://other.example/image.jpg'});
    render(<ChromeSnapshotViewer connected/>);
    await chooseTab();
    fireEvent.click(screen.getByRole('button', {name: 'Request screenshot'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('No private browser snapshot');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('does not replay a failed capture and clears an expired image', async () => {
    api.post
      .mockResolvedValueOnce({status: 'ok', tabs: [{tab_id: 7, url: 'https://example.test'}]})
      .mockResolvedValueOnce({status: 'timeout', message: 'Inspect Chrome before retrying'})
      .mockResolvedValueOnce({
        status: 'ok',
        snapshot_path: '/api/local-access/chrome-snapshots/fixture',
      });
    render(<ChromeSnapshotViewer connected/>);
    await chooseTab();
    fireEvent.click(screen.getByRole('button', {name: 'Request screenshot'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Inspect Chrome before retrying');
    expect(api.post).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', {name: 'Request screenshot'}));
    fireEvent.error(await screen.findByRole('img'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Snapshot expired');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(3);
  });
});
