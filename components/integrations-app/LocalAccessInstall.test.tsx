import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import LocalAccessInstall from './LocalAccessInstall';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});
describe('Windows installer command handoff', () => {
  it('copies the visible local command only after the user clicks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
    render(
      <LocalAccessInstall target="apps" busy={false} onLaunch={vi.fn()} onCheckChrome={vi.fn()}/>
    );
    expect(writeText).not.toHaveBeenCalled();
    const command = (screen.getByLabelText('PowerShell install command') as HTMLTextAreaElement)
      .value;
    expect(command).toContain('Sort-Object LastWriteTime -Descending');
    expect(command).toContain('& $agencyInstaller.FullName');
    fireEvent.click(screen.getByRole('button', {name: 'Copy PowerShell command'}));
    expect(await screen.findByRole('button', {name: 'Command copied'})).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(command);
    expect(screen.getByRole('status')).toHaveTextContent('Copying does not install anything');
  });
  it('keeps the command selectable when clipboard permission is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText: vi.fn().mockRejectedValue(new Error('denied'))},
    });
    render(
      <LocalAccessInstall target="apps" busy={false} onLaunch={vi.fn()} onCheckChrome={vi.fn()}/>
    );
    fireEvent.click(screen.getByRole('button', {name: 'Copy PowerShell command'}));
    expect(await screen.findByText(/Select the command above and press Ctrl\+C/)).toBeVisible();
    expect(screen.getByLabelText('PowerShell install command')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', {name: 'Command copied'})).not.toBeInTheDocument();
  });
});

describe('macOS installer handoff', () => {
  it('offers the Mac artifact and copies its visible command only on request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
    const onLaunch = vi.fn();
    render(
      <LocalAccessInstall
        target="apps"
        platform="macos"
        busy={false}
        onLaunch={onLaunch}
        onCheckChrome={vi.fn()}
      />
    );
    expect(screen.getByRole('link', {name: 'Download developer installer'})).toHaveAttribute(
      'href',
      '/api/local-access/download/macos-installer'
    );
    const command = (screen.getByLabelText('Terminal install command') as HTMLTextAreaElement)
      .value;
    expect(command).toContain('Install-AgencyConnect(?: \\(\\d+\\))?\\.command');
    expect(command).toContain("subprocess.run(['/bin/bash', str(installer)], check=True)");
    expect(command).not.toMatch(/curl|sudo|xattr|spctl/);
    expect(writeText).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('link', {name: 'Open companion & connect'})
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Check companion & connect'}));
    expect(onLaunch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', {name: 'Copy Terminal command'}));
    expect(await screen.findByRole('button', {name: 'Command copied'})).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(command);
  });

  it('uses only a configured HTTPS Mac release and hides developer commands', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_AGENCY_MACOS_COMPANION_INSTALLER_URL',
      'https://downloads.example.com/Agency.pkg'
    );
    render(
      <LocalAccessInstall
        target="apps"
        platform="macos"
        busy={false}
        onLaunch={vi.fn()}
        onCheckChrome={vi.fn()}
      />
    );
    expect(screen.getByRole('link', {name: 'Download macOS installer'})).toHaveAttribute(
      'href',
      'https://downloads.example.com/Agency.pkg'
    );
    expect(screen.queryByLabelText('Terminal install command')).not.toBeInTheDocument();
  });
});
