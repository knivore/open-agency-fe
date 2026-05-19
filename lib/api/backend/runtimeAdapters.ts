import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse, DeleteResponse, RuntimeAdapterDefinition } from '@/lib/api/backend/types';

export const runtimeAdaptersApi = {
  listRuntimeAdapters() {
    return agencyApiClient.get<CrudListResponse<RuntimeAdapterDefinition>>(backendRoutes.runtimeAdapters.list());
  },
  getRuntimeAdapter(adapterId: string) {
    return agencyApiClient.get<RuntimeAdapterDefinition>(backendRoutes.runtimeAdapters.byId(adapterId));
  },
  createRuntimeAdapter(payload: Record<string, unknown>) {
    return agencyApiClient.post<RuntimeAdapterDefinition>(backendRoutes.runtimeAdapters.create(), payload);
  },
  updateRuntimeAdapter(adapterId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<RuntimeAdapterDefinition>(backendRoutes.runtimeAdapters.byId(adapterId), patch);
  },
  deleteRuntimeAdapter(adapterId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.runtimeAdapters.byId(adapterId));
  },
};
