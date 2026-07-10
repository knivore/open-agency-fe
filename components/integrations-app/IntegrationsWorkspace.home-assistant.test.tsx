import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IntegrationCategory } from '@/types/integrations';
import {
  credentialsApi,
  integrationsApi,
  renderWorkspace,
  setupIntegrationsWorkspaceTest,
  smartHomeApi,
} from './IntegrationsWorkspace.test-utils';

function homeAssistantCategory(): IntegrationCategory {
  return {
    id: 'home-tools',
    name: 'Smart Home',
    description: 'Smart-home module.',
    status: 'planned',
    providers: [
      {
        id: 'home-tools-home-assistant',
        name: 'Smart Home',
        categoryId: 'home-tools',
        kind: 'planned',
        status: 'planned',
        description: 'Home Assistant-backed Smart Home connector',
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
          backendKey: 'home-assistant',
          authModel: 'access token',
          summary: 'Smart Home connector',
          launchPriority: 'now',
          matchedCredentialIds: [],
          matchedCredentialNames: [],
        },
      },
    ],
  };
}

describe('IntegrationsWorkspace Home Assistant', () => {
  setupIntegrationsWorkspaceTest();

  it('loads backend connector capabilities and previews live Home Assistant entities', async () => {
    const homeToolsCategory = homeAssistantCategory();

    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {
        'home-assistant': {
          backendKey: 'home-assistant',
          displayName: 'Smart Home',
          authModel: 'access token',
          providerAliases: ['home-assistant', 'smart-home'],
          capabilitySurface: 'module',
          moduleCapabilities: ['safe home actions', 'camera-capable entity access'],
          dependsOnAgencyCapabilities: [
            'vision',
            'speech',
            'speech output',
            'speech continuation',
            'ambient-agent orchestration',
          ],
          ownershipNotes: [
            'Camera analysis should run through Agency vision capabilities rather than a Smart Home-owned vision stack.',
            'Speech session handling and conversational continuation should run through Agency speech capabilities rather than a Smart Home-owned speech stack.',
          ],
          onecliTransportMode: 'proxy',
          healthSupported: false,
          requiredMetadata: [],
          instanceIdentityMetadata: [
            {
              key: 'base_url',
              description: 'Base URL for the Home Assistant instance, including scheme and host.',
            },
          ],
          targetScopeMetadata: [],
          supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
          onecliSetupGuide: {
            storagePath: 'onecli://users/{agency_user_id}/home-assistant/{agency_installation_id}',
            fields: [
              {
                key: 'base_url',
                label: 'Base URL',
                secret: false,
                description: 'Store the full Home Assistant base URL.',
              },
              {
                key: 'access_token',
                label: 'Long-lived access token',
                secret: true,
                description: 'Store the Home Assistant bearer token.',
              },
            ],
            options: [
              {
                id: 'long-lived-token',
                name: 'Long-Lived Token',
                authModel: 'access token',
                summary: 'Recommended.',
                fields: [],
                notes: [],
              },
            ],
            agencyStores: ['installation id'],
            completionSignal: 'Agency marks the installation active.',
            notes: ['Connect Agency through the Smart Home path backed by Home Assistant.'],
          },
        },
      },
      updated_at: null,
    });

    integrationsApi.listCategories.mockResolvedValue({
      categories: [homeToolsCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=home-tools');
    renderWorkspace();

    await waitFor(() => {
      expect(credentialsApi.getConnectorCredentialCapabilities).toHaveBeenCalled();
    });

    expect(await screen.findByText('Module ownership')).toBeInTheDocument();
    expect(screen.getByText('safe home actions')).toBeInTheDocument();
    expect(screen.getByText('camera-capable entity access')).toBeInTheDocument();
    expect(screen.getByText('vision')).toBeInTheDocument();
    expect(screen.getByText('speech')).toBeInTheDocument();
    expect(screen.getByText('speech output')).toBeInTheDocument();
    expect(screen.getByText('speech continuation')).toBeInTheDocument();

    const card = await screen.findByTestId('planned-provider-card-home-tools-home-assistant');
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /List entities/i }));
    });

    expect(await screen.findByText('Smart Home entity preview')).toBeInTheDocument();
    expect(await screen.findByText('Living Room Main')).toBeInTheDocument();
    expect(screen.getByText('sensor.entry_motion')).toBeInTheDocument();
    expect(smartHomeApi.listEntities).toHaveBeenCalled();
  });

  it('disables live Smart Home entity preview when the backend module is unavailable', async () => {
    smartHomeApi.getAvailability.mockResolvedValue({
      available: false,
      reason: 'Smart-home module disabled by backend configuration.',
      source: 'capabilities',
      status: 'disabled',
    });
    integrationsApi.listCategories.mockResolvedValue({
      categories: [homeAssistantCategory()],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });

    window.history.replaceState({}, '', '/integrations?integration-tab=home-tools');
    renderWorkspace();

    const card = await screen.findByTestId('planned-provider-card-home-tools-home-assistant');
    await waitFor(() => {
      expect(smartHomeApi.getAvailability).toHaveBeenCalled();
    });

    expect(within(card).getByRole('button', { name: /List entities/i })).toBeDisabled();
    expect(smartHomeApi.listEntities).not.toHaveBeenCalled();
  });
});
