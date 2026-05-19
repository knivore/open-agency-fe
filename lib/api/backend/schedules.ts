import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  CrudListResponse,
  DeleteResponse,
  ScheduleDefinition,
  ScheduleTriggerNowResponse,
} from '@/lib/api/backend/types';

export const schedulesApi = {
  listSchedules() {
    return agencyApiClient.get<CrudListResponse<ScheduleDefinition>>(backendRoutes.schedules.list());
  },
  getSchedule(scheduleId: string) {
    return agencyApiClient.get<ScheduleDefinition>(backendRoutes.schedules.byId(scheduleId));
  },
  createSchedule(payload: Record<string, unknown>) {
    return agencyApiClient.post<ScheduleDefinition>(backendRoutes.schedules.create(), payload);
  },
  patchSchedule(scheduleId: string, patch: Record<string, unknown>) {
    return agencyApiClient.patch<ScheduleDefinition>(backendRoutes.schedules.byId(scheduleId), patch);
  },
  updateSchedule(scheduleId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ScheduleDefinition>(backendRoutes.schedules.byId(scheduleId), patch);
  },
  enableSchedule(scheduleId: string) {
    return agencyApiClient.post<ScheduleDefinition>(backendRoutes.schedules.enable(scheduleId), {});
  },
  disableSchedule(scheduleId: string) {
    return agencyApiClient.post<ScheduleDefinition>(backendRoutes.schedules.disable(scheduleId), {});
  },
  triggerNow(scheduleId: string) {
    return agencyApiClient.post<ScheduleTriggerNowResponse>(backendRoutes.schedules.triggerNow(scheduleId), {});
  },
  deleteSchedule(scheduleId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.schedules.byId(scheduleId));
  },
};

