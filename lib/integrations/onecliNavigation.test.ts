import { describe, expect, it } from 'vitest';
import {
  buildOneCLIConnectionsUrl,
  buildOneCLIConnectorSetupUrl,
  getOneCLIAppUrl,
  isTrustedOneCLIEmbedUrl,
  normalizeOneCLIUrl,
} from './onecliNavigation';

const browserLocation = { hostname: 'agency.example.test', protocol: 'https:' };

describe('OneCLI navigation', () => {
  it('rewrites internal and loopback hosts for the browser while preserving the port', () => {
    expect(
      normalizeOneCLIUrl('http://onecli:10254/connections?provider=github', browserLocation)
    ).toBe('http://agency.example.test:10254/connections?provider=github');
    expect(getOneCLIAppUrl('http://127.0.0.1:10254', browserLocation)).toBe(
      'http://agency.example.test:10254/'
    );
  });

  it('builds the direct OneCLI connections quick link', () => {
    expect(buildOneCLIConnectionsUrl('https://onecli.example.test/base?stale=true')).toBe(
      'https://onecli.example.test/connections'
    );
  });

  it('embeds only the exact configured OneCLI origin on a safe protocol', () => {
    expect(
      isTrustedOneCLIEmbedUrl(
        'https://onecli.example.test/connections',
        'https://onecli.example.test',
        'https://agency.test'
      )
    ).toBe(true);
    expect(
      isTrustedOneCLIEmbedUrl(
        'https://attacker.example/connections',
        'https://onecli.example.test',
        'https://agency.test'
      )
    ).toBe(false);
    expect(
      isTrustedOneCLIEmbedUrl(
        'https://agency.test/onecli/connections',
        'https://agency.test',
        'https://agency.test'
      )
    ).toBe(false);
    expect(
      isTrustedOneCLIEmbedUrl(
        'http://onecli.example.test/connections',
        'http://onecli.example.test',
        'https://agency.test'
      )
    ).toBe(false);
  });

  it('uses a native OneCLI app flow when the exact OneCLI release supports it', () => {
    const result = new URL(
      buildOneCLIConnectorSetupUrl({
        nativeAppId: 'github',
        setupUrl:
          'https://onecli.example.test/?agency_installation_id=install-1&device_code=DEVICE',
      })
    );

    expect(result.pathname).toBe('/connections');
    expect(result.searchParams.get('connect')).toBe('github');
    expect(result.searchParams.has('agency_installation_id')).toBe(false);
  });

  it('prefills supported OneCLI Generic Secret fields without placing a secret in the URL', () => {
    const result = new URL(
      buildOneCLIConnectorSetupUrl({
        setupUrl: 'https://onecli.example.test/?device_code=DEVICE',
        genericSecret: {
          host: 'discord.com',
          path: '/api/v10/*',
          name: 'discord-bot',
          header: 'Authorization',
          format: 'Bot {value}',
        },
      })
    );

    expect(result.pathname).toBe('/connections/custom');
    expect(result.searchParams.get('create')).toBe('generic');
    expect(result.searchParams.get('host')).toBe('discord.com');
    expect(result.searchParams.get('format')).toBe('Bot {value}');
    expect(result.searchParams.has('device_code')).toBe(false);
    expect(result.toString()).not.toContain('secret_value');
  });

  it('opens OneCLI generic-secret creation for connectors without a safe prefill profile', () => {
    const result = new URL(
      buildOneCLIConnectorSetupUrl({
        setupUrl: 'https://onecli.example.test/?device_code=DEVICE',
      })
    );

    expect(result.pathname).toBe('/connections/custom');
    expect(result.searchParams.get('action')).toBe('new');
    expect(result.searchParams.has('device_code')).toBe(false);
  });
});
