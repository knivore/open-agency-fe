import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../library/shadcn/dialog';
import { Button } from '../../../../library/shadcn/button';
import type { BehaviorTuningProfile } from '@/types/agents';
import type { WorkflowAgentFormData, WorkflowAgentLlmOverride } from '@/types/workflows';
import {
  AlertCircle,
  CheckCircle,
  Cpu,
  Thermometer,
  UserCircle,
  Wrench,
  Target,
  Edit,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../library/shadcn/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../library/shadcn/accordion';
import { Input } from '../../../../library/shadcn/input';
import { Label } from '../../../../library/shadcn/label';
import { Alert, AlertDescription, AlertTitle } from '../../../../library/shadcn/alert';
import { Checkbox } from '../../../../library/shadcn/checkbox';
import { useForm, FormProvider, Path, useWatch } from 'react-hook-form';
import { ScrollArea } from '../../../../library/shadcn/scroll-area';
import { DialogDescription } from '@radix-ui/react-dialog';
import { behaviorProfilesApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';

const DEFAULT_LLM_OVERRIDE: WorkflowAgentLlmOverride = {
  provider: 'ollama',
  model: '',
  base_url: 'http://host.docker.internal:11434/v1',
  api_key: 'ollama',
};

function normalizeOverride(
  value: Partial<WorkflowAgentLlmOverride> | null | undefined
): WorkflowAgentLlmOverride {
  return {
    provider: value?.provider ?? DEFAULT_LLM_OVERRIDE.provider,
    model: value?.model ?? DEFAULT_LLM_OVERRIDE.model,
    base_url: value?.base_url ?? DEFAULT_LLM_OVERRIDE.base_url,
    api_key: value?.api_key ?? DEFAULT_LLM_OVERRIDE.api_key,
  };
}

interface AgentToolConfigCardProps {
  agent: WorkflowAgentFormData;
  onSave?: (updatedAgent: WorkflowAgentFormData) => void;
  onConfigChange?: (configured: boolean) => void;
}

export interface AgentToolConfigCardRef {
  getConfig: () => WorkflowAgentFormData;
}

const AgentToolConfigCard = forwardRef<AgentToolConfigCardRef, AgentToolConfigCardProps>(
  ({ agent, onSave, onConfigChange }, ref) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isAdvance, setIsAdvance] = useState<boolean>(false);
    const { data: behaviorProfiles = [] } = useQuery<BehaviorTuningProfile[]>({
      queryKey: queryKeys.backendBehaviorProfiles(),
      queryFn: () => behaviorProfilesApi.listProfiles(),
    });

    const methods = useForm<WorkflowAgentFormData>({
      defaultValues: {
        ...agent,
        llm_override: agent.llm_override ?? null,
        tool_configs: agent.tool_configs?.map((tool) => ({
          ...tool,
          parameters: Object.fromEntries(
            Object.entries(tool.parameters || {}).map(([key, value]) => {
              const metadata = tool.parameters_metadata?.[key];
              if (metadata?.input_type === 'hidden') {
                return [key, value];
              }
              return [key, ''];
            })
          ),
        })),
      },
    });

    const {
      register,
      handleSubmit,
      setValue,
      control,
      formState: { errors, isDirty },
    } = methods;

    const formValues = useWatch({
      control,
    });
    const hasDirectLlmOverride = Boolean(formValues?.llm_override);

    const needsConfiguration = useCallback((): boolean => {
      if (!agent.tool_configs || agent.tool_configs.length === 0) return false;

      return agent.tool_configs.some((tool, toolIndex) => {
        if (!tool?.parameters || !tool?.parameters_metadata) return false;

        const allParamsHidden =
          Object.keys(tool.parameters).length > 0 &&
          Object.keys(tool.parameters).every(
            (key) => tool.parameters_metadata?.[key]?.input_type === 'hidden'
          );
        if (allParamsHidden) return false;

        const agentToolsValues = formValues?.tool_configs ?? [];
        const toolValues = agentToolsValues[toolIndex]?.parameters || {};

        return Object.keys(tool.parameters).some((key) => {
          const metadata = tool.parameters_metadata?.[key];
          if (!metadata) return false;
          return (
            metadata.mandatory &&
            metadata.input_type !== 'hidden' &&
            !(toolValues[key] && toolValues[key].toString().trim())
          );
        });
      });
    }, [agent.tool_configs, formValues?.tool_configs]);

    useEffect(() => {
      if (onConfigChange) {
        const isConfigured = !needsConfiguration();
        onConfigChange(isConfigured);
      }
    }, [needsConfiguration, onConfigChange]);

    useImperativeHandle(ref, () => ({
      getConfig: () => methods.getValues(),
    }));

    const getErrorMessage = (toolIndex: number, key: string): string | undefined => {
      const error = errors?.tool_configs?.[toolIndex]?.parameters?.[key];
      return error?.message as string | undefined;
    };

    const handleOpenChange = (open: boolean) => {
      if (!open && isDirty) {
        console.log('Agent Runtime Configuration:', formValues);
      }
      setIsOpen(open);
    };

    const toggleDirectLlmOverride = (enabled: boolean) => {
      setValue('llm_override', enabled ? normalizeOverride(formValues?.llm_override) : null, {
        shouldDirty: true,
        shouldTouch: true,
      });
    };

    const hasToolConfiguration = Boolean(agent.tool_configs && agent.tool_configs.length > 0);

    const onSubmit = (data: WorkflowAgentFormData) => {
      if (onSave) {
        onSave(data);
      }
      setIsOpen(false);
    };

    return (
      <FormProvider {...methods}>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full text-left justify-start flex flex-col h-auto p-4"
            >
              <div className="w-full relative">
                <span className="block whitespace-normal break-words pr-8">
                  <span className="font-semibold truncate block">{agent.role}</span>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 overflow-hidden text-ellipsis">
                    {agent.instructions}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Profile: {agent.model_profile_id || 'workflow default'}
                    {hasDirectLlmOverride ? ' | direct LLM override enabled' : ''}
                  </p>
                </span>
                {needsConfiguration() ? (
                  <AlertCircle className="text-red-500 absolute right-2 top-1" size={14} />
                ) : (
                  <CheckCircle className="text-green-500 absolute right-2 top-1" size={14} />
                )}
              </div>
            </Button>
          </DialogTrigger>

          <DialogContent
            className={`${
              isAdvance ? 'max-w-[60vw] w-[60vw]' : 'max-w-xl'
            } p-0 h-[90vh] flex flex-col`}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
              <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle className="text-xl truncate">
                  {agent.role} {agent.name && `(${agent.name})`}
                </DialogTitle>
                <DialogDescription>Configure tools for {agent.role}</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-5">
                    <Card className="border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="truncate">Agent Instructions</span>
                        </CardTitle>
                        <CardDescription className="break-words whitespace-normal">
                          {agent.instructions}
                        </CardDescription>
                      </CardHeader>
                    </Card>

                    <Card className="border shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="truncate">LLM Runtime Override</span>
                        </CardTitle>
                        <CardDescription>
                          Override the saved model profile or inject a direct
                          Ollama/OpenAI-compatible LLM for this run only.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="runtime-model-profile">Model profile for this run</Label>
                          <select
                            id="runtime-model-profile"
                            value={formValues?.model_profile_id ?? ''}
                            onChange={(event) => {
                              setValue('model_profile_id', event.target.value || null, {
                                shouldDirty: true,
                                shouldTouch: true,
                              });
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Use workflow default</option>
                            {behaviorProfiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name} ({profile.model})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Saved agent profile: {agent.model_profile_id || 'none'}
                          </p>
                        </div>

                        <div className="rounded-md border border-dashed p-4 space-y-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="direct-llm-override"
                              checked={hasDirectLlmOverride}
                              onCheckedChange={(checked) =>
                                toggleDirectLlmOverride(Boolean(checked))
                              }
                            />
                            <div className="space-y-1">
                              <Label htmlFor="direct-llm-override" className="text-sm font-medium">
                                Use direct LLM override
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Intended for cases like Ollama where you want to inject model and
                                base URL without changing saved workflow settings.
                              </p>
                            </div>
                          </div>

                          {hasDirectLlmOverride ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label htmlFor="llm-provider">Provider</Label>
                                <select
                                  id="llm-provider"
                                  value={
                                    formValues?.llm_override?.provider ??
                                    DEFAULT_LLM_OVERRIDE.provider
                                  }
                                  onChange={(event) => {
                                    const provider = event.target
                                      .value as WorkflowAgentLlmOverride['provider'];
                                    const currentModel = formValues?.llm_override?.model ?? '';
                                    setValue(
                                      'llm_override',
                                      {
                                        provider,
                                        model: currentModel,
                                        base_url:
                                          provider === 'ollama'
                                            ? 'http://host.docker.internal:11434/v1'
                                            : (formValues?.llm_override?.base_url ?? ''),
                                        api_key:
                                          provider === 'ollama'
                                            ? 'ollama'
                                            : (formValues?.llm_override?.api_key ?? ''),
                                      },
                                      { shouldDirty: true, shouldTouch: true }
                                    );
                                  }}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="ollama">Ollama</option>
                                  <option value="openai_compatible">OpenAI-compatible</option>
                                  <option value="openai">OpenAI</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor="llm-model">Model</Label>
                                <Input
                                  id="llm-model"
                                  value={formValues?.llm_override?.model ?? ''}
                                  onChange={(event) => {
                                    setValue(
                                      'llm_override',
                                      normalizeOverride({
                                        ...formValues?.llm_override,
                                        model: event.target.value,
                                      }),
                                      { shouldDirty: true, shouldTouch: true }
                                    );
                                  }}
                                  placeholder="llama3.2 or openai/llama3.2"
                                />
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="llm-base-url">Base URL</Label>
                                <Input
                                  id="llm-base-url"
                                  value={formValues?.llm_override?.base_url ?? ''}
                                  onChange={(event) => {
                                    setValue(
                                      'llm_override',
                                      normalizeOverride({
                                        ...formValues?.llm_override,
                                        base_url: event.target.value,
                                      }),
                                      { shouldDirty: true, shouldTouch: true }
                                    );
                                  }}
                                  placeholder="http://host.docker.internal:11434/v1"
                                />
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="llm-api-key">API key</Label>
                                <Input
                                  id="llm-api-key"
                                  value={formValues?.llm_override?.api_key ?? ''}
                                  onChange={(event) => {
                                    setValue(
                                      'llm_override',
                                      normalizeOverride({
                                        ...formValues?.llm_override,
                                        api_key: event.target.value,
                                      }),
                                      { shouldDirty: true, shouldTouch: true }
                                    );
                                  }}
                                  placeholder="ollama"
                                />
                                <p className="text-xs text-muted-foreground">
                                  CrewAI&apos;s current docs recommend `api_key=&quot;ollama&quot;`
                                  with an OpenAI-compatible Ollama base URL. In Docker-based local
                                  dev, `host.docker.internal:11434/v1` usually reaches the host
                                  Ollama process.
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>

                    {hasToolConfiguration && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="truncate">Tools Configuration</span>
                          </CardTitle>
                          <CardDescription>Configure each tool&apos;s parameters</CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-visible">
                          <Accordion type="single" collapsible className="w-full">
                            {agent.tool_configs.map((tool, toolIndex) => {
                              const agentToolsValues = formValues?.tool_configs ?? [];
                              const toolValues = agentToolsValues[toolIndex]?.parameters || {};

                              const allParamsHidden =
                                Object.keys(tool.parameters || {}).length > 0 &&
                                Object.keys(tool.parameters || {}).every(
                                  (key) => tool.parameters_metadata?.[key]?.input_type === 'hidden'
                                );

                              const toolIcon = (() => {
                                const allParamsHidden =
                                  Object.keys(tool.parameters || {}).length > 0 &&
                                  Object.keys(tool.parameters || {}).every(
                                    (key) =>
                                      tool.parameters_metadata?.[key]?.input_type === 'hidden'
                                  );
                                if (allParamsHidden)
                                  return <CheckCircle className="text-green-500" size={14} />;

                                const hasMissingRequired = Object.keys(tool.parameters || {}).some(
                                  (key) => {
                                    const metadata = tool.parameters_metadata?.[key];
                                    if (!metadata) return false;
                                    return (
                                      metadata.mandatory &&
                                      metadata.input_type !== 'hidden' &&
                                      !(toolValues[key] && toolValues[key].toString().trim())
                                    );
                                  }
                                );

                                if (hasMissingRequired) {
                                  return <AlertCircle className="text-red-500" size={14} />;
                                }

                                const hasOptional = Object.keys(tool.parameters || {}).some(
                                  (key) => {
                                    const metadata = tool.parameters_metadata?.[key];
                                    if (!metadata) return false;
                                    return (
                                      !metadata.mandatory &&
                                      metadata.input_type !== 'hidden' &&
                                      !(toolValues[key] && toolValues[key].toString().trim())
                                    );
                                  }
                                );

                                return hasOptional ? (
                                  <Edit className="text-yellow-500" size={14} />
                                ) : (
                                  <CheckCircle className="text-green-500" size={14} />
                                );
                              })();

                              return (
                                <AccordionItem
                                  key={tool.id || toolIndex}
                                  value={tool.id || `tool-${toolIndex}`}
                                  className="border-b"
                                >
                                  <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                      {/* WorkflowAgentToolConfig.name is the FE display label derived from ToolDefinition.display_name. */}
                                      <span className="truncate mr-2">{tool.name}</span>
                                      {toolIcon}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="overflow-visible">
                                    <div className="py-2 space-y-4">
                                      <p className="text-sm text-muted-foreground break-words whitespace-normal">
                                        {tool.description}
                                      </p>
                                      {!tool.parameters ||
                                      Object.keys(tool.parameters).length === 0 ? (
                                        <Alert>
                                          <AlertTitle>No parameters specified</AlertTitle>
                                          <AlertDescription>
                                            This tool has no parameters to configure.
                                          </AlertDescription>
                                        </Alert>
                                      ) : allParamsHidden ? (
                                        <Alert>
                                          <AlertTitle>Parameters predefined</AlertTitle>
                                          <AlertDescription>
                                            This tool&apos;s parameters have been predefined.
                                          </AlertDescription>
                                        </Alert>
                                      ) : (
                                        <div className="space-y-3">
                                          {Object.entries(tool.parameters || {}).map(([key]) => {
                                            const metadata = tool.parameters_metadata?.[key] || {
                                              mandatory: false,
                                              input_type: 'text',
                                            };

                                            if (metadata.input_type === 'hidden') {
                                              return null;
                                            }

                                            const inputName = `tool_configs.${toolIndex}.parameters.${key}`;
                                            const isRequired = metadata.mandatory;
                                            const isFileUpload = metadata.file_upload;
                                            const inputType = metadata.input_type || 'text';
                                            const allowedFileTypes = metadata.file_type
                                              ? String(metadata.file_type)
                                                  .split(',')
                                                  .map((type: string) => type.trim())
                                              : [];
                                            const errorMessage = getErrorMessage(toolIndex, key);
                                            const currentValue =
                                              toolValues[key] || tool.parameters[key] || '';

                                            return (
                                              <div key={key} className="space-y-1">
                                                <Label
                                                  htmlFor={`tool-${toolIndex}-${key}`}
                                                  className="inline-flex items-center flex-wrap"
                                                >
                                                  <span className="truncate mr-1">{key}</span>
                                                  <span className="italic font-normal text-xs text-muted-foreground whitespace-nowrap">
                                                    {isRequired ? ' (Required)' : ' (Optional)'}
                                                  </span>
                                                </Label>
                                                {isFileUpload ? (
                                                  <div className="space-y-2">
                                                    {tool.parameters[key] && (
                                                      <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="text-sm text-muted-foreground truncate">
                                                          Current file:{' '}
                                                          {String(tool.parameters[key])
                                                            .split(/[\/\\]/)
                                                            .pop()}
                                                        </span>
                                                      </div>
                                                    )}
                                                    <Input
                                                      id={`tool-${toolIndex}-${key}`}
                                                      type="file"
                                                      accept={allowedFileTypes.join(',')}
                                                      className={`${errorMessage ? 'border-destructive' : ''} text-ellipsis`}
                                                      {...register(
                                                        inputName as Path<WorkflowAgentFormData>,
                                                        {
                                                          validate: (value: unknown) => {
                                                            if (
                                                              isRequired &&
                                                              !value &&
                                                              !tool.parameters[key]
                                                            ) {
                                                              return 'This field is required';
                                                            }
                                                            const fileInput =
                                                              document.querySelector(
                                                                `input[id="tool-${toolIndex}-${key}"]`
                                                              ) as HTMLInputElement;
                                                            if (fileInput?.files?.[0]) {
                                                              const file = fileInput.files[0];
                                                              if (file.size > 10 * 1024 * 1024) {
                                                                return 'File size must be less than 10MB';
                                                              }
                                                              if (allowedFileTypes.length) {
                                                                const fileExtension = file.name
                                                                  .split('.')
                                                                  .pop()
                                                                  ?.toLowerCase();
                                                                const normalizedAllowedTypes: string[] =
                                                                  allowedFileTypes.map(
                                                                    (type: string) =>
                                                                      type
                                                                        .toLowerCase()
                                                                        .replace('.', '')
                                                                  );
                                                                if (
                                                                  !normalizedAllowedTypes.includes(
                                                                    fileExtension || ''
                                                                  )
                                                                )
                                                                  return `Invalid file type. Allowed types: ${allowedFileTypes}`;
                                                              }
                                                            }
                                                            return true;
                                                          },
                                                        }
                                                      )}
                                                    />
                                                  </div>
                                                ) : inputType === 'checkbox' ? (
                                                  <Checkbox
                                                    id={`tool-${toolIndex}-${key}`}
                                                    checked={currentValue === 'true'}
                                                    onCheckedChange={(checked) => {
                                                      setValue(
                                                        inputName as Path<WorkflowAgentFormData>,
                                                        checked ? 'true' : 'false',
                                                        {
                                                          shouldDirty: true,
                                                          shouldTouch: true,
                                                        }
                                                      );
                                                    }}
                                                  />
                                                ) : (
                                                  <Input
                                                    id={`tool-${toolIndex}-${key}`}
                                                    type={inputType}
                                                    className={
                                                      errorMessage ? 'border-destructive' : ''
                                                    }
                                                    {...register(
                                                      inputName as Path<WorkflowAgentFormData>,
                                                      {
                                                        required: isRequired
                                                          ? 'This field is required'
                                                          : false,
                                                      }
                                                    )}
                                                  />
                                                )}
                                                {errorMessage && (
                                                  <p className="text-sm text-destructive mt-1 break-words">
                                                    {errorMessage}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </CardContent>
                      </Card>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-sm"
                      onClick={() => setIsAdvance(!isAdvance)}
                    >
                      {isAdvance ? 'Hide agent details' : 'Show agent details'}
                    </Button>

                    {isAdvance && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <UserCircle className="h-4 w-4 text-primary-600 shrink-0" />
                            <span className="truncate">Agent Details</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Backstory</Label>
                            <p className="text-sm text-muted-foreground break-words whitespace-normal">
                              {agent.backstory}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-medium flex items-center gap-1">
                              <Thermometer className="h-4 w-4 text-red-400 shrink-0" />
                              Temperature
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {agent.temperature ?? 'Not specified'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Run-time override summary</Label>
                            <p className="text-sm text-muted-foreground break-words whitespace-normal">
                              Profile: {formValues?.model_profile_id || 'workflow default'}
                            </p>
                            <p className="text-sm text-muted-foreground break-words whitespace-normal">
                              Direct LLM:{' '}
                              {formValues?.llm_override
                                ? `${formValues.llm_override.provider} / ${formValues.llm_override.model || 'unset model'}`
                                : 'disabled'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </FormProvider>
    );
  }
);

AgentToolConfigCard.displayName = 'AgentToolConfigCard';

export default AgentToolConfigCard;
