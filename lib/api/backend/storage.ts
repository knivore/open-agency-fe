import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import type { AuthUser } from '@/types/auth';

export interface PresignedUrlPayload {
  filename: string;
  operation: 'upload' | 'download';
  content_type?: string;
}

export interface PresignedUrlResponse {
  url: string;
}

export const storageApi = {
  getPresignedUrl(payload: PresignedUrlPayload) {
    return agencyApiClient.post<PresignedUrlResponse>(backendRoutes.storage.presigned(), payload);
  },
};

export const backendStorageApi = {
  getPresignedUrl(payload: PresignedUrlPayload, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<PresignedUrlResponse>(backendRoutes.storage.presigned(), payload, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
};
