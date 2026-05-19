import type { WorkflowDefinition, WorkflowEditorFormData } from '@/types/workflows';
import { useState } from 'react';
import WorkflowForm from '@/components/workflows/WorkflowForm';
import { Button } from '../library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../library/shadcn/dialog';
import { VscSettings } from 'react-icons/vsc';

export default function WorkflowSettings({
  workflow,
  isLoading,
  workflowInputs,
}: {
  workflow?: WorkflowDefinition;
  isLoading: boolean;
  workflowInputs: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const workflowFormData: WorkflowEditorFormData | undefined = workflow
    ? {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description ?? '',
        process:
          typeof workflow.metadata?.process === 'string' ? workflow.metadata.process : 'sequential',
        inputs: Array.isArray(workflow.metadata?.inputs)
          ? workflow.metadata.inputs.filter((value): value is string => typeof value === 'string')
          : [],
      }
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="rounded-full bg-white text-gray-800 border border-primary-500 inline-flex items-center gap-1.5 hover:bg-primary-50"
          variant="outline"
        >
          <VscSettings className="h-5 w-5 text-primary-600" />
          <span className="font-medium">Workflow Settings</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="space-y-6">
        <DialogHeader>
          <DialogTitle>Workflow Settings</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          workflowFormData && (
            <WorkflowForm
              mode="edit"
              workflow={workflowFormData}
              workflowInputs={workflowInputs}
              onSuccessCallback={() => {}}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
