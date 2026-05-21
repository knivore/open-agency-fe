export interface WorkflowBuilderAgentTool {
  id: string;
  name: string;
  description: string;
  parameters_metadata?: Record<string, unknown> | null;
  parameters: Record<string, string>;
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
