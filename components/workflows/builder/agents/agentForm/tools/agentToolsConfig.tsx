import type { WorkflowAgentFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../../library/shadcn/accordion';
import { Alert, AlertDescription, AlertTitle } from '../../../../../library/shadcn/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../../library/shadcn/card';
import { Input } from '../../../../../library/shadcn/input';
import { Label } from '../../../../../library/shadcn/label';
import FormHeader from '../../../../../form-header/FormHeader';
import { Checkbox } from '../../../../../library/shadcn/checkbox';

export default function AgentToolsConfig() {
  const { watch, register, setValue, formState: { errors } } = useFormContext<WorkflowAgentFormData>();
  const agentTools = watch('tool_configs') || [];

  // Helper function to get error message for a specific field
  const getErrorMessage = (toolIndex: number, key: string) => {
    const error = errors?.tool_configs?.[toolIndex]?.parameters?.[key];
    return error?.message as string | undefined;
  };

  return (
    <>
      <FormHeader title="Tools Configuration" description="Configure each tool's parameters" />
      <Accordion type="single" collapsible className="w-full">
        {agentTools.map((agentTool, toolIndex) => (
          <AccordionItem key={agentTool.id} value={agentTool.id} className="border-none">
            <AccordionTrigger className="hover:no-underline text-caption-1">
              {agentTool.name}
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader>
                  <CardTitle className="text-p">{agentTool.name}</CardTitle>
                  <CardDescription className="text-caption-2">
                    {agentTool.description}
                    <div>Created by: {agentTool.created_by}</div>
                    <div>Owned by: {agentTool.owned_by}</div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(() => {
                    const entries = Object.entries(agentTool.parameters); // Converts { key: value } to [ [key, value] ]
                    return entries.length === 0 ? (
                      <Alert>
                        <AlertTitle>No parameters specified</AlertTitle>
                        <AlertDescription>
                          This tool has no parameters to configure.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      entries.map(([key]) => {
                        const inputName = `tool_configs.${toolIndex}.parameters.${key}` as const;
                        const metadata = agentTool.parameters_metadata?.[key] ?? {};
                        const isRequired = metadata.mandatory;
                        const isFileUpload = metadata.file_upload;
                        const inputType = metadata.input_type;
                        const allowedFileTypes =
                          typeof metadata.file_type === 'string'
                            ? metadata.file_type.split(',').map((type: string) => type.trim())
                            : [];
                        const errorMessage = getErrorMessage(toolIndex, key);
                        const currentValue = watch(inputName) || agentTool.parameters[key] || '';
                        const initialFileValue = agentTool.parameters[key];
                        return (
                          inputType !== 'hidden' ? (
                              <div key={key} className="space-y-1">
                                <Label htmlFor={key}>
                                  {key}
                                  <span
                                    className="italic font-normal text-caption-2 text-muted-foreground">
                                {isRequired ? (
                                  <span className="text-destructive"> (Required)</span>
                                ) : (
                                  <span className="text-muted-foreground"> (Optional)</span>
                                )}
                              </span>
                                </Label>
                                {isFileUpload ? (
                                  <div className="space-y-2">
                                    {/* Show current file name if it exists */}
                                    {initialFileValue && (
                                      <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      Current file: {String(initialFileValue).split(/[\/\\]/).pop()}
                                    </span>
                                      </div>
                                    )}
                                    <Input
                                      id={inputName}
                                      type="file"
                                      accept={allowedFileTypes.join(',')}
                                      className={errorMessage ? 'border-destructive' : ''}
                                      {...register(inputName, {
                                        validate: (value: unknown) => {
                                          if (isRequired && !value) {
                                            return 'This field is required';
                                          }

                                          // Get the file input element
                                          const fileInput = document.querySelector(
                                            `input[name="tool_configs.${toolIndex}.parameters.${key}"]`,
                                          ) as HTMLInputElement;

                                          // If there's a file selected, validate its type
                                          if (fileInput?.files?.[0]) {
                                            const file = fileInput.files[0];

                                            // Validate file size (10MB limit)
                                            if (file.size > 10 * 1024 * 1024) {
                                              return 'File size must be less than 10MB';
                                            }

                                            // Validate file type if specific types are allowed
                                            if (allowedFileTypes.length) {
                                              const fileExtension = file.name.split('.').pop()?.toLowerCase();
                                              const normalizedAllowedTypes = allowedFileTypes.map((type: string) =>
                                                type.toLowerCase().replace('.', ''),
                                              );

                                              if (!normalizedAllowedTypes.includes(fileExtension || ''))
                                                return `Invalid file type. Allowed types: ${allowedFileTypes}`;
                                            }
                                          }

                                          return true;
                                        },
                                      })}
                                    />
                                  </div>
                                ) : inputType === 'checkbox' ? (
                                  <Checkbox
                                    id={inputName}
                                    checked={currentValue === 'true'}
                                    onCheckedChange={(checked) => {
                                      setValue(inputName, checked ? 'true' : 'false', {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                      });
                                    }}
                                  />
                                ) : (
                                  <Input
                                    id={inputName}
                                    type={inputType}
                                    className={errorMessage ? 'border-destructive' : ''}
                                    value={currentValue}
                                    onChange={(e) => {
                                      setValue(inputName, e.target.value, {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                      });
                                    }}
                                  />
                                )}
                                {errorMessage && (
                                  <p className="text-sm text-destructive mt-1">
                                    {errorMessage}
                                  </p>
                                )}
                              </div>
                            ) :
                            <div key={key} className="space-y-1">
                              <Alert>
                                <AlertTitle>Parameters predefined</AlertTitle>
                                <AlertDescription>
                                  This tool&apos;s parameters have been predefined by agency.
                                </AlertDescription>
                              </Alert>
                            </div>
                        );
                      })
                    );
                  })()}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
