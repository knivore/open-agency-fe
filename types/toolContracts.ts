export type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  default?: unknown;
  enum?: string[];
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
};

export type ToolContract = {
  '@context'?: string | null;
  '@type'?: string | null;
  name: string;
  version: string;
  description?: string | null;
  inputs: JsonSchema;
  outputs: JsonSchema;
};

export type ToolContractListResponse = {
  items: ToolContract[];
};

export type PolicyRuleResult = {
  id: string;
  outcome: 'ok' | 'warn' | 'deny';
  reason?: string | null;
};

export type PolicyVerdict = {
  score: number;
  rules: PolicyRuleResult[];
};

export type FileChanged = {
  path: string;
  op: 'create' | 'modify' | 'delete' | 'rename';
  hunks?: Record<string, unknown>[];
};

export type ToolRunResponse = {
  verdict: 'ok' | 'warn' | 'deny';
  policyVerdict?: PolicyVerdict | null;
  result?: Record<string, unknown> | null;
  patch?: string | null;
  filesChanged: FileChanged[];
  errors: string[];
  dryRun: boolean;
  timestamp: string;
  actor?: string | null;
  signature?: string | null;
};
