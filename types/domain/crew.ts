import { z } from 'zod';
import { Agent, AgentBaseSchema } from './agents';
import { Task, TaskBaseSchema } from './tasks';
import { UserBaseSchema } from '@/types/users';

export const CrewBaseSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(TaskBaseSchema).optional(),
  agents: z.array(AgentBaseSchema).optional(),
  process: z.string().default('sequential'),
  verbose: z.number().optional(),
  memory: z.boolean().optional(),
  full_output: z.boolean().optional(),
  manager_llm: z.any().optional(),
  manager_agent: AgentBaseSchema.nullable().optional(),
  function_calling_llm: z.any().optional(),
  cache: z.boolean().optional(),
  step_callback: z.any().optional(),
  task_callback: z.any().optional(),
  max_rpm: z.number().optional(),
  output_log_file: z.boolean().optional(),
  created_by: z.string().optional(),
  creator: UserBaseSchema.optional(),
  owned_by: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
  owners: z.array(UserBaseSchema).optional(),
});

export type CrewBase = z.infer<typeof CrewBaseSchema>;

export type Crew = CrewBase & {
  id: string;
};

export interface FullCrew {
  crew: CrewBase;
  agents: Agent[];
  tasks: Task[];
}

export interface IStatus {
  status: string;
  result?: string;
}
