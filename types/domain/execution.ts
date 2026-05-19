import { z } from 'zod';

export const ExecutionBaseSchema = z.object({
  id: z.string().nullish(),
  status_outcome: z.string(),
  start_time: z.string(),
  end_time: z.string().nullish(),
  run_time: z.string().nullish(),
  rating: z.string().nullish(),
  crewId: z.string().nullish(),
});

export type Execution = z.infer<typeof ExecutionBaseSchema>;
