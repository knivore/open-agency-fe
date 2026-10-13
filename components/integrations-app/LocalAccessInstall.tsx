'use client';
import {useState} from 'react';
import {Check, Copy} from 'lucide-react';
import {Textarea} from '../library/shadcn/textarea';
import {Button} from '../library/shadcn/button';
import {minimumChromeVersion} from '@/lib/integrations/localConnect';
import type {DesktopPlatform, LocalTarget} from '@/lib/integrations/useLocalAccess';

function secureDownloadUrl(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export default function LocalAccessInstall({
                                             target,
                                             platform = 'windows',
                                             busy,
                                             onLaunch,
                                             onCheckChrome,
                                           }: {
  target: LocalTarget;
  platform?: DesktopPlatform;
  busy: boolean;
  onLaunch: () => void;
  onCheckChrome: () => void;
}) {
  const store = secureDownloadUrl(process.env.NEXT_PUBLIC_AGENCY_CHROME_STORE_URL);
  const storeUrl = store?.startsWith('https://chromewebstore.google.com/detail/') ? store : null;
  const macos = platform === 'macos';
  const platformName = macos ? 'macOS' : 'Windows';
  const installerUrl = secureDownloadUrl(
    macos
      ? process.env.NEXT_PUBLIC_AGENCY_MACOS_COMPANION_INSTALLER_URL
      : process.env.NEXT_PUBLIC_AGENCY_COMPANION_INSTALLER_URL
  );
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <h3 className="font-medium">
        {target === 'chrome'
          ? 'Install or update the Chrome extension'
          : `Open or install the ${platformName} companion`}
      </h3>
      {target === 'chrome' ? (
        <>
          <p className="text-sm text-muted-foreground">
            Use Chrome with the profile where you want Agency to work. After installation, refresh
            this page once.
          </p>
          {storeUrl ? (
            <Button asChild variant="outline">
              <a href={storeUrl} target="_blank" rel="noreferrer">
                Install Chrome extension
              </a>
            </Button>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                The Chrome Web Store release is not available yet. This installation currently uses
                a developer extension.
              </p>
              <Button asChild variant="outline">
                <a
                  href="/api/local-access/download/chrome"
                  download={`agency-chrome-${minimumChromeVersion}.zip`}
                >
                  Download Chrome extension {minimumChromeVersion}
                </a>
              </Button>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  Install or replace an older developer extension
                </summary>
                <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
                  <li>Extract the download to a permanent folder.</li>
                  <li>
                    Enter <code>chrome://extensions</code> in Chrome’s address bar and enable
                    Developer mode.
                  </li>
                  <li>
                    If an older Agency copy is installed, disable it. Choose Load unpacked and
                    select the extracted <code>extensions/agency-chrome</code> folder.
                  </li>
                  <li>
                    Confirm version {minimumChromeVersion} or newer, then refresh this Agency page.
                    Reloading an older extracted folder does not update its files.
                  </li>
                </ol>
              </details>
            </>
          )}
          <Button variant="outline" disabled={busy} onClick={onCheckChrome}>
            Check Chrome again
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Already installed? Open the companion. Agency will wait for it and prepare your
            connection automatically.
          </p>
          {macos ? (
            <>
              <p className="text-sm text-muted-foreground">
                Open Open Agency Companion from your Applications folder, then check the connection.
                Allow Accessibility in System Settings → Privacy & Security → Accessibility when
                requested.
              </p>
              <Button variant="outline" disabled={busy} onClick={onLaunch}>
                Check companion & connect
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" aria-disabled={busy}>
              <a
                href="agency-connect://open"
                onClick={(event) => {
                  if (busy) event.preventDefault();
                  else onLaunch();
                }}
              >
                Open companion & connect
              </a>
            </Button>
          )}
          {installerUrl ? (
            <Button asChild variant="outline">
              <a href={installerUrl} target="_blank" rel="noreferrer">
                Download {platformName} installer
              </a>
            </Button>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A packaged {platformName} release is not available yet. The developer installer
                below requires {macos ? 'Python 3.10+ with Tk' : 'Python 3'}.
              </p>
              <Button asChild variant="outline">
                <a
                  href={`/api/local-access/download/${macos ? 'macos' : 'windows'}-installer`}
                  download={macos ? 'Install-AgencyConnect.command' : 'Install-AgencyConnect.ps1'}
                >
                  Download developer installer
                </a>
              </Button>
              <InstallCommand key={platform} platform={platform}/>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            Allow Chrome’s local-network prompt if shown. Choose the windows Agency may access in
            the companion.
          </p>
        </>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          Download blocked by your organization?
        </summary>
        <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
          <p>
            Ask the device administrator to approve Open Agency through your organization’s software
            catalog. Agency cannot override browser or device download policies.
          </p>
          <p>
            {target === 'chrome'
              ? 'Request an approved Chrome extension deployment or an allowed official Chrome Web Store listing.'
              : `Request a signed ${platformName} companion package through your approved app deployment system.`}
          </p>
          <p>
            Developer downloads are not a substitute for organization approval. After an approved
            installation, return here to connect and choose allowed sites or windows.
          </p>
        </div>
      </details>
    </div>
  );
}

// Chrome numbers repeat downloads. Select the newest exact installer-name pattern
// so an old unnumbered download cannot silently reinstall a previous build.
// Run only a file the user already downloaded. Do not fetch remote code,
// remove its origin mark, or change execution policies to make installation run.
const windowsInstallCommand = String.raw`$agencyInstaller = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'Downloads') -File | Where-Object { $_.Name -match '^Install-AgencyConnect( \(\d+\))?\.ps1$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $agencyInstaller) { throw 'Installer not found. Download it first, or use its saved path.' }
Write-Host "Running $($agencyInstaller.FullName)"
& $agencyInstaller.FullName`;

const macosInstallCommand = String.raw`python3 - <<'PY'
from pathlib import Path
import re, subprocess
files = [p for p in (Path.home() / 'Downloads').iterdir() if p.is_file() and re.fullmatch(r'Install-AgencyConnect(?: \(\d+\))?\.command', p.name)]
if not files: raise SystemExit('Installer not found. Download it first, or use its saved path.')
installer = max(files, key=lambda p: p.stat().st_mtime)
print(f'Running {installer}', flush=True)
subprocess.run(['/bin/bash', str(installer)], check=True)
PY`;

function InstallCommand({platform}: { platform: DesktopPlatform }) {
  const macos = platform === 'macos';
  const command = macos ? macosInstallCommand : windowsInstallCommand;
  const shellName = macos ? 'Terminal' : 'PowerShell';
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Download the installer above.{' '}
          {macos ? (
            'Python 3.10+ with Tk from python.org must be installed.'
          ) : (
            <>
              Python 3 with the <code>py</code> launcher must be installed.
            </>
          )}
        </li>
        <li>
          Close any existing Agency companion window. Open {shellName} under your normal account,
          paste this command, then press Enter.
        </li>
      </ol>
      <label className="text-sm font-medium" htmlFor="native-install-command">
        {shellName} install command
      </label>
      <Textarea
        id="native-install-command"
        readOnly
        value={command}
        rows={macos ? 10 : 7}
        spellCheck={false}
        className="font-mono"
      />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopyStatus('copied');
          } catch {
            setCopyStatus('failed');
          }
        }}
      >
        {copyStatus === 'copied' ? (
          <Check className="mr-2 size-4" aria-hidden="true"/>
        ) : (
          <Copy className="mr-2 size-4" aria-hidden="true"/>
        )}
        {copyStatus === 'copied' ? 'Command copied' : `Copy ${shellName} command`}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {copyStatus === 'failed'
          ? `Clipboard access was unavailable. Select the command above and press ${macos ? '⌘C' : 'Ctrl+C'}.`
          : copyStatus === 'copied'
            ? `Paste into ${shellName} to run it. Copying does not install anything.`
            : 'Uses the newest Agency installer in Downloads, including Chrome’s numbered duplicates. If saved elsewhere, use its saved path.'}
      </p>
      <p className="text-sm text-muted-foreground">
        The installer prepares dependencies and opens the companion. Return here, click Connect
        apps, then select the windows Agency may use.
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          {macos
            ? 'macOS blocked the installer or app?'
            : 'PowerShell says scripts are blocked or not signed?'}
        </summary>
        <p className="mt-2 text-muted-foreground">
          {macos
            ? 'Use an administrator-approved signed and notarized package if macOS blocks this developer installer or app. This command does not remove quarantine or change Gatekeeper or Accessibility settings.'
            : 'This command respects Windows execution policies. Use an administrator-approved signed package if your device blocks this developer script.'}
        </p>
      </details>
    </div>
  );
}
