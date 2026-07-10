import { agencyApiClient } from '@/lib/api/clientInstances';

export interface BackendFeatureCapability {
  title: string;
  managedByBackend: boolean;
  readSupported: boolean;
  writeSupported: boolean;
  plannedRoutes: string[];
  message: string;
}

export interface PublicEndpointInfo {
  provider: 'auto' | 'none' | 'ngrok' | 'cloudflare';
  custom_domain: string | null;
  source: string;
  updated_at: string;
  current_public_url: string | null;
}

export const profileApi = {
  async getPublicEndpointInfo(): Promise<PublicEndpointInfo> {
    const payload = await agencyApiClient.get<
      PublicEndpointInfo & {
        requirements?: unknown;
      }
    >('/setup/tunnel-preference');

    return {
      provider: payload.provider,
      custom_domain: payload.custom_domain,
      source: payload.source,
      updated_at: payload.updated_at,
      current_public_url: payload.current_public_url,
    };
  },

  getApiTokenCapability(): BackendFeatureCapability {
    return {
      title: 'Backend API tokens',
      managedByBackend: true,
      readSupported: true,
      writeSupported: true,
      plannedRoutes: ['/api-tokens', '/api-tokens/{token_id}/revoke'],
      message:
        'Personal access token issuance and revocation are backend-owned. Generated tokens are shown once and stored only as hashes by the backend.',
    };
  },

  getIntegrationCredentialCapability(): BackendFeatureCapability {
    return {
      title: 'Integration credentials',
      managedByBackend: true,
      readSupported: true,
      writeSupported: true,
      plannedRoutes: [
        '/credentials',
        '/credentials/{credential_id}',
        '/credentials/{credential_id}/revoke',
        '/credentials/{credential_id}/rotate',
      ],
      message:
        'Credential metadata is backend-owned. Store only backend secret references here; rotation marks a new secret reference/version after the raw secret is changed in the configured secret store.',
    };
  },
};
