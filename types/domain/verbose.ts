import { z } from 'zod';

export const VerboseBaseSchema = z.object({
  timestamp: z.string(),
  agent_name: z.string(),
  type: z.string(),
});

export const AgentActionSchema = VerboseBaseSchema.extend({
  result: z.string(),
  text: z.string(),
  thought: z.string().nullish(),
  tool: z.string(),
  tool_input: z.string().nullish(),
});

export const AgentFinishSchema = VerboseBaseSchema.extend({
  output: z.string(),
  text: z.string(),
  thought: z.string().nullish(),
});

export const UnknownVerboseSchema = VerboseBaseSchema.extend({
  output: z.string(),
  format: z.string(),
});

export type Verbose = z.infer<typeof VerboseBaseSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type AgentFinish = z.infer<typeof AgentFinishSchema>;
export type UnknownVerbose = z.infer<typeof UnknownVerboseSchema>;
export type VerboseOutput = AgentAction | AgentFinish | Verbose | UnknownVerbose;
