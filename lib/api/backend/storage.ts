import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';

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
