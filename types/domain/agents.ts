import { z } from 'zod';
import { Tool } from './tool';

export const AgentBaseSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  role: z.string(),
  goal: z.string(),
  backstory: z.string(),
  temperature: z.number().min(0).max(1).nullish(),
  cache: z.boolean().nullish(),
  verbose: z.boolean().nullish(),
  allow_delegation: z.boolean().nullish(),
  agentTools: z.array(z.custom<AgentTools>()).nullish(),
  max_iter: z.number().nullish(),
  llm: z.string().nullish(),
  step_callback: z.any().nullish(),
  created_by: z.string().nullish(),
  crewId: z.string().nullish(),
});

export type Agent = z.infer<typeof AgentBaseSchema>;

export interface AgentTools extends Tool {
  parameters: {
    [key: string]: string;
  };
}
