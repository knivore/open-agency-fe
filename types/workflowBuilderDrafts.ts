import { z } from 'zod';
import type { WorkflowToolOption } from '@/types/workflows';

export const WorkflowBuilderAgentSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  role: z.string(),
  instructions: z.string(),
  backstory: z.string(),
  temperature: z.number().min(0).max(1).nullish(),
  allow_delegation: z.boolean().nullish(),
  agentTools: z.array(z.custom<WorkflowBuilderAgentTool>()).nullish(),
  llm: z.string().nullish(),
});

export interface WorkflowBuilderAgentTool extends WorkflowToolOption {
  parameters: {
    [key: string]: string;
  };
}

export interface WorkflowBuilderAgent {
  id?: string | null;
  name: string;
  role: string;
  instructions: string;
  backstory: string;
  temperature?: number | null;
  allow_delegation?: boolean | null;
  agentTools?: WorkflowBuilderAgentTool[] | null;
  llm?: string | null;
}

export const WorkflowBuilderTaskSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  expected_output: z.string(),
  human_input: z.boolean().nullish(),
  agent: z.custom<WorkflowBuilderAgent>().nullish(),
  agentId: z.string().nullish(),
  context: z.array(z.string()).nullish(),
  includeTask: z.boolean().default(true),
});

export interface WorkflowBuilderTask {
  id?: string | null;
  name: string;
  description: string;
  expected_output: string;
  human_input?: boolean | null;
  agent?: WorkflowBuilderAgent | null;
  agentId?: string | null;
  context?: string[] | null;
  includeTask: boolean;
}

export const WorkflowBuilderBaseSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(WorkflowBuilderTaskSchema).optional(),
  agents: z.array(WorkflowBuilderAgentSchema).optional(),
  process: z.string().default('sequential'),
  created_by: z.string().optional(),
  owned_by: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
});

export interface WorkflowBuilderBase {
  id?: string | null;
  name: string;
  description: string;
  tasks?: WorkflowBuilderTask[];
  agents?: WorkflowBuilderAgent[];
  process: string;
  created_by?: string;
  owned_by?: string[];
  inputs?: string[];
}
