export interface Tool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  owned_by: string;
  parameters_metadata?: unknown | null;
}
