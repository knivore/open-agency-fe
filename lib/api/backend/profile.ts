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

export interface OpenVoiceStatus {
  optional: true;
  ready: boolean;
  supports_cloning: boolean;
  runtime: {
    installed: boolean;
    root: string;
    revision: string;
  };
  checkpoints: {
    directory: string;
    installed: boolean;
    missing_files: string[];
  };
  settings: {
    default_voice: string;
    language: 'English';
  };
  available_voices: string[];
}

export interface OpenVoiceTestResult {
  result: {
    status: string;
    voice: string;
    storage_key: string;
  };
  audio_base64: string;
  content_type: string;
}

export const profileApi = {
  getOpenVoiceStatus() {
    return agencyApiClient.get<OpenVoiceStatus>('/setup/openvoice');
  },

  updateOpenVoiceSettings(defaultVoice: string) {
    return agencyApiClient.put<OpenVoiceStatus>('/setup/openvoice', {
      default_voice: defaultVoice,
    });
  },

  installOpenVoiceCheckpoints(force = false) {
    return agencyApiClient.post<OpenVoiceStatus>(
      '/setup/openvoice/install',
      { force },
      { timeoutMs: 700_000 }
    );
  },

  testOpenVoice() {
    return agencyApiClient.post<OpenVoiceTestResult>(
      '/setup/openvoice/test',
      {},
      { timeoutMs: 360_000 }
    );
  },

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
      title: 'Automation keys',
      managedByBackend: true,
      readSupported: true,
      writeSupported: true,
      plannedRoutes: ['/api-tokens', '/api-tokens/{token_id}/revoke'],
      message:
        'Automation-key issuance and revocation are backend-owned. Generated keys are shown once and stored only as hashes by the backend.',
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
