import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { IntegrationCategory, IntegrationProvider } from '@/types/integrations';
import {
  connectorsApi,
  connectorHistoryPayload,
  credentialsApi,
  integrationsApi,
  mcpServersApi,
  renderWorkspace,
  setupIntegrationsWorkspaceTest,
  writeClipboardText,
} from './IntegrationsWorkspace.test-utils';

describe('IntegrationsWorkspace planned connectors', () => {
  setupIntegrationsWorkspaceTest();

  async function clickCardButton(card: HTMLElement, name: RegExp) {
    if (!within(card).queryByRole('button', { name })) {
      fireEvent.click(within(card).getByTestId(/planned-provider-toggle-/));
      await waitFor(() => {
        expect(within(card).getByRole('button', { name })).toBeInTheDocument();
      });
    }
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name }));
    });
  }

  function emptyCustomCategory(): IntegrationCategory {
    return {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: [],
    };
  }

  async function openMcpServerDialog() {
    integrationsApi.listCategories.mockResolvedValue({
      categories: [emptyCustomCategory()],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=custom');
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('No custom providers')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /New MCP server/i }));
    return screen.getByRole('dialog');
  }

  it('persists and restores the active integration category tab from the URL', async () => {
    const customCategory = emptyCustomCategory();

    const llmCategory: IntegrationCategory = {
      id: 'llm-models',
      name: 'Models',
      description: 'Configured LLM connections and selectable runtime profiles.',
      status: 'supported',
      providers: [],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [llmCategory, customCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=custom');
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('No custom providers')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Models/i }));
    expect(window.location.search).toContain('integration-tab=llm-models');
  });

  it('offers a quick link to the OneCLI connections workspace', async () => {
    renderWorkspace();

    const onecliLink = await screen.findByRole('link', { name: /Open OneCLI/i });
    const onecliUrl = new URL(onecliLink.getAttribute('href') ?? '');

    expect(onecliUrl.hostname).toBe(window.location.hostname);
    expect(onecliUrl.port).toBe('10254');
    expect(onecliUrl.pathname).toBe('/connections');
    expect(onecliLink).toHaveAttribute('target', '_blank');
  });

  it('discovers an enabled MCP server immediately after creating it', async () => {
    mcpServersApi.createMcpServer.mockResolvedValue({
      id: 'agency-ai-media-lab',
      name: 'AI Media Lab MCP',
      transport: 'stdio',
      command: '/opt/open-agency/.venv/bin/agency-ai-media-lab-mcp',
      args: [],
      url: null,
      env_refs: [],
      enabled: true,
      allowlisted_command: 'agency-ai-media-lab-mcp',
      metadata: { family: 'ai_media_lab' },
    });
    mcpServersApi.discover.mockResolvedValue({ tools: [] });

    const dialog = await openMcpServerDialog();
    const textboxes = within(dialog).getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'AI Media Lab MCP' } });
    fireEvent.change(textboxes[1], {
      target: {
        value: '/opt/open-agency/.venv/bin/agency-ai-media-lab-mcp',
      },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Enabled/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Create MCP server/i }));

    await waitFor(() => {
      expect(mcpServersApi.createMcpServer).toHaveBeenCalledWith(
        expect.not.objectContaining({ allowlisted_command: expect.anything() })
      );
      expect(mcpServersApi.discover).toHaveBeenCalledWith('agency-ai-media-lab');
    });
  });

  it('does not discover a disabled MCP server after creating it', async () => {
    mcpServersApi.createMcpServer.mockResolvedValue({
      id: 'disabled-mcp',
      name: 'Disabled MCP',
      transport: 'stdio',
      command: 'disabled-mcp',
      args: [],
      url: null,
      env_refs: [],
      enabled: false,
      allowlisted_command: 'disabled-mcp',
      metadata: {},
    });

    const dialog = await openMcpServerDialog();
    const textboxes = within(dialog).getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Disabled MCP' } });
    fireEvent.change(textboxes[1], { target: { value: 'disabled-mcp' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create MCP server/i }));

    await waitFor(() => {
      expect(mcpServersApi.createMcpServer).toHaveBeenCalled();
    });
    expect(mcpServersApi.discover).not.toHaveBeenCalled();
  });

  it('shows custom tools as compact read-only capability cards', async () => {
    const customCategory: IntegrationCategory = {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: [
        {
          id: 'agency.http.request',
          name: 'Send HTTP Request',
          categoryId: 'custom',
          kind: 'tool',
          status: 'available',
          description: 'Send one HTTP request to an allowed API endpoint.',
          capabilities: ['http', 'network'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: false,
            refs: [],
            message: 'Credential values are expected to be managed by the backend.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: true,
          },
          raw: {
            id: 'agency.http.request',
            name: 'Send HTTP Request',
            description: 'Send one HTTP request to an allowed API endpoint.',
            tool_type: 'python_function',
            input_schema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                method: { type: 'string' },
              },
            },
            output_schema: {
              type: 'object',
              properties: {
                status_code: { type: 'integer' },
              },
            },
            implementation: {
              implementation_type: 'python',
              target: 'app.tools.implementations.http_integrations',
              entrypoint: 'execute_custom_api',
            },
            tags: ['http', 'network'],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [customCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=custom');
    renderWorkspace();

    expect(await screen.findByText('Tool capability')).toBeInTheDocument();
    expect(screen.getByText('agency.http.request')).toBeInTheDocument();
    expect(screen.getByText('2 fields')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open contracts/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Tool definition')).not.toBeInTheDocument();
    expect(screen.queryByText('Input Schema')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Tool/i })).not.toBeInTheDocument();
  });

  it('groups custom integrations and keeps category search state paginated', async () => {
    const customProviders: IntegrationProvider[] = [
      ...Array.from({ length: 24 }, (_, index) => ({
        id: `agency.tool.${index + 1}`,
        name: `Open Agency Tool ${index + 1}`,
        categoryId: 'custom',
        kind: 'tool' as const,
        status: 'available' as const,
        description: `Workflow automation tool ${index + 1}`,
        capabilities: ['workflow'],
        configFields: [],
        credentialStatus: {
          managedByBackend: true,
          writeSupported: false,
          refs: [],
          message: 'Managed by backend.',
        },
        actions: {
          canSaveConfig: false,
          canEnableDisable: false,
          canTestConnection: true,
        },
        raw: {
          id: `agency.tool.${index + 1}`,
          name: `Open Agency Tool ${index + 1}`,
          input_schema: { type: 'object', properties: {} },
          output_schema: { type: 'object', properties: {} },
          tags: ['workflow'],
        },
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        id: `agency.mcp.${index + 1}`,
        name: `Shared MCP ${index + 1}`,
        categoryId: 'custom',
        kind: 'mcp_server' as const,
        status: 'enabled' as const,
        description: `Shared MCP server ${index + 1}`,
        capabilities: ['mcp', 'network'],
        configFields: [],
        credentialStatus: {
          managedByBackend: true,
          writeSupported: false,
          refs: [],
          message: 'Managed by backend.',
        },
        actions: {
          canSaveConfig: false,
          canEnableDisable: false,
          canTestConnection: true,
        },
        raw: {
          id: `agency.mcp.${index + 1}`,
          name: `Shared MCP ${index + 1}`,
          transport: 'stdio',
        },
      })),
    ];

    const customCategory: IntegrationCategory = {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: customProviders,
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [customCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=custom');
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'Workflow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Network \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Showing 1-24 of 26')).toBeInTheDocument();
    expect(screen.queryByText('Shared MCP 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Network \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByText('Shared MCP 2')).toBeInTheDocument();
    });
    expect(window.location.search).toContain('integration-page-custom=2');

    fireEvent.change(screen.getByPlaceholderText(/Search custom integrations/i), {
      target: { value: 'Shared MCP 2' },
    });

    await waitFor(() => {
      expect(screen.getByText('Shared MCP 2')).toBeInTheDocument();
    });
    expect(screen.queryByText('Open Agency Tool 1')).not.toBeInTheDocument();
    expect(window.location.search).toContain('integration-search-custom=Shared+MCP+2');
  });

  it('paginates and searches planned connectors within a category', async () => {
    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: Array.from({ length: 26 }, (_, index) => {
        const label = String(index + 1).padStart(2, '0');
        const backendKey = index < 11 ? 'telegram-bot' : index < 22 ? 'twilio-sms' : 'gmail-oauth';

        return {
          id: `communications-provider-${label}`,
          name: `Communications Provider ${label}`,
          categoryId: 'communications',
          kind: 'planned' as const,
          status: 'planned' as const,
          description: `Connector ${label}`,
          capabilities: ['bot token'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'Needs setup.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey,
            authModel: 'bot token',
            summary: `Connector ${label}`,
            launchPriority: 'now',
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        };
      }),
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=communications');
    renderWorkspace();

    expect(await screen.findByText('Showing 1-11 of 26')).toBeInTheDocument();
    expect(screen.queryByText('Communications Provider 26')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('category-next-page-communications'));

    await waitFor(() => {
      expect(screen.getByText('Communications Provider 13')).toBeInTheDocument();
    });
    expect(window.location.search).toContain('integration-page-communications=2');

    fireEvent.change(screen.getByPlaceholderText(/Search communications connectors/i), {
      target: { value: 'Provider 13' },
    });

    await waitFor(() => {
      expect(screen.getByText('Communications Provider 13')).toBeInTheDocument();
    });
    expect(screen.queryByText('Communications Provider 1')).not.toBeInTheDocument();
    expect(window.location.search).toContain('integration-search-communications=Provider+13');
  });

  it('restores a selected planned connector from the URL and opens its category tab', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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

    const customCategory: IntegrationCategory = {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: [],
    };

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
      categories: [customCategory, communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState(
      {},
      '',
      '/integrations?integration-tab=custom&planned-filter-communications=healthy&integration-connector=communications-discord'
    );
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Communications/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    expect(screen.getByTestId('planned-provider-card-communications-discord')).toBeInTheDocument();
    expect(
      await screen.findByTestId('planned-provider-card-communications-telegram')
    ).toBeInTheDocument();
  });

  it('opens the productivity tab and focuses Microsoft 365 from its connector URL', async () => {
    const customCategory: IntegrationCategory = {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: [],
    };

    const productivityCategory: IntegrationCategory = {
      id: 'productivity',
      name: 'Productivity',
      description: 'Productivity connectors.',
      status: 'planned',
      providers: [
        {
          id: 'productivity-notion',
          name: 'Notion',
          categoryId: 'productivity',
          kind: 'planned',
          status: 'planned',
          description: 'Notion connector',
          capabilities: ['oauth', 'next'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: oauth.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'notion',
            authModel: 'oauth',
            summary: 'Notion connector',
            launchPriority: 'next',
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
        {
          id: 'productivity-microsoft-365',
          name: 'Microsoft 365',
          categoryId: 'productivity',
          kind: 'planned',
          status: 'planned',
          description: 'Microsoft 365 connector',
          capabilities: ['oauth', 'next'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: oauth.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'microsoft-365',
            authModel: 'oauth',
            summary: 'Microsoft 365 connector',
            launchPriority: 'next',
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [customCategory, productivityCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState(
      {},
      '',
      '/integrations?integration-tab=productivity&integration-connector=productivity-microsoft-365'
    );
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Productivity/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    const microsoftCard = await screen.findByTestId(
      'planned-provider-card-productivity-microsoft-365'
    );

    const microsoftToggle = within(microsoftCard).getByTestId(/planned-provider-toggle-/);
    expect(microsoftToggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(document.activeElement).toBe(microsoftToggle);
    });
  });

  it('persists the selected connector in the URL and clears it when switching tabs', async () => {
    const customCategory: IntegrationCategory = {
      id: 'custom',
      name: 'Custom',
      description: 'Custom tools and MCP servers.',
      status: 'supported',
      providers: [],
    };

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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory, customCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    await waitFor(() => {
      expect(
        screen.getByTestId('planned-provider-card-communications-telegram')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('planned-provider-toggle-communications-telegram'));
    expect(window.location.search).toContain('integration-connector=communications-telegram');

    fireEvent.click(screen.getByRole('tab', { name: /Custom/i }));
    expect(window.location.search).toContain('integration-tab=custom');
    expect(window.location.search).not.toContain('integration-connector=');
  });

  it('clears a stale connector param that no longer maps to any category', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState(
      {},
      '',
      '/integrations?integration-connector=communications-missing'
    );
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Telegram')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.location.search).not.toContain('integration-connector=');
    });
  });

  it('uses a native disclosure button for keyboard-compatible connector selection', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    const connectorToggle = within(connectorCard).getByTestId(/planned-provider-toggle-/);
    expect(connectorToggle.tagName).toBe('BUTTON');
    fireEvent.click(connectorToggle);

    expect(window.location.search).toContain('integration-connector=communications-telegram');
    expect(connectorToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not select the connector when clicking setup actions inside the card', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    expect(within(connectorCard).getByText('Setup guide available')).toBeInTheDocument();
    expect(
      within(connectorCard).getByText('Ready to connect — review requirements or start setup now.')
    ).toBeInTheDocument();

    await clickCardButton(connectorCard, /Set up connector/i);
    expect(await screen.findByRole('heading', { name: /Set up Telegram/i })).toBeInTheDocument();

    expect(window.location.search).not.toContain('integration-connector=');
  });

  it('creates a backend-owned OneCLI setup session from a planned connector card', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Set up connector/i);

    await waitFor(() => {
      expect(credentialsApi.getConnectorCredentialSchema).toHaveBeenCalledWith('telegram-bot');
    });

    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Telegram Bot' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    await waitFor(() => {
      expect(connectorsApi.createConnectorSetupSession).toHaveBeenCalledWith('telegram-bot', {
        provider: 'telegram-bot',
        name: 'Telegram Bot',
        metadata: {},
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('onecli-copy-row-custom_connection_key')).toHaveTextContent(
        'agency-telegram-bot-connectorins'
      );
    });
    expect(screen.getByTitle('Telegram secure setup in OneCLI')).toBeInTheDocument();
    expect(screen.getByText('Secure OneCLI workspace')).toBeInTheDocument();
    expect(screen.queryByLabelText('OneCLI Credential Ref')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Abandon setup/i }));
    await waitFor(() => {
      expect(connectorsApi.deleteConnectorInstallation).toHaveBeenCalledWith(
        'connector-installation-telegram'
      );
    });
    expect(screen.queryByTitle('Telegram secure setup in OneCLI')).not.toBeInTheDocument();
  });

  it('allows a configured connector to add another setup instead of only updating', async () => {
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    fireEvent.click(within(connectorCard).getByTestId(/planned-provider-toggle-/));

    expect(within(connectorCard).getByRole('button', { name: /Add another setup/i }));
    expect(within(connectorCard).getByRole('button', { name: /Update credential/i }));

    await clickCardButton(connectorCard, /Update credential/i);
    expect(await screen.findByRole('heading', { name: /Update Telegram credential/i }));
    expect(credentialsApi.getCredential).toHaveBeenCalledWith('credential-telegram');

    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Telegram Bot Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Update credential/i }));

    await waitFor(() => {
      expect(credentialsApi.updateConnectorCredential).toHaveBeenCalledWith('credential-telegram', {
        provider: 'telegram-bot',
        name: 'Telegram Bot Updated',
        metadata: {},
      });
    });
    expect(connectorsApi.createConnectorSetupSession).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Update Telegram credential/i })).toBeNull();
    });

    await clickCardButton(connectorCard, /Add another setup/i);
    expect(await screen.findByRole('heading', { name: /Set up Telegram/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    await waitFor(() => {
      expect(connectorsApi.createConnectorSetupSession).toHaveBeenCalledWith('telegram-bot', {
        provider: 'telegram-bot',
        name: 'Telegram',
        metadata: {},
      });
    });
    expect(credentialsApi.updateConnectorCredential).toHaveBeenCalledTimes(1);
  });

  it('allows deleting a configured connector with a single saved instance', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    connectorsApi.listConnectorInstallations.mockResolvedValue({
      items: [
        {
          id: 'connector-installation-telegram',
          owner_user_id: 'user-integrations',
          provider: 'telegram-bot',
          name: 'Telegram Bot',
          onecli_credential_ref:
            'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
          status: 'active',
          setup_session_id: 'connector-installation-telegram',
          metadata: {},
        },
      ],
    });
    connectorsApi.deleteConnectorInstallation.mockResolvedValue({
      deleted: true,
      id: 'connector-installation-telegram',
    });

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
            matchedCredentials: [
              {
                id: 'credential-telegram',
                name: 'Telegram Bot',
                provider: 'telegram-bot',
                secret_ref:
                  'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
                metadata: {},
              },
            ],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Delete selected instance/i);
    fireEvent.click(screen.getByRole('button', { name: /Delete instance/i }));

    await waitFor(() => {
      expect(connectorsApi.deleteConnectorInstallation).toHaveBeenCalledWith(
        'connector-installation-telegram'
      );
    });
  });

  it('allows deleting one instance when multiple connector instances are detected', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    connectorsApi.listConnectorInstallations.mockResolvedValue({
      items: [
        {
          id: 'connector-installation-telegram-primary',
          owner_user_id: 'user-integrations',
          provider: 'telegram-bot',
          name: 'Telegram Bot Primary',
          onecli_credential_ref:
            'onecli://users/user-integrations/telegram-bot/connector-installation-telegram-primary',
          status: 'active',
          setup_session_id: 'connector-installation-telegram-primary',
          metadata: {},
        },
        {
          id: 'connector-installation-telegram-secondary',
          owner_user_id: 'user-integrations',
          provider: 'telegram-bot',
          name: 'Telegram Bot Secondary',
          onecli_credential_ref:
            'onecli://users/user-integrations/telegram-bot/connector-installation-telegram-secondary',
          status: 'active',
          setup_session_id: 'connector-installation-telegram-secondary',
          metadata: {},
        },
      ],
    });
    connectorsApi.deleteConnectorInstallation.mockResolvedValue({
      deleted: true,
      id: 'connector-installation-telegram-secondary',
    });

    const initialCategory: IntegrationCategory = {
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
            refs: [
              { name: 'Telegram Bot', source: 'telegram-bot' },
              { name: 'Telegram Bot', source: 'telegram-bot' },
            ],
            message: '2 backend credentials mapped to this connector.',
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
            matchedCredentialIds: ['credential-telegram-primary', 'credential-telegram-secondary'],
            matchedCredentialNames: ['Telegram Bot', 'Telegram Bot'],
            matchedCredentials: [
              {
                id: 'credential-telegram-primary',
                name: 'Telegram Bot',
                provider: 'telegram-bot',
                secret_ref:
                  'onecli://users/user-integrations/telegram-bot/connector-installation-telegram-primary',
                metadata: {},
              },
              {
                id: 'credential-telegram-secondary',
                name: 'Telegram Bot',
                provider: 'telegram-bot',
                secret_ref:
                  'onecli://users/user-integrations/telegram-bot/connector-installation-telegram-secondary',
                metadata: {},
              },
            ],
          },
        },
      ],
    };

    const updatedCategory: IntegrationCategory = {
      ...initialCategory,
      providers: [
        {
          ...initialCategory.providers[0],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [{ name: 'Telegram Bot', source: 'telegram-bot' }],
            message: '1 backend credential mapped to this connector.',
          },
          raw: {
            backendKey: 'telegram-bot',
            authModel: 'bot token',
            summary: 'Telegram connector',
            launchPriority: 'now',
            matchedCredentialIds: ['credential-telegram-primary'],
            matchedCredentialNames: ['Telegram Bot'],
          },
        },
      ],
    };

    integrationsApi.listCategories
      .mockResolvedValueOnce({
        categories: [initialCategory],
        registrySource: 'backend',
        registryUpdatedAt: null,
      })
      .mockResolvedValueOnce({
        categories: [updatedCategory],
        registrySource: 'backend',
        registryUpdatedAt: null,
      });

    renderWorkspace();

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    fireEvent.click(within(connectorCard).getByTestId(/planned-provider-toggle-/));

    expect(within(connectorCard).getByText(/Multiple instances detected/i)).toBeInTheDocument();
    fireEvent.change(within(connectorCard).getByLabelText(/Active instance/i), {
      target: { value: 'credential-telegram-secondary' },
    });
    await clickCardButton(connectorCard, /Delete selected instance/i);

    expect(screen.getByRole('button', { name: /Delete instance/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete instance/i }));

    await waitFor(() => {
      expect(connectorsApi.deleteConnectorInstallation).toHaveBeenCalledWith(
        'connector-installation-telegram-secondary'
      );
    });

    await waitFor(() => {
      expect(screen.queryByText(/Multiple instances detected/i)).not.toBeInTheDocument();
    });
  });

  it('preloads production webhook metadata when updating a Discord credential', async () => {
    credentialsApi.getCredential.mockResolvedValue({
      id: 'credential-discord',
      provider: 'discord-bot',
      name: 'Discord Bot',
      secret_ref: 'onecli://users/user-integrations/discord-bot/connector-installation-discord',
      status: 'active',
      metadata: {
        application_id: 'app-123',
        bot_user_id: 'bot-123',
        default_guild_id: 'guild-123',
        webhook_public_key: 'abcdef123456',
      },
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

    const connectorCard = await screen.findByTestId('planned-provider-card-communications-discord');

    await clickCardButton(connectorCard, /Update credential/i);
    expect(await screen.findByRole('heading', { name: /Update Discord credential/i }));
    expect(screen.getByLabelText('webhook_public_key')).toHaveValue('abcdef123456');
  });

  it('renders only the backend-issued session resource name after setup starts', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Set up connector/i);

    expect(screen.queryByLabelText('Secret Reference')).not.toBeInTheDocument();
    expect(screen.queryByText(/Manual secret ref/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    await waitFor(() => {
      expect(connectorsApi.createConnectorSetupSession).toHaveBeenCalledWith('telegram-bot', {
        provider: 'telegram-bot',
        name: 'Telegram',
        metadata: {},
      });
    });
    expect(screen.queryByLabelText('Device Code')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('OneCLI Credential Ref')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onecli-copy-row-device_code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onecli-copy-row-credential_ref')).not.toBeInTheDocument();
    expect(screen.getByText('Copy into OneCLI')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-setup-guide-telegram-bot')).not.toBeInTheDocument();
    expect(screen.getByText('Connect in OneCLI')).toBeInTheDocument();
    expect(screen.queryByText('Store in OneCLI')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Agency keeps')).not.toBeInTheDocument();
    expect(screen.queryByText('agency_user_id')).not.toBeInTheDocument();
    expect(screen.getByTestId('onecli-copy-row-custom_connection_key')).toHaveTextContent('Name');
    expect(screen.getByTestId('onecli-copy-row-custom_connection_key')).toHaveTextContent(
      'agency-telegram-bot-connectorins'
    );
    expect(screen.getByTestId('onecli-copy-row-secret_bot_token')).toHaveTextContent(
      'Secret value'
    );
    expect(screen.getByText('Paste Telegram Bot API token from BotFather')).toBeInTheDocument();
    expect(screen.getByText(/Setup notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Telegram uses OneCLI URL-path injection/i)).toBeInTheDocument();
    expect(screen.queryByText('Open Agency installation id')).not.toBeInTheDocument();
    expect(screen.queryByText('Device code')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('onecli-copy-row-secret_bot_token')).getByRole('button', {
        name: /Provider secret/i,
      })
    ).toBeDisabled();

    fireEvent.click(
      within(screen.getByTestId('onecli-copy-row-custom_connection_key')).getByRole('button', {
        name: /Copy/i,
      })
    );

    expect(writeClipboardText).toHaveBeenCalledWith('agency-telegram-bot-connectorins');
  });

  it('rewrites internal OneCLI setup URLs to the browser host before rendering them', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
      ],
    };

    credentialsApi.getConnectorCredentialSchema.mockResolvedValueOnce({
      backendKey: 'telegram-bot',
      displayName: 'Telegram',
      authModel: 'bot token',
      providerAliases: ['telegram'],
      onecliTransportMode: 'proxy',
      onecliSecretProfile: {
        hostPattern: 'api.telegram.org',
        pathPattern: '/bot*',
        injectionTarget: 'url_path',
        pathTemplate: '/bot{value}',
      },
      healthSupported: false,
      requiredMetadata: [],
      supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
      onecliSetupGuide: {
        storagePath: 'onecli://users/{agency_user_id}/telegram-bot/{agency_installation_id}',
        fields: [
          {
            key: 'bot_token',
            label: 'Bot token',
            secret: true,
            description: 'Paste the Telegram bot token into OneCLI.',
          },
        ],
        agencyStores: ['installation status'],
        completionSignal: 'OneCLI marks the installation active.',
      },
    });
    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    renderWorkspace();

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    await clickCardButton(connectorCard, /Set up connector/i);
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    await waitFor(() => {
      expect(connectorsApi.createConnectorSetupSession).toHaveBeenCalledWith('telegram-bot', {
        provider: 'telegram-bot',
        name: 'Telegram',
        metadata: {},
      });
    });

    const embeddedSetup = await screen.findByTitle('Telegram secure setup in OneCLI');
    const setupUrl = new URL(embeddedSetup.getAttribute('src') ?? '');
    const installationIdInput = await screen.findByLabelText('Installation id');

    expect(setupUrl.hostname).toBe(window.location.hostname);
    expect(setupUrl.port).toBe('10254');
    expect(setupUrl.pathname).toBe('/connections/custom');
    expect(setupUrl.searchParams.get('create')).toBe('generic');
    expect(setupUrl.searchParams.get('host')).toBe('api.telegram.org');
    expect(setupUrl.searchParams.has('provider')).toBe(false);
    expect(setupUrl.searchParams.has('agency_installation_id')).toBe(false);
    expect((installationIdInput as HTMLInputElement).value).toBe('connector-installation-telegram');
  });

  it('shows OneCLI Generic Secret form values for Discord setup', async () => {
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
          status: 'planned',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
          },
        },
      ],
    };

    credentialsApi.getConnectorCredentialSchema.mockResolvedValueOnce({
      backendKey: 'discord-bot',
      displayName: 'Discord',
      authModel: 'bot token',
      providerAliases: ['discord'],
      onecliTransportMode: 'proxy',
      onecliSecretProfile: {
        hostPattern: 'discord.com',
        pathPattern: '/api/v10/*',
        injectionTarget: 'header',
        headerName: 'Authorization',
        valueFormat: 'Bot {value}',
      },
      healthSupported: true,
      requiredMetadata: [],
      supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
      onecliSetupGuide: {
        storagePath: 'onecli://users/{agency_user_id}/discord-bot/{agency_installation_id}',
        fields: [
          {
            key: 'bot_token',
            label: 'Bot token',
            secret: true,
            description: 'Paste the Discord bot token into OneCLI.',
          },
        ],
        agencyStores: ['installation status'],
        completionSignal: 'OneCLI marks the installation active.',
      },
    });
    integrationsApi.listCategories.mockResolvedValue({
      categories: [communicationsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });
    connectorsApi.createConnectorSetupSession.mockResolvedValueOnce({
      installation: {
        id: 'connector-installation-discord',
        owner_user_id: 'user-integrations',
        provider: 'discord-bot',
        name: 'Discord',
        onecli_credential_ref: 'onecli://users/user-integrations/discord-bot/provisional',
        status: 'setup_pending',
        setup_session_id: 'connector-installation-discord',
        setup_started_at: '2099-01-01T00:00:00Z',
        setup_expires_at: '2099-01-01T00:30:00Z',
        metadata: {},
      },
      setup_url: 'http://onecli:10254/',
      device_code: 'CONNECTOR',
      onecli_credential_ref: 'onecli://users/user-integrations/discord-bot/provisional',
      onecli_resource_name: 'agency-discord-bot-connectorins',
      expires_at: '2099-01-01T00:30:00Z',
    });

    renderWorkspace();

    const connectorCard = await screen.findByTestId('planned-provider-card-communications-discord');
    await clickCardButton(connectorCard, /Set up connector/i);

    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));
    expect(await screen.findByText('Copy into OneCLI')).toBeInTheDocument();
    expect(screen.getByText(/Connections, Custom, Generic Secret/i)).toBeInTheDocument();
    expect(screen.getByTestId('onecli-copy-row-custom_connection_key')).toHaveTextContent(
      'agency-discord-bot-connectorins'
    );
    expect(screen.getByTestId('onecli-copy-row-secret_bot_token')).toHaveTextContent(
      'Paste Bot token from Discord'
    );
    expect(screen.getByTestId('onecli-copy-row-host_pattern')).toHaveTextContent('discord.com');
    expect(screen.getByTestId('onecli-copy-row-header_name')).toHaveTextContent('Authorization');
    expect(screen.getByTestId('onecli-copy-row-path_pattern')).toHaveTextContent('/api/v10/*');
    expect(screen.getByTestId('onecli-copy-row-value_format')).toHaveTextContent('Bot {value}');
    expect(screen.queryByTestId('onecli-copy-row-credential_ref')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('onecli-copy-row-secret_bot_token')).getByRole('button', {
        name: /Provider secret/i,
      })
    ).toBeDisabled();
  });

  it('completes an existing pending Discord installation after the OneCLI custom secret is created', async () => {
    const pendingInstallation = {
      id: 'connector-installation-discord',
      owner_user_id: 'user-integrations',
      provider: 'discord-bot',
      name: 'Discord',
      onecli_credential_ref:
        'onecli://users/user-integrations/discord-bot/connector-installation-discord',
      status: 'setup_pending' as const,
      setup_session_id: 'connector-installation-discord',
      setup_started_at: '2099-01-01T00:00:00Z',
      setup_expires_at: '2099-01-01T00:30:00Z',
      metadata: { webhook_public_key: 'discord-public-key' },
    };
    connectorsApi.listConnectorInstallations.mockResolvedValue({
      items: [pendingInstallation],
    });
    connectorsApi.completeConnectorInstallation.mockResolvedValue({
      ...pendingInstallation,
      status: 'active',
    });
    connectorsApi.resumeConnectorSetupSession.mockResolvedValueOnce({
      installation: pendingInstallation,
      setup_url: 'http://onecli:10254/',
      device_code: 'CONNECTOR',
      onecli_credential_ref: pendingInstallation.onecli_credential_ref,
      onecli_resource_name: 'agency-discord-bot-connectorins',
      expires_at: '2099-01-01T00:30:00Z',
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
          status: 'planned',
          description: 'Discord connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId('planned-provider-card-communications-discord');

    await clickCardButton(connectorCard, /Set up connector/i);

    expect(await screen.findByText('Waiting for verification')).toBeInTheDocument();
    expect(connectorsApi.resumeConnectorSetupSession).toHaveBeenCalledWith(
      'connector-installation-discord'
    );
    expect(screen.getByLabelText('webhook_public_key')).toHaveValue('discord-public-key');
    expect(screen.getByText(/Finish the prefilled OneCLI flow/i)).toBeInTheDocument();
    const startSetupButton = screen.queryByRole('button', { name: /Start OneCLI setup/i });
    if (startSetupButton) {
      fireEvent.click(startSetupButton);
    }
    expect(screen.queryByLabelText('Runtime secret value')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify and activate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start OneCLI setup/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Verify and activate/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify and activate/i }));

    await waitFor(() => {
      expect(connectorsApi.completeConnectorInstallation).toHaveBeenCalledWith(
        'connector-installation-discord',
        {
          metadata: { webhook_public_key: 'discord-public-key' },
        }
      );
    });
    expect(connectorsApi.createConnectorSetupSession).not.toHaveBeenCalled();
  });

  it('never collects or submits a provider secret during completion', async () => {
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Set up connector/i);
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    expect(await screen.findByText('Waiting for verification')).toBeInTheDocument();
    expect(screen.queryByLabelText('Runtime secret value')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Verify and activate/i }));

    await waitFor(() => {
      expect(connectorsApi.completeConnectorInstallation).toHaveBeenCalledWith(
        'connector-installation-telegram',
        {
          metadata: {},
        }
      );
    });
  });

  it('refreshes setup status after OneCLI completes an installation', async () => {
    let setupCompleted = false;
    connectorsApi.listConnectorInstallations.mockImplementation(async () => ({
      items: setupCompleted
        ? [
            {
              id: 'connector-installation-telegram',
              owner_user_id: 'user-integrations',
              provider: 'telegram-bot',
              name: 'Telegram',
              onecli_credential_ref: 'onecli://users/user-integrations/secrets/verified-telegram',
              status: 'active' as const,
              setup_session_id: 'connector-installation-telegram',
              metadata: {},
            },
          ]
        : [],
    }));

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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Set up connector/i);
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    expect(await screen.findByText('Waiting for verification')).toBeInTheDocument();
    setupCompleted = true;
    fireEvent.click(screen.getByRole('button', { name: /Refresh status/i }));

    expect(await screen.findByText('Verified and active')).toBeInTheDocument();
    expect(screen.getByText('Status: Active')).toBeInTheDocument();
  });

  it('explains setup-session 404s instead of rendering raw Not Found text', async () => {
    connectorsApi.createConnectorSetupSession.mockRejectedValueOnce(
      new ApiError({ status: 404, message: 'Not Found' })
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    await clickCardButton(connectorCard, /Set up connector/i);
    fireEvent.click(await screen.findByRole('button', { name: /Start OneCLI setup/i }));

    expect(
      await screen.findByText(
        /Connector setup is not available from the running Open Agency backend yet/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
  });

  it('falls back to planned connector metadata when schema loading fails', async () => {
    credentialsApi.getConnectorCredentialSchema.mockRejectedValueOnce(
      new Error('Schema route unavailable')
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
          status: 'planned',
          description: 'Telegram connector',
          capabilities: ['bot token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: bot token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );

    await clickCardButton(connectorCard, /Set up connector/i);

    await waitFor(() => {
      expect(screen.getByLabelText('Auth Model')).toHaveValue('bot token');
    });

    expect(screen.queryByText(/Schema unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not Found/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Telegram Bot' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Start OneCLI setup/i }));

    await waitFor(() => {
      expect(connectorsApi.createConnectorSetupSession).toHaveBeenCalledWith('telegram-bot', {
        provider: 'telegram-bot',
        name: 'Telegram Bot',
        metadata: {},
      });
    });
  });

  it('shows connector-specific fallback metadata fields when schema loading fails', async () => {
    credentialsApi.getConnectorCredentialSchema.mockRejectedValueOnce(
      new Error('Schema route unavailable')
    );

    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: access token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-whatsapp'
    );

    await clickCardButton(connectorCard, /Set up connector/i);

    await waitFor(() => {
      expect(screen.getByLabelText('phone_number_id')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Schema unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not Found/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/phone_number_id/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('app_secret_ref')).toBeInTheDocument();
    expect(screen.queryByLabelText('app_secret')).not.toBeInTheDocument();
  });

  it('labels unverifiable connector shapes as guide-only and prevents activation', async () => {
    const communicationsCategory: IntegrationCategory = {
      id: 'communications',
      name: 'Communications',
      description: 'Comms connectors.',
      status: 'planned',
      providers: [
        {
          id: 'communications-microsoft-teams',
          name: 'Microsoft Teams',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'Teams connector',
          capabilities: ['oauth', 'later'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: oauth.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'microsoft-teams',
            authModel: 'oauth',
            summary: 'Teams connector',
            launchPriority: 'later',
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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

    expect(await screen.findByText('0 setup-ready')).toBeInTheDocument();
    expect(screen.getByText('1 guide-only')).toBeInTheDocument();
    const connectorCard = screen.getByTestId(
      'planned-provider-card-communications-microsoft-teams'
    );
    expect(within(connectorCard).getByText('Setup guide available')).toBeInTheDocument();
    expect(
      within(connectorCard).getByText(
        'Guide only — verified OneCLI activation is not available yet.'
      )
    ).toBeInTheDocument();
    await clickCardButton(connectorCard, /View setup guide/i);

    expect(await screen.findByText('Setup is guide-only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guide only' })).toBeDisabled();
    expect(connectorsApi.createConnectorSetupSession).not.toHaveBeenCalled();
  });

  it('tests a saved connector directly from a planned connector card', async () => {
    connectorsApi.getConnectorHistory.mockResolvedValue({
      items: [
        {
          executionId: 'connector-test-older',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
      status: null,
      startedAfter: null,
      startedBefore: null,
    });

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
            canTestConnection: true,
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

    const connectorCard = await screen.findByTestId(
      'planned-provider-card-communications-telegram'
    );
    fireEvent.click(within(connectorCard).getByTestId(/planned-provider-toggle-/));

    expect(screen.getByText(/Recent test history/i)).toBeInTheDocument();
    expect(connectorsApi.getConnectorHistory).toHaveBeenCalledWith('credential-telegram');

    await waitFor(() => {
      expect(
        within(connectorCard).getByRole('button', { name: /Test connection/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(within(connectorCard).getByRole('button', { name: /Test connection/i }));

    await waitFor(() => {
      expect(connectorsApi.testConnector).toHaveBeenCalledWith('credential-telegram');
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('planned-provider-status-communications-telegram')
      ).toHaveTextContent('Healthy');
    });

    await waitFor(() => {
      expect(connectorsApi.getConnectorHistory.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText(/Backend health check succeeded/i)).toBeInTheDocument();
    expect(within(connectorCard).getByText(/Audit execution:/i)).toHaveTextContent(
      'connector-test-123'
    );
  });

  it('hydrates the connector card health state from persisted history after refresh', async () => {
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

    const connectorCard = await screen.findByTestId('planned-provider-card-communications-discord');
    fireEvent.click(within(connectorCard).getByTestId(/planned-provider-toggle-/));

    await waitFor(() => {
      expect(
        screen.getByTestId('planned-provider-status-communications-discord')
      ).toHaveTextContent('Healthy');
    });
    expect(within(connectorCard).getByText(/Backend health check succeeded/i)).toBeInTheDocument();
    expect(within(connectorCard).getByText(/Audit execution:/i)).toHaveTextContent(
      'connector-test-persisted'
    );
  });

  it('summarizes planned category connector health from recent history', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: access token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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
      expect(connectorsApi.getAggregateConnectorHistory).toHaveBeenCalledWith({ limit: 200 });
    });
    await waitFor(() => {
      expect(screen.getByTestId('planned-filter-communications-healthy')).toHaveTextContent(
        'Healthy (1)'
      );
      expect(screen.getByTestId('planned-filter-communications-failing')).toHaveTextContent(
        'Failing (1)'
      );
      expect(screen.getByTestId('planned-filter-communications-never-tested')).toHaveTextContent(
        'Not tested (0)'
      );
    });
  });

  it('filters planned connectors by failing readiness state', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: access token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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
      expect(screen.getByTestId('planned-filter-communications-failing')).toHaveTextContent(
        'Failing (1)'
      );
    });

    fireEvent.click(screen.getByTestId('planned-filter-communications-failing'));

    expect(screen.getByTestId('planned-provider-card-communications-discord')).toBeInTheDocument();
    expect(
      screen.queryByTestId('planned-provider-card-communications-telegram')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('planned-provider-card-communications-whatsapp')
    ).not.toBeInTheDocument();
  });

  it('shows readiness status badges in planned connector card headers', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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
        {
          id: 'communications-slack',
          name: 'Slack',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'Slack connector',
          capabilities: ['oauth', 'next'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: oauth.',
          },
          actions: {
            canSaveConfig: false,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            backendKey: 'slack-app',
            authModel: 'oauth',
            summary: 'Slack connector',
            launchPriority: 'next',
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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
        screen.getByTestId('planned-provider-status-communications-telegram')
      ).toHaveTextContent('Healthy');
    });

    expect(screen.getByTestId('planned-provider-status-communications-discord')).toHaveTextContent(
      'Failing'
    );
    expect(screen.getByTestId('planned-provider-status-communications-whatsapp')).toHaveTextContent(
      'Not Tested'
    );
    expect(screen.getByTestId('planned-provider-status-communications-slack')).toHaveTextContent(
      'Need Setup'
    );
  });

  it('sorts planned connectors by readiness risk by default', async () => {
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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
        {
          id: 'communications-whatsapp',
          name: 'WhatsApp Cloud API',
          categoryId: 'communications',
          kind: 'planned',
          status: 'planned',
          description: 'WhatsApp connector',
          capabilities: ['access token', 'now'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: true,
            refs: [],
            message: 'No backend credential mapped yet. Expected auth model: access token.',
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
            matchedCredentialIds: [],
            matchedCredentialNames: [],
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
        screen.getByTestId('planned-provider-status-communications-discord')
      ).toHaveTextContent('Failing');
    });

    const connectorCardIds = screen
      .getAllByTestId(/planned-provider-card-communications-/)
      .map((node) => node.getAttribute('data-testid'));
    expect(connectorCardIds.indexOf('planned-provider-card-communications-discord')).toBeLessThan(
      connectorCardIds.indexOf('planned-provider-card-communications-whatsapp')
    );
    expect(connectorCardIds.indexOf('planned-provider-card-communications-whatsapp')).toBeLessThan(
      connectorCardIds.indexOf('planned-provider-card-communications-telegram')
    );
  });

  it('persists planned connector filters in the URL', async () => {
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

    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(
      connectorHistoryPayload([
        {
          executionId: 'connector-test-good',
          credentialId: 'credential-telegram',
          credentialName: 'Telegram Bot',
          provider: 'telegram-bot',
          status: 'completed',
          startedAt: '2026-05-07T00:00:00Z',
          completedAt: '2026-05-07T00:00:01Z',
          error: null,
          eventTypes: ['tool.call.completed'],
        },
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

    window.history.replaceState({}, '', '/integrations?planned-filter-communications=failing');
    renderWorkspace();

    await waitFor(() => {
      expect(
        screen.getByTestId('planned-provider-card-communications-discord')
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('planned-provider-card-communications-telegram')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('planned-filter-communications-all'));
    expect(window.location.search).not.toContain('planned-filter-communications');

    fireEvent.click(screen.getByTestId('planned-filter-communications-healthy'));
    expect(window.location.search).toContain('planned-filter-communications=healthy');
  });
});
