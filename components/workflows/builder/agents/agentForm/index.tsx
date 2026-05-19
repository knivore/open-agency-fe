import type { WorkflowAgentFormData, WorkflowToolOption } from '@/types/workflows';
import { addWorkflowAgent, updateWorkflowAgent, uploadToS3 } from '@/app/api/utils/workflows';
import { toast } from 'sonner';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';

import AgentToolsConfig from './tools/agentToolsConfig';
import AgentToolsSelection from './tools/agentToolsSelection';
import BaseAgentFormFields from './baseAgentFormFields';
import { Button } from '../../../../library/shadcn/button';
import { Separator } from '../../../../library/shadcn/separator';
import AdvanceAgentFormFields from '@/components/workflows/builder/agents/agentForm/advanceAgentFormFields';

interface AgentFormProps {
  mode: 'create' | 'edit';
  workflowId: string;
  agent?: WorkflowAgentFormData;
  tools?: WorkflowToolOption[];
  isAdvance?: boolean;
  onMutateCallback?: () => void;
  onSuccessCallback?: () => void;
  onErrorCallback?: () => void;
  onRewriteField?: (field: 'name' | 'role' | 'instructions' | 'backstory') => Promise<void>;
  isRewriting?: boolean;
  selectedField?: string | null;
}

// Helper function to generate a unique S3 key for the file
function generateS3Key(
  workflowId: string,
  toolId: string,
  parameterKey: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `workflow_${workflowId}/${toolId}/${parameterKey}/${sanitizedFileName}`;
}

export default function AgentForm({
  mode,
  workflowId,
  agent,
  tools = [],
  isAdvance = false,
  onMutateCallback = () => {},
  onSuccessCallback = () => {},
  onErrorCallback = () => {},
  onRewriteField,
  isRewriting = false,
  selectedField = null,
}: AgentFormProps) {
  const queryClient = useQueryClient();
  // Use the methods from the parent FormProvider if available, or create a new form instance
  const parentMethods = useFormContext<WorkflowAgentFormData>();
  const localMethods = useForm<WorkflowAgentFormData>({
    defaultValues:
      mode === 'edit'
        ? {
            ...agent,
            temperature: parseFloat(agent?.temperature?.toString() || '0.5'),
          }
        : {
            name: '',
            role: '',
            instructions: '',
            backstory: '',
            tool_ids: [],
            handoff_agent_ids: [],
            tool_configs: [],
            temperature: 0.5,
          },
  });
  const methods = parentMethods || localMethods;

  const editAgentMutation = useMutation({
    mutationFn: (data: WorkflowAgentFormData) => updateWorkflowAgent(workflowId, data),
  });

  const createAgentMutation = useMutation({
    mutationFn: (data: WorkflowAgentFormData) => addWorkflowAgent(workflowId, data),
  });

  const onSubmit = (formData: WorkflowAgentFormData) => {
    onMutateCallback();

    const data = JSON.parse(JSON.stringify(formData)) as WorkflowAgentFormData;
    data.temperature = parseFloat(formData.temperature?.toString() || '0.5');

    const toolsToProcess = data.tool_configs || [];

    // Process tools and maintain array type
    const updatedTools: typeof toolsToProcess = [...toolsToProcess];

    // Process each tool sequentially
    for (let i = 0; i < updatedTools.length; i++) {
      const tool = updatedTools[i];
      const updatedParameters = { ...tool.parameters };

      // Process each parameter if parameters exist
      if (tool.parameters && tool.parameters_metadata) {
        for (const [key, value] of Object.entries(tool.parameters)) {
          const isFileUpload = tool.parameters_metadata[key]?.file_upload;
          const isInputHidden = tool.parameters_metadata[key]?.input_type === 'hidden';
          const isCloudDirectory = tool.parameters_metadata[key]?.cloud_directory;

          if (isFileUpload && value) {
            const fileInput = document.querySelector(
              `input[name="tool_configs.${i}.parameters.${key}"]`
            ) as HTMLInputElement;

            if (fileInput?.files?.[0]) {
              const file = fileInput.files[0];
              const s3Key = generateS3Key(workflowId, tool.id, key, file.name);

              try {
                uploadToS3(file, s3Key);
                updatedParameters[key] = s3Key;
              } catch (error) {
                console.error('Upload failed:', error);
                toast.error('Failed to upload file');
                return;
              }
            }
          } else if (isInputHidden && isCloudDirectory) {
            // Set the default cloud directory based on the workflow id, BE will append the user id and process id at runtime.
            updatedParameters[key] = `${workflowId}`;
          } else {
            const formToolIndex = formData.tool_configs?.findIndex((t) => t.id === tool.id) ?? -1;
            if (formToolIndex !== -1 && formData.tool_configs?.[formToolIndex]?.parameters) {
              updatedParameters[key] = formData.tool_configs[formToolIndex].parameters[key];
            }
          }
        }
      }

      // Update the tool in the array
      updatedTools[i] = {
        ...tool,
        parameters: updatedParameters,
      };
    }

    const processedData = {
      ...data,
      tool_configs: updatedTools,
      tool_ids: updatedTools.map((tool) => tool.id),
    };

    // Submit the form with processed data
    const mutation = mode === 'create' ? createAgentMutation : editAgentMutation;
    const actionText = mode === 'create' ? 'Creating' : 'Updating';

    toast.promise(mutation.mutateAsync(processedData), {
      loading: `${actionText} agent...`,
      success: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowInputs(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
        onSuccessCallback();
        return `Agent ${mode === 'create' ? 'created' : 'updated'} successfully!`;
      },
      error: () => {
        onErrorCallback();
        return `Failed to ${mode === 'create' ? 'create' : 'update'} agent, please try again.`;
      },
      position: 'top-right',
    });
  };

  const isPending = mode === 'create' ? createAgentMutation.isPending : editAgentMutation.isPending;

  const agentTools = methods.watch('tool_configs') || [];

  // If we already have a FormProvider from the parent, don't wrap in another one
  const content = (
    <form
      onSubmit={methods.handleSubmit(onSubmit)}
      className="grid grid-cols-12 gap-4 h-full px-1"
    >
      <div className="col-span-12 space-y-2">
        <BaseAgentFormFields
          mode={mode}
          agent={agent}
          isAdvance={isAdvance}
          onRewriteField={onRewriteField}
          isRewriting={isRewriting}
          selectedField={selectedField}
        />
      </div>
      {isAdvance && (
        <>
          <div className="col-span-12">
            <Separator />
          </div>
          <div className="col-span-12">
            {isAdvance && <AdvanceAgentFormFields agent={agent} />}
          </div>
          <div className="col-span-12">
            <Separator />
          </div>
          <div className="col-span-12">
            <AgentToolsSelection tools={tools} />
          </div>
          {agentTools.length > 0 && (
            <>
              <div className="col-span-12">
                <Separator />
              </div>
              <div className="col-span-12">
                <AgentToolsConfig />
              </div>
            </>
          )}
        </>
      )}
      <div className="col-span-12">
        <SubmitButton mode={mode} isPending={isPending} />
      </div>
    </form>
  );

  // Only wrap in FormProvider if we're not using a parent FormProvider
  return parentMethods ? content : <FormProvider {...methods}>{content}</FormProvider>;
}

const SubmitButton = ({ mode, isPending }: { mode: 'create' | 'edit'; isPending: boolean }) => {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending
        ? `${mode === 'create' ? 'Creating' : 'Updating'}...`
        : `${mode === 'create' ? 'Create' : 'Update'} Agent`}
    </Button>
  );
};
