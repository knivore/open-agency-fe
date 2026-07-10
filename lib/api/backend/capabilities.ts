import { appApiClient } from '@/lib/api/clientInstances';

export interface BackendModuleCapabilities {
  available?: boolean;
  status?: string;
  reason?: string | null;
  displayName?: string;
  canonicalNamespace?: string;
  routePrefix?: string;
  eventRoutePrefix?: string;
  readScopes?: string[];
  writeScopes?: string[];
  frontend?: {
    surfaceKey?: string;
    showWhenAvailable?: boolean;
    hideWhenUnavailable?: boolean;
  };
  hiddenWhenUnavailable?: {
    routePrefixes?: string[];
    toolNames?: string[];
  };
  tools?: {
    preferred?: string[];
    readOnly?: string[];
    mutating?: string[];
    vendorSpecific?: string[];
  };
  notes?: string[];
}

export interface BackendCapabilitiesPayload {
  name: string;
  version: string;
  modules?: {
    smart_home?: BackendModuleCapabilities;
    physical_devices?: BackendModuleCapabilities;
    [moduleKey: string]: BackendModuleCapabilities | undefined;
  };
}

export const backendCapabilitiesApi = {
  getCapabilities() {
    return appApiClient.get<BackendCapabilitiesPayload>('/api/capabilities');
  },
};
