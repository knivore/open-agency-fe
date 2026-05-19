import { useForm } from 'react-hook-form';
import { useState } from 'react';

import { Button } from '../../library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../library/shadcn/dialog';
import MultiTypeInput from '../../react-hook-form/multiTypeInput';

export default function WorkflowRunInputsDialog({
  handleStop,
  isAttemptingKickoff,
  inputsJson,
  isRunning,
  onSubmit,
}: {
  handleStop: () => void;
  isAttemptingKickoff: boolean;
  inputsJson: Record<string, string>;
  isRunning: boolean;
  onSubmit: (inputs: Record<string, string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {isRunning ? (
        <Button className="w-full" variant="destructive" onClick={handleStop}>
          Stop Workflow
        </Button>
      ) : (
        <DialogTrigger asChild>
          <Button className="px-10 w-full" disabled={isAttemptingKickoff}>
            {isAttemptingKickoff ? (
              <>
                <span className="loading loading-spinner loading-sm mr-2"></span>
                Starting Workflow...
              </>
            ) : (
              'Run Workflow'
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Workflow</DialogTitle>
          <DialogDescription>Please provide the required inputs to run the workflow.</DialogDescription>
        </DialogHeader>
        <InputForm
          inputsJson={inputsJson}
          isAttemptingKickoff={isAttemptingKickoff}
          onMutateCallback={(data) => {
            setIsOpen(false);
            onSubmit(data);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

const InputForm = ({
  inputsJson,
  isAttemptingKickoff,
  onMutateCallback,
}: {
  inputsJson: Record<string, string>;
  isAttemptingKickoff: boolean;
  onMutateCallback: (data: Record<string, string>) => void;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: inputsJson,
  });

  const onSubmit = (data: Record<string, string>) => {
    onMutateCallback(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {Object.keys(inputsJson).map((key) => (
        <div key={key}>
          <MultiTypeInput
            error={errors[key]}
            id={key}
            label={key}
            name={key}
            placeholder={inputsJson[key]}
            register={register}
            validation={{
              required: 'This field is required',
            }}
          />
        </div>
      ))}
      <Button type="submit" className="w-full" disabled={isAttemptingKickoff}>
        {isAttemptingKickoff ? (
          <>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            Starting Workflow...
          </>
        ) : (
          'Run Workflow'
        )}
      </Button>
    </form>
  );
};
