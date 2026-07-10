import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IntegrationCategory } from '@/types/integrations';
import {
  connectorsApi,
  connectorHistoryPayload,
  integrationsApi,
  renderWorkspace,
  setupIntegrationsWorkspaceTest,
} from './IntegrationsWorkspace.test-utils';

describe('IntegrationsWorkspace operations queue', () => {
  setupIntegrationsWorkspaceTest();

  it('shows a top-level connector operations snapshot from aggregate history', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-bad',
          credentialId: 'credential-discord',
          credentialName: 'Discord Bot',
          provider: 'discord-bot',
          status: 'failed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: 'Invalid token',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-06T00:00:00Z',
          completedAt: '2026-05-06T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-telegram',
          name: 'Telegram',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Telegram Bot', source: 'telegram-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'telegram-bot',
            authModel: 'bot token',
            summary: 'Telegram connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-telegram'],
            matchedCredentialNames: ['Telegram Bot'],
          },
        },
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText(/Connector operations/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('operations-credential-backed-count')).toHaveTextContent('2');
      expect(screen.getByTestId('operations-healthy-count')).toHaveTextContent('1');
      expect(screen.getByTestId('operations-failing-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('operations-row-credential-discord')).toHaveTextContent('Discord');
    expect(screen.getByTestId('operations-row-credential-discord')).toHaveTextContent(
      'Invalid token'
    );
    expect(screen.getByTestId('operations-row-meta-credential-discord')).toHaveTextContent(
      'Communications'
    );
    expect(screen.getByTestId('operations-row-meta-credential-discord')).toHaveTextContent(
      'Key: discord-bot'
    );

    fireEvent.click(
      within(screen.getByTestId('operations-row-credential-discord')).getByRole('button', {
        name: /Open/i,
      })
    );
    expect(window.location.search).toContain('integration-tab=communications');
    expect(window.location.search).toContain('integration-connector=communications-discord');
  });

  it('adds backend TLS remediation guidance for self-signed certificate connector failures', async () => {
    const tlsError =
      '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain (_ssl.c:1010)';

    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-tls',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'failed',
          startedAt: '2026-07-08T07:17:00Z',
          completedAt: '2026-07-08T07:17:01Z',
          error: tlsError,
          eventTypes: ['tool.call.failed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-telegram',
          name: 'Telegram',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Telegram Bot', source: 'telegram-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'telegram-bot',
            authModel: 'bot token',
            summary: 'Telegram connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-telegram'],
            matchedCredentialNames: ['Telegram Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      const row = screen.getByTestId('operations-row-credential-telegram');
      expect(row).toHaveTextContent(tlsError);
      expect(row).toHaveTextContent(/Backend TLS verification rejected a self-signed certificate/i);
      expect(row).toHaveTextContent(/SSL_CERT_FILE\/REQUESTS_CA_BUNDLE/i);
    });
  });

  it('hydrates the operations status from per-credential history when aggregate history is empty', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    connectorsApi.getConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-persisted',
          credentialId: 'credential-discord',
          credentialName: 'Discord Bot',
          provider: 'discord-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:01:00Z',
          completedAt: '2026-05-07T00:01:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId('operations-healthy-count')).toHaveTextContent('1');
      expect(screen.getByTestId('operations-never-tested-count')).toHaveTextContent('0');
    });

    expect(connectorsApi.getConnectorHistory).toHaveBeenCalledWith('credential-discord', {
      limit: 1,
    });
    expect(
      within(screen.getByTestId('operations-row-credential-discord')).getByText('healthy')
    ).toBeInTheDocument();
  });

  it('filters the top-level operations queue to never-tested connectors', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-bad',
          credentialId: 'credential-discord',
          credentialName: 'Discord Bot',
          provider: 'discord-bot',
          status: 'failed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: 'Invalid token',
          eventTypes: ['tool.call.failed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'WhatsApp Bot', source: 'whatsapp-cloud-api' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'whatsapp-cloud-api',
            authModel: 'access token',
            summary: 'WhatsApp connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-whatsapp'],
            matchedCredentialNames: ['WhatsApp Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId('operations-filter-never-tested')).toHaveTextContent(
        'Never tested (1)'
      );
    });

    fireEvent.click(screen.getByTestId('operations-filter-never-tested'));

    expect(screen.getByTestId('operations-row-credential-whatsapp')).toHaveTextContent(
      'WhatsApp Cloud API'
    );
    expect(screen.getByTestId('operations-row-credential-whatsapp')).toHaveTextContent(
      /No connector test runs recorded yet/i
    );
    expect(screen.queryByTestId('operations-row-credential-discord')).not.toBeInTheDocument();
  });

  it('persists the top-level operations filter in the URL', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-bad',
          credentialId: 'credential-discord',
          credentialName: 'Discord Bot',
          provider: 'discord-bot',
          status: 'failed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: 'Invalid token',
          eventTypes: ['tool.call.failed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'WhatsApp Bot', source: 'whatsapp-cloud-api' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'whatsapp-cloud-api',
            authModel: 'access token',
            summary: 'WhatsApp connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-whatsapp'],
            matchedCredentialNames: ['WhatsApp Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?operations-filter=failing');
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId('operations-filter-failing')).toHaveClass('agency-gradient');
    });

    fireEvent.click(screen.getByTestId('operations-filter-never-tested'));
    expect(window.location.search).toContain('operations-filter=never-tested');

    fireEvent.click(screen.getByTestId('operations-filter-all'));
    expect(window.location.search).not.toContain('operations-filter=');
  });

  it('supports the header shortcut for only failing connectors', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-bad',
          credentialId: 'credential-discord',
          credentialName: 'Discord Bot',
          provider: 'discord-bot',
          status: 'failed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: 'Invalid token',
          eventTypes: ['tool.call.failed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'WhatsApp Bot', source: 'whatsapp-cloud-api' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'whatsapp-cloud-api',
            authModel: 'access token',
            summary: 'WhatsApp connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-whatsapp'],
            matchedCredentialNames: ['WhatsApp Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Only failing \(1\)/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Only failing \(1\)/i })).toHaveAttribute(
      'href',
      '/integrations?operations-filter=failing'
    );
  });

  it('renders a dedicated operations-only mode', async () => {
    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace({ mode: 'operations' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Connector operations/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Back to integrations/i })).toHaveAttribute(
      'href',
      '/integrations'
    );
    expect(screen.queryByRole('tab', { name: /Communications/i })).not.toBeInTheDocument();
  });

  it('supports show more and show less in the top-level operations queue', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-1',
          credentialId: 'credential-1',
          credentialName: 'Connector 1',
          provider: 'provider-1',
          status: 'failed',
          startedAt: '2026-05-07T00:06:00Z',
          completedAt: '2026-05-07T00:06:01Z',
          error: 'Failure 1',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-2',
          credentialId: 'credential-2',
          credentialName: 'Connector 2',
          provider: 'provider-2',
          status: 'failed',
          startedAt: '2026-05-07T00:05:00Z',
          completedAt: '2026-05-07T00:05:01Z',
          error: 'Failure 2',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-3',
          credentialId: 'credential-3',
          credentialName: 'Connector 3',
          provider: 'provider-3',
          status: 'failed',
          startedAt: '2026-05-07T00:04:00Z',
          completedAt: '2026-05-07T00:04:01Z',
          error: 'Failure 3',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-4',
          credentialId: 'credential-4',
          credentialName: 'Connector 4',
          provider: 'provider-4',
          status: 'failed',
          startedAt: '2026-05-07T00:03:00Z',
          completedAt: '2026-05-07T00:03:01Z',
          error: 'Failure 4',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-5',
          credentialId: 'credential-5',
          credentialName: 'Connector 5',
          provider: 'provider-5',
          status: 'failed',
          startedAt: '2026-05-07T00:02:00Z',
          completedAt: '2026-05-07T00:02:01Z',
          error: 'Failure 5',
          eventTypes: ['tool.call.failed'],
        },
        {
          executionId: 'connector-test-6',
          credentialId: 'credential-6',
          credentialName: 'Connector 6',
          provider: 'provider-6',
          status: 'failed',
          startedAt: '2026-05-07T00:01:00Z',
          completedAt: '2026-05-07T00:01:01Z',
          error: 'Failure 6',
          eventTypes: ['tool.call.failed'],
        },
      ])
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: Array.from({ length: 6 }, (_, index) => ({
        id: `communications-connector-${index + 1}`,
        name: `Connector ${index + 1}`,
        categoryId: 'communications',
        kind: 'planned' as const,
        status: 'configured' as const,
        description: `Connector ${index + 1}`,
        capabilities: ['api key', 'now'],
        configFields: [],
        credentialStatus: {
          managedByBackend: true,
          writeSupported: true,
          refs: [{ name: `Connector ${index + 1}`, source: `provider-${index + 1}` }],
          message: '1 backend credential mapped to this connector.',
        },
        actions: {
          canSaveConfig: false,
          canEnableDisable: false,
          canTestConnection: false,
        },
        raw: {
          backendKey: `provider-${index + 1}`,
          authModel: 'api key',
          summary: `Connector ${index + 1}`,
          launchPriority: 'now',
          matchedCredentialIds: [`credential-${index + 1}`],
          matchedCredentialNames: [`Connector ${index + 1}`],
        },
      })),
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText(/Connector operations/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId('operations-row-credential-5')).toHaveTextContent('Connector 5');
    expect(screen.queryByTestId('operations-row-credential-6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show more/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show more/i }));

    expect(screen.getByTestId('operations-row-credential-6')).toHaveTextContent('Connector 6');
    expect(screen.getByRole('button', { name: /Show less/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show less/i }));

    expect(screen.queryByTestId('operations-row-credential-6')).not.toBeInTheDocument();
  });

  it('tests all credential-backed connectors from the top-level operations queue', async () => {
    connectorsApi.getAggregateConnectorHistory
      .mockResolvedValueOnce(
        connectorHistoryPayload([
          {
            executionId: 'connector-test-discord',
            credentialId: 'credential-discord',
            credentialName: 'Discord Bot',
            provider: 'discord-bot',
            status: 'failed',
            startedAt: '2026-05-07T00:00:00Z',
            completedAt: '2026-05-07T00:00:01Z',
            error: 'Invalid token',
            eventTypes: ['tool.call.failed'],
          },
        ])
      )
      .mockResolvedValueOnce(
        connectorHistoryPayload([
          {
            executionId: 'connector-test-discord-next',
            credentialId: 'credential-discord',
            credentialName: 'Discord Bot',
            provider: 'discord-bot',
            status: 'completed',
            startedAt: '2026-05-07T00:01:00Z',
            completedAt: '2026-05-07T00:01:01Z',
            error: null,
            eventTypes: ['tool.call.completed'],
          },
          {
            executionId: 'connector-test-telegram-next',
            credentialId: 'credential-telegram',
            credentialName: 'Telegram Bot',
            provider: 'telegram-bot',
            status: 'completed',
            startedAt: '2026-05-07T00:01:10Z',
            completedAt: '2026-05-07T00:01:11Z',
            error: null,
            eventTypes: ['tool.call.completed'],
          },
        ])
      );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
        {
          id: 'communications-telegram',
          name: 'Telegram',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Telegram Bot', source: 'telegram-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'telegram-bot',
            authModel: 'bot token',
            summary: 'Telegram connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-telegram'],
            matchedCredentialNames: ['Telegram Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Test all credential-backed/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Test all credential-backed/i }));

    await waitFor(() => {
      expect(connectorsApi.testConnector).toHaveBeenCalledWith('credential-discord');
      expect(connectorsApi.testConnector).toHaveBeenCalledWith('credential-telegram');
    });

    await waitFor(() => {
      expect(connectorsApi.getAggregateConnectorHistory).toHaveBeenCalledTimes(2);
    });
  });

  it('tests a connector directly from the top-level operations queue', async () => {
    connectorsApi.getAggregateConnectorHistory
      .mockResolvedValueOnce(
        connectorHistoryPayload([
          {
            executionId: 'connector-test-bad',
            credentialId: 'credential-discord',
            credentialName: 'Discord Bot',
            provider: 'discord-bot',
            status: 'failed',
            startedAt: '2026-05-07T00:00:00Z',
            completedAt: '2026-05-07T00:00:01Z',
            error: 'Invalid token',
            eventTypes: ['tool.call.failed'],
          },
        ])
      )
      .mockResolvedValueOnce(
        connectorHistoryPayload([
          {
            executionId: 'connector-test-good',
            credentialId: 'credential-discord',
            credentialName: 'Discord Bot',
            provider: 'discord-bot',
            status: 'completed',
            startedAt: '2026-05-07T00:01:00Z',
            completedAt: '2026-05-07T00:01:01Z',
            error: null,
            eventTypes: ['tool.call.completed'],
          },
        ])
      );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test now/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Test now/i }));

    await waitFor(() => {
      expect(connectorsApi.testConnector).toHaveBeenCalledWith('credential-discord');
    });

    await waitFor(() => {
      expect(connectorsApi.getAggregateConnectorHistory).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText(/Latest queue test succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/connector-test-123/i)).toBeInTheDocument();
  });

  it('uses the immediate test result when aggregate history has not caught up', async () => {
    connectorsApi.getAggregateConnectorHistory
      .mockResolvedValueOnce(connectorHistoryPayload())
      .mockResolvedValueOnce(connectorHistoryPayload());
    connectorsApi.testConnector.mockResolvedValue({
      ok: true,
      provider: 'discord-bot',
      audit_execution_id: 'connector-test-immediate',
    });

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-discord',
          name: 'Discord',
          categoryId: 'communications',
          kind: 'planned',
          status: 'configured',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Discord Bot', source: 'discord-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'discord-bot',
            authModel: 'bot token',
            summary: 'Discord connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-discord'],
            matchedCredentialNames: ['Discord Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test now/i })).toBeInTheDocument();
    });

    expect(screen.getByTestId('operations-never-tested-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: /Test now/i }));

    await waitFor(() => {
      expect(screen.getByTestId('operations-healthy-count')).toHaveTextContent('1');
    });

    expect(screen.getByTestId('operations-never-tested-count')).toHaveTextContent('0');
    const row = screen.getByTestId('operations-row-credential-discord');
    expect(within(row).getByText('healthy')).toBeInTheDocument();
    expect(within(row).getByText(/connector-test-immediate/i)).toBeInTheDocument();
  });
});
