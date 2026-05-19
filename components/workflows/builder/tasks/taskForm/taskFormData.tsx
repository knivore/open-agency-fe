import type { WorkflowTaskFormData } from '@/types/workflows';
import type { UseFormReturn } from 'react-hook-form';

export type { WorkflowTaskFormData as TaskFormData } from '@/types/workflows';

export type TaskFormMethodsRef = UseFormReturn<WorkflowTaskFormData>;
