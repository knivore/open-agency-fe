import { modelProfilesApi } from '@/lib/api/backend/models';
import { toBehaviorTuningProfile } from '@/lib/api/backend/agentTransforms';
import type { BehaviorTuningProfile } from '@/lib/api/backend/types';

export const behaviorProfilesApi = {
  async listProfiles(): Promise<BehaviorTuningProfile[]> {
    const response = await modelProfilesApi.listProfiles();
    return response.items.map(toBehaviorTuningProfile);
  },
  async getProfile(profileId: string): Promise<BehaviorTuningProfile> {
    return toBehaviorTuningProfile(await modelProfilesApi.getProfile(profileId));
  },
};
