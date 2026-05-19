import { ApiError } from '@/lib/api/errors';

export const executionActionsAdapter = {
  async downloadResult(_executionId: string): Promise<never> {
    throw new ApiError({
      status: 501,
      code: 'EXECUTION_DOWNLOAD_UNAVAILABLE',
      message: 'Backend result download is not available on the transformed execution routes yet.',
      details: {
        expectedEndpoint: 'A backend execution artifact download or presigned URL endpoint.',
      },
    });
  },
  async rateResult(_executionId: string, _rating: 'positive' | 'negative'): Promise<never> {
    throw new ApiError({
      status: 501,
      code: 'EXECUTION_RATING_UNAVAILABLE',
      message: 'Backend execution rating is not available on the transformed execution routes yet.',
      details: {
        expectedEndpoint: 'A backend execution feedback endpoint.',
      },
    });
  },
};
