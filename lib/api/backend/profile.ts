import { agencyApiClient } from '@/lib/api/clientInstances';

export interface BackendFeatureCapability {
  title: string;
  managedByBackend: boolean;
  readSupported: boolean;
  writeSupported: boolean;
  plannedRoutes: string[];
  message: string;
}

export type TunnelProvider = 'auto' | 'none' | 'ngrok' | 'cloudflare';

export interface TunnelRuntimeControl {
  request_id: string | null;
  state: 'idle' | 'requested' | 'applying' | 'ready' | 'failed';
  provider: TunnelProvider | null;
  requested_at: string | null;
  updated_at: string | null;
  supervisor_updated_at: string | null;
  supervisor_available: boolean;
  message: string | null;
}

export interface PublicEndpointInfo {
  provider: TunnelProvider;
  custom_domain: string | null;
  source: string;
  updated_at: string;
  current_public_url: string | null;
  runtime_control: TunnelRuntimeControl;
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
      runtime_control: payload.runtime_control,
    };
  },

  updatePublicEndpointPreference(
    provider: TunnelProvider,
    customDomain: string | null,
    applyNow: boolean
  ) {
    return agencyApiClient.put<PublicEndpointInfo>('/setup/tunnel-preference', {
      provider,
      custom_domain: customDomain,
      apply_now: applyNow,
    });
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
