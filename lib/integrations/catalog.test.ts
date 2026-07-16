import { describe, expect, it } from 'vitest';
import { buildIntegrationCatalog } from '@/lib/integrations/catalog';
import type {
  CredentialDefinition,
  IntegrationRegistryCategoryDefinition,
  PlannedIntegrationState,
} from '@/types/integrations';

describe('buildIntegrationCatalog', () => {
  it('excludes revoked and disabled connector credentials from active inventory', () => {
    const credentials: CredentialDefinition[] = [
      {
        id: 'active-whatsapp',
        name: 'Active WhatsApp',
        provider: 'whatsapp-cloud-api',
        secret_ref: 'onecli://users/user/secrets/active',
        status: 'active',
      },
      {
        id: 'revoked-whatsapp',
        name: 'Revoked WhatsApp',
        provider: 'whatsapp-cloud-api',
        secret_ref: 'onecli://users/user/secrets/revoked',
        status: 'revoked',
      },
      {
        id: 'disabled-whatsapp',
        name: 'Disabled WhatsApp',
        provider: 'whatsapp-cloud-api',
        secret_ref: 'onecli://users/user/secrets/disabled',
        status: 'disabled',
      },
    ];
    const registryCategories: IntegrationRegistryCategoryDefinition[] = [
      {
        id: 'communications',
        name: 'Communications',
        description: 'Messaging connectors.',
        providers: {
          'WhatsApp Cloud API': {
            backendKey: 'whatsapp-cloud-api',
            authModel: 'access token',
            summary: 'WhatsApp messaging.',
          },
        },
      },
    ];

    const catalog = buildIntegrationCatalog({
      credentials,
      registryCategories,
      modelProviders: [],
      modelProfiles: [],
      tools: [],
      mcpServers: [],
      runtimeAdapters: [],
    });
    const provider = catalog.find((category) => category.id === 'communications')!.providers[0];
    const planned = provider.raw as PlannedIntegrationState;

    expect(planned.matchedCredentialIds).toEqual(['active-whatsapp']);
    expect(provider.credentialStatus.refs).toHaveLength(1);
  });
});
