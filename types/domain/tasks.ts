import { Agent } from './agents';
import { z } from 'zod';

export const TaskBaseSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  expected_output: z.string(),
  async_execution: z.boolean().nullish(),
  human_input: z.boolean().nullish(),
  agent: z.custom<Agent>().nullish(),
  callback: z.any().nullish(),
  output_json: z.any().nullish(),
  output_pydantic: z.any().nullish(),
  output_file: z.string().nullish(),
  tools: z.array(z.any()).nullish(),
  created_by: z.string().nullish(),
  agentId: z.string().nullish(),
  crewId: z.string().nullish(),
  context: z.array(z.string()).nullish(),
  contextFor: z.array(z.string()).nullish(),
  includeTask: z.boolean().default(true),
});

export const TaskWithContextSchema = TaskBaseSchema.extend({
  usesContextFrom: z.lazy(() => z.array(TaskBaseSchema)).nullish(),
  providesContextTo: z.lazy(() => z.array(TaskBaseSchema)).nullish(),
});

export type Task = z.infer<typeof TaskBaseSchema>;
export type TaskWithContext = z.infer<typeof TaskWithContextSchema>;
