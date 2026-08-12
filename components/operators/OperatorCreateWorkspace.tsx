'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Play,
  RadioTower,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/app-shell/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import { Textarea } from '@/components/library/shadcn/textarea';
import { agentsApi } from '@/lib/api/backend/agents';
import { connectorsApi } from '@/lib/api/backend/connectors';
import { modelProfilesApi } from '@/lib/api/backend/models';
import { operatorsApi } from '@/lib/api/backend/operators';
import { personasApi } from '@/lib/api/backend/personas';
import { toolsApi } from '@/lib/api/backend/tools';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { AgentDefinition } from '@/types/agents';
import type { ConnectorInstallationDefinition, ModelProfileDefinition } from '@/types/integrations';
import type {
  OperatorProposal,
  OperatorResourceBinding,
  OperatorSimulation,
} from '@/types/operators';
import type { PersonaDefinition } from '@/types/personas';
import type { ToolDefinition } from '@/types/tools';
import type { WorkflowDefinition } from '@/types/workflows';
import { DecisionBadge, OperatorQueryState } from './OperatorPrimitives';
import { useOnlineStatus, useOperatorWorkspace } from './useOperatorWorkspace';

const steps = [
  'Responsibility',
  'Capabilities',
  'Triggers',
  'Boundaries',
  'Simulation',
  'Review',
] as const;
type Step = (typeof steps)[number];
type AutonomyMode = 'shadow' | 'advisory' | 'guarded';

export default function OperatorCreateWorkspace() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { workspaceId, selectWorkspace } = useOperatorWorkspace();
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceId);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [description, setDescription] = useState('');
  const [proposal, setProposal] = useState<OperatorProposal | null>(null);
  const [supervisorId, setSupervisorId] = useState('');
  const [personaVersionId, setPersonaVersionId] = useState('');
  const [modelProfileId, setModelProfileId] = useState('');
  const [workflowIds, setWorkflowIds] = useState<string[]>([]);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [heartbeatMinutes, setHeartbeatMinutes] = useState('60');
  const [timezone, setTimezone] = useState('UTC');
  const [activeStart, setActiveStart] = useState('08:00');
  const [activeEnd, setActiveEnd] = useState('18:00');
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('shadow');
  const [maxTokens, setMaxTokens] = useState('4000');
  const [maxCost, setMaxCost] = useState('1');
  const [maxRuntime, setMaxRuntime] = useState('60');
  const [maxActions, setMaxActions] = useState('1');
  const [simulationSignal, setSimulationSignal] = useState(
    'A representative work item has changed and may require attention.'
  );
  const [simulationResult, setSimulationResult] = useState<OperatorSimulation | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgentDefinitions(),
    queryFn: () => agentsApi.listAgents(),
    enabled: Boolean(workspaceId),
  });
  const personasQuery = useQuery({
    queryKey: queryKeys.backendPersonas(),
    queryFn: () => personasApi.listPersonas(),
    enabled: Boolean(workspaceId),
  });
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
    enabled: Boolean(workspaceId),
  });
  const toolsQuery = useQuery({
    queryKey: ['backendTools'],
    queryFn: () => toolsApi.listTools(),
    enabled: Boolean(workspaceId),
  });
  const connectorsQuery = useQuery({
    queryKey: ['connectorInstallations'],
    queryFn: () => connectorsApi.listConnectorInstallations(),
    enabled: Boolean(workspaceId),
  });
  const modelsQuery = useQuery({
    queryKey: ['modelProfiles'],
    queryFn: () => modelProfilesApi.listProfiles(),
    enabled: Boolean(workspaceId),
  });

  const bindings = useMemo<OperatorResourceBinding[]>(() => {
    const items: OperatorResourceBinding[] = [];
    if (supervisorId) items.push(binding('agent', supervisorId, 'supervisor'));
    if (personaVersionId) items.push(binding('persona_version', personaVersionId, 'default'));
    if (modelProfileId) items.push(binding('model_profile', modelProfileId, 'default'));
    workflowIds.forEach((id) => items.push(binding('workflow', id, 'allowed')));
    toolIds.forEach((id) => items.push(binding('tool', id, 'allowed')));
    connectorIds.forEach((id) => items.push(binding('connector_installation', id, 'allowed')));
    return items;
  }, [connectorIds, modelProfileId, personaVersionId, supervisorId, toolIds, workflowIds]);

  const proposalMutation = useMutation({
    mutationFn: () =>
      operatorsApi.proposeFromResponsibility({
        workspace_id: workspaceId,
        name,
        responsibility,
        description: description || null,
      }),
    onSuccess: (result) => {
      setProposal(result);
      setStepIndex(1);
      toast.success('Conservative Operator proposal generated for review.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Proposal generation failed.'),
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!proposal) throw new Error('Generate a responsibility proposal first.');
      const created = await operatorsApi.createOperator({
        ...proposal.operator,
        workspace_id: workspaceId,
        name,
        description: description || null,
        purpose: responsibility,
        supervisor_agent_id: supervisorId,
        default_persona_version_id: personaVersionId || null,
        default_model_profile_id: modelProfileId || null,
        autonomy_policy: { mode: autonomyMode, shadow_mode: autonomyMode === 'shadow' },
        approval_policy: {
          require_approval_for: [
            'external_write',
            'destructive_action',
            'spend',
            'permission_change',
          ],
        },
        budget_policy: {
          max_tokens: positiveNumber(maxTokens, 4000),
          max_cost: positiveNumber(maxCost, 1),
          max_runtime_seconds: positiveNumber(maxRuntime, 60),
          max_iterations: 1,
          max_actions: positiveNumber(maxActions, 1),
          max_notifications: 1,
        },
        // External delivery remains disabled until a channel and its exact policy are explicitly configured.
        delivery_policy: {},
        standing_order: proposal.standing_order,
        resource_bindings: bindings,
      });
      await operatorsApi.createTrigger(workspaceId, created.operator.id, {
        trigger_type: 'heartbeat',
        enabled: true,
        interval_seconds: positiveNumber(heartbeatMinutes, 60) * 60,
        timezone,
        active_hours: { days_of_week: [1, 2, 3, 4, 5], start: activeStart, end: activeEnd },
        priority: 50,
        metadata: { source: 'operator_creation_review' },
      });
      return created;
    },
    onSuccess: async (created) => {
      setDraftId(created.operator.id);
      setStepIndex(4);
      toast.success('Operator draft saved. Run the dry simulation before activation.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendOperators(workspaceId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Operator draft could not be saved.'),
  });
  const simulationMutation = useMutation({
    mutationFn: () => {
      if (!draftId) throw new Error('Save the draft before simulation.');
      return operatorsApi.simulate(workspaceId, draftId, { payload_summary: simulationSignal });
    },
    onSuccess: (result) => {
      setSimulationResult(result);
      setStepIndex(5);
      toast.success('Dry simulation completed. No action was performed or persisted.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Dry simulation failed.'),
  });
  const activateMutation = useMutation({
    mutationFn: () => {
      if (!draftId) throw new Error('Save the draft first.');
      return operatorsApi.activate(workspaceId, draftId);
    },
    onSuccess: async () => {
      setActivated(true);
      toast.success('Operator activated with the reviewed boundaries.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendOperators(workspaceId) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Operator activation failed.'),
  });

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operator creation"
          icon={RadioTower}
          tone="operator"
          title="Create operator"
          description="Describe an ongoing responsibility, then review every capability and boundary before activation."
        />
        <section className="mx-auto max-w-xl border-y border-(--agency-shell-border) py-10">
          <Label htmlFor="operator-workspace">Workspace ID</Label>
          <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
            Operator creation requires explicit workspace authority.
          </p>
          <div className="mt-4 flex gap-2">
            <Input
              id="operator-workspace"
              value={workspaceDraft}
              onChange={(event) => setWorkspaceDraft(event.target.value)}
            />
            <Button
              disabled={!workspaceDraft.trim()}
              onClick={() => selectWorkspace(workspaceDraft)}
            >
              Continue
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const readiness = [
    { label: 'Responsibility proposal reviewed', ready: Boolean(proposal) },
    { label: 'Supervisor explicitly granted', ready: Boolean(supervisorId) },
    {
      label: 'Standing order present',
      ready: Boolean(proposal?.standing_order.instructions.trim()),
    },
    {
      label: 'Budgets and approvals reviewed',
      ready: Boolean(maxTokens && maxCost && maxRuntime && maxActions),
    },
    { label: 'Draft persisted', ready: Boolean(draftId) },
    { label: 'Dry simulation terminal', ready: Boolean(simulationResult) },
  ];
  const canSave = Boolean(proposal && supervisorId && !draftId);
  const canActivate = Boolean(draftId && simulationResult && readiness.every((item) => item.ready));
  const activeStep = steps[stepIndex];

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 mb-2 text-(--agency-shell-muted)"
        >
          <Link href={`/operators?workspace=${encodeURIComponent(workspaceId)}`}>
            <ArrowLeft className="size-4" /> Operators
          </Link>
        </Button>
        <PageHeader
          eyebrow="Operator creation"
          icon={RadioTower}
          tone="operator"
          title="Create operator"
          description="Describe an ongoing responsibility, then review every capability and boundary before activation."
          actions={
            <Button
              variant="outline"
              disabled={!canSave || saveMutation.isPending || !online}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}{' '}
              Save draft
            </Button>
          }
        />
      </div>

      {!online ? (
        <Alert className="border-amber-300/60 bg-amber-50/70 dark:border-amber-300/20 dark:bg-amber-400/10">
          <CircleAlert className="size-4" />
          <AlertTitle>Offline</AlertTitle>
          <AlertDescription>
            Proposal, save, simulation, and activation actions require connectivity.
          </AlertDescription>
        </Alert>
      ) : null}

      <nav
        aria-label="Operator creation steps"
        className="overflow-x-auto border-y border-(--agency-shell-border)"
      >
        <ol className="flex min-w-max">
          {steps.map((step, index) => (
            <li key={step}>
              <button
                type="button"
                disabled={index > stepIndex || Boolean(draftId && index < 4)}
                onClick={() => setStepIndex(index)}
                className={`flex items-center gap-2 border-r border-(--agency-shell-border) px-4 py-3 text-sm ${index === stepIndex ? 'bg-(--agency-active-bg) font-semibold text-primary' : 'text-(--agency-shell-muted)'}`}
              >
                <span className="flex size-5 items-center justify-center rounded-full border text-[0.65rem]">
                  {index < stepIndex ? <Check className="size-3" /> : index + 1}
                </span>
                {step}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          <StepHeader index={stepIndex} title={activeStep} />
          {activeStep === 'Responsibility' ? (
            <ResponsibilityStep
              name={name}
              setName={setName}
              responsibility={responsibility}
              setResponsibility={setResponsibility}
              description={description}
              setDescription={setDescription}
              proposal={proposal}
              pending={proposalMutation.isPending}
              disabled={!online || Boolean(draftId)}
              onGenerate={() => proposalMutation.mutate()}
            />
          ) : null}
          {activeStep === 'Capabilities' ? (
            <CapabilitiesStep
              agents={agentsQuery.data?.items ?? []}
              personas={personasQuery.data?.items ?? []}
              workflows={workflowsQuery.data?.items ?? []}
              tools={toolsQuery.data?.items ?? []}
              connectors={(connectorsQuery.data?.items ?? []).filter(
                (item) => item.status === 'active'
              )}
              models={modelsQuery.data?.items ?? []}
              supervisorId={supervisorId}
              setSupervisorId={setSupervisorId}
              personaVersionId={personaVersionId}
              setPersonaVersionId={setPersonaVersionId}
              modelProfileId={modelProfileId}
              setModelProfileId={setModelProfileId}
              workflowIds={workflowIds}
              setWorkflowIds={setWorkflowIds}
              toolIds={toolIds}
              setToolIds={setToolIds}
              connectorIds={connectorIds}
              setConnectorIds={setConnectorIds}
            />
          ) : null}
          {activeStep === 'Triggers' ? (
            <TriggersStep
              heartbeatMinutes={heartbeatMinutes}
              setHeartbeatMinutes={setHeartbeatMinutes}
              timezone={timezone}
              setTimezone={setTimezone}
              activeStart={activeStart}
              setActiveStart={setActiveStart}
              activeEnd={activeEnd}
              setActiveEnd={setActiveEnd}
            />
          ) : null}
          {activeStep === 'Boundaries' ? (
            <BoundariesStep
              autonomyMode={autonomyMode}
              setAutonomyMode={setAutonomyMode}
              maxTokens={maxTokens}
              setMaxTokens={setMaxTokens}
              maxCost={maxCost}
              setMaxCost={setMaxCost}
              maxRuntime={maxRuntime}
              setMaxRuntime={setMaxRuntime}
              maxActions={maxActions}
              setMaxActions={setMaxActions}
            />
          ) : null}
          {activeStep === 'Simulation' ? (
            <SimulationStep
              draftId={draftId}
              signal={simulationSignal}
              setSignal={setSimulationSignal}
              result={simulationResult}
              pending={simulationMutation.isPending}
              disabled={!online}
              onRun={() => simulationMutation.mutate()}
            />
          ) : null}
          {activeStep === 'Review' ? (
            <ReviewStep
              name={name}
              responsibility={responsibility}
              supervisor={agentsQuery.data?.items.find((item) => item.id === supervisorId)}
              bindings={bindings}
              autonomyMode={autonomyMode}
              heartbeatMinutes={heartbeatMinutes}
              timezone={timezone}
              result={simulationResult}
              activated={activated}
            />
          ) : null}

          <div className="mt-8 flex items-center justify-between border-t border-(--agency-shell-border) pt-5">
            <Button
              variant="outline"
              disabled={stepIndex === 0 || Boolean(draftId && stepIndex <= 4)}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {stepIndex < 3 ? (
              <Button
                disabled={
                  activeStep === 'Responsibility'
                    ? !proposal
                    : activeStep === 'Capabilities'
                      ? !supervisorId
                      : false
                }
                onClick={() => setStepIndex((index) => Math.min(5, index + 1))}
              >
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : null}
            {activeStep === 'Boundaries' ? (
              <Button
                disabled={!canSave || saveMutation.isPending || !online}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}{' '}
                Save draft
              </Button>
            ) : null}
            {activeStep === 'Simulation' ? (
              <Button
                disabled={
                  !draftId || !simulationSignal.trim() || simulationMutation.isPending || !online
                }
                onClick={() => simulationMutation.mutate()}
              >
                {simulationMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}{' '}
                Run dry simulation
              </Button>
            ) : null}
            {activeStep === 'Review' && !activated ? (
              <Button
                variant="brand"
                disabled={!canActivate || activateMutation.isPending || !online}
                onClick={() => activateMutation.mutate()}
              >
                {activateMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}{' '}
                Activate operator
              </Button>
            ) : null}
            {activeStep === 'Review' && activated && draftId ? (
              <Button asChild variant="brand">
                <Link href={`/operators/${draftId}?workspace=${encodeURIComponent(workspaceId)}`}>
                  Supervise operator <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </main>

        <aside className="sticky top-24 border-y border-(--agency-shell-border) xl:border-l xl:pl-6">
          <section className="py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
              Activation readiness
            </p>
            <div className="mt-3 space-y-3">
              {readiness.map((item) => (
                <div key={item.label} className="flex gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${item.ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200' : 'bg-muted text-(--agency-shell-muted)'}`}
                  >
                    {item.ready ? <Check className="size-3" /> : <Clock3 className="size-3" />}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-(--agency-shell-border) py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
              Authority summary
            </p>
            <p className="mt-2 text-sm leading-6">
              {bindings.length} explicit resource grant(s). External delivery is disabled. External
              writes, destructive actions, spend, and permission changes require approval.
            </p>
          </section>
          {proposal?.review_warnings.map((warning) => (
            <div
              key={warning}
              className="flex gap-2 border-t border-(--agency-shell-border) py-4 text-xs leading-5 text-amber-800 dark:text-amber-200"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function binding(
  resource_type: OperatorResourceBinding['resource_type'],
  resource_id: string,
  role: string
): OperatorResourceBinding {
  return { resource_type, resource_id, role, policy: {}, metadata: {} };
}
function positiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function toggle(items: string[], id: string, checked: boolean) {
  return checked ? [...items, id] : items.filter((item) => item !== id);
}

function StepHeader({ index, title }: { index: number; title: Step }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--agency-page-tone)">
        Step {index + 1} of {steps.length}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
    </div>
  );
}

function ResponsibilityStep(props: {
  name: string;
  setName: (v: string) => void;
  responsibility: string;
  setResponsibility: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  proposal: OperatorProposal | null;
  pending: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Operator name" help="A durable role name, such as Engineering Operator.">
        <Input
          aria-label="Operator name"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          disabled={props.disabled}
        />
      </Field>
      <Field
        label="Ongoing responsibility"
        help="Describe the continuing outcome, evidence of success, and when the Operator should ask for attention."
      >
        <Textarea
          aria-label="Ongoing responsibility"
          rows={8}
          value={props.responsibility}
          onChange={(e) => props.setResponsibility(e.target.value)}
          disabled={props.disabled}
          placeholder="Monitor approved engineering work, identify actionable changes, and prepare bounded draft outcomes…"
        />
      </Field>
      <Field label="Description (optional)">
        <Input
          aria-label="Description"
          value={props.description}
          onChange={(e) => props.setDescription(e.target.value)}
          disabled={props.disabled}
        />
      </Field>
      <Button
        variant="brand"
        disabled={
          props.disabled || props.pending || !props.name.trim() || !props.responsibility.trim()
        }
        onClick={props.onGenerate}
      >
        {props.pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}{' '}
        Generate conservative proposal
      </Button>
      {props.proposal ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Proposal ready for human review</AlertTitle>
          <AlertDescription>
            No workflows, tools, connectors, or delivery authority were inferred. Continue to grant
            only the capabilities this Operator needs.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function CapabilitiesStep(props: {
  agents: AgentDefinition[];
  personas: PersonaDefinition[];
  workflows: WorkflowDefinition[];
  tools: ToolDefinition[];
  connectors: ConnectorInstallationDefinition[];
  models: ModelProfileDefinition[];
  supervisorId: string;
  setSupervisorId: (v: string) => void;
  personaVersionId: string;
  setPersonaVersionId: (v: string) => void;
  modelProfileId: string;
  setModelProfileId: (v: string) => void;
  workflowIds: string[];
  setWorkflowIds: (v: string[]) => void;
  toolIds: string[];
  setToolIds: (v: string[]) => void;
  connectorIds: string[];
  setConnectorIds: (v: string[]) => void;
}) {
  return (
    <div className="space-y-7">
      <Field
        label="Supervisor agent"
        help="Required. The supervisor is a granted Open Agency Agent, not a second control plane."
      >
        <Select value={props.supervisorId} onValueChange={props.setSupervisorId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an enabled agent" />
          </SelectTrigger>
          <SelectContent>
            {props.agents.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Persona version"
          help="Optional. Only a current approved or published version can be bound."
        >
          <Select
            value={props.personaVersionId || 'none'}
            onValueChange={(v) => props.setPersonaVersionId(v === 'none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No persona</SelectItem>
              {props.personas
                .filter((item) => item.current_version_id)
                .map((item) => (
                  <SelectItem key={item.id} value={item.current_version_id!}>
                    {item.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Model profile"
          help="Optional. Otherwise Open Agency’s model route policy resolves the model."
        >
          <Select
            value={props.modelProfileId || 'none'}
            onValueChange={(v) => props.setModelProfileId(v === 'none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Use router policy</SelectItem>
              {props.models.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <ChoiceList
        title="Allowed workflows"
        items={props.workflows}
        selected={props.workflowIds}
        setSelected={props.setWorkflowIds}
      />
      <ChoiceList
        title="Allowed tools"
        items={props.tools}
        selected={props.toolIds}
        setSelected={props.setToolIds}
      />
      <ChoiceList
        title="Active connector installations"
        items={props.connectors}
        selected={props.connectorIds}
        setSelected={props.setConnectorIds}
      />
    </div>
  );
}

function ChoiceList<T extends { id: string; name: string; description?: string | null }>({
  title,
  items,
  selected,
  setSelected,
}: {
  title: string;
  items: T[];
  selected: string[];
  setSelected: (items: string[]) => void;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <div className="mt-2 divide-y border-y border-(--agency-shell-border)">
          {items.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 py-3">
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={(checked) =>
                  setSelected(toggle(selected, item.id, checked === true))
                }
              />
              <span>
                <span className="block text-sm font-medium">{item.name}</span>
                {item.description ? (
                  <span className="mt-1 block text-xs leading-5 text-(--agency-shell-muted)">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-(--agency-shell-muted)">No eligible resources available.</p>
      )}
    </section>
  );
}

function TriggersStep(props: {
  heartbeatMinutes: string;
  setHeartbeatMinutes: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  activeStart: string;
  setActiveStart: (v: string) => void;
  activeEnd: string;
  setActiveEnd: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Alert>
        <Clock3 className="size-4" />
        <AlertTitle>Heartbeat is contextual awareness</AlertTitle>
        <AlertDescription>
          This periodic wake checks whether useful work exists. Use a precise cron trigger later for
          exact scheduled jobs.
        </AlertDescription>
      </Alert>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Heartbeat interval (minutes)">
          <Input
            type="number"
            min="1"
            value={props.heartbeatMinutes}
            onChange={(e) => props.setHeartbeatMinutes(e.target.value)}
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={props.timezone}
            onChange={(e) => props.setTimezone(e.target.value)}
            placeholder="UTC"
          />
        </Field>
        <Field label="Active-hours start">
          <Input
            type="time"
            value={props.activeStart}
            onChange={(e) => props.setActiveStart(e.target.value)}
          />
        </Field>
        <Field label="Active-hours end">
          <Input
            type="time"
            value={props.activeEnd}
            onChange={(e) => props.setActiveEnd(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-sm leading-6 text-(--agency-shell-muted)">
        The initial trigger is active Monday–Friday inside these hours. Additional message, event,
        cron, or manual triggers can be added after creation.
      </p>
    </div>
  );
}

function BoundariesStep(props: {
  autonomyMode: AutonomyMode;
  setAutonomyMode: (v: AutonomyMode) => void;
  maxTokens: string;
  setMaxTokens: (v: string) => void;
  maxCost: string;
  setMaxCost: (v: string) => void;
  maxRuntime: string;
  setMaxRuntime: (v: string) => void;
  maxActions: string;
  setMaxActions: (v: string) => void;
}) {
  return (
    <div className="space-y-7">
      <Field
        label="Autonomy mode"
        help="Start in shadow mode. Guarded mode still cannot exceed explicit capability grants, policies, approvals, or budgets."
      >
        <Select
          value={props.autonomyMode}
          onValueChange={(v) => props.setAutonomyMode(v as AutonomyMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shadow">Shadow — compare only</SelectItem>
            <SelectItem value="advisory">Advisory — produce guidance</SelectItem>
            <SelectItem value="guarded">Guarded — bounded actions</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Approval boundary</AlertTitle>
        <AlertDescription>
          External writes, destructive actions, spending, and permission changes always require
          approval in this draft. External delivery remains disabled.
        </AlertDescription>
      </Alert>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Maximum tokens">
          <Input
            type="number"
            min="1"
            value={props.maxTokens}
            onChange={(e) => props.setMaxTokens(e.target.value)}
          />
        </Field>
        <Field label="Maximum cost (USD)">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={props.maxCost}
            onChange={(e) => props.setMaxCost(e.target.value)}
          />
        </Field>
        <Field label="Maximum runtime (seconds)">
          <Input
            type="number"
            min="1"
            value={props.maxRuntime}
            onChange={(e) => props.setMaxRuntime(e.target.value)}
          />
        </Field>
        <Field label="Maximum actions">
          <Input
            type="number"
            min="1"
            value={props.maxActions}
            onChange={(e) => props.setMaxActions(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function SimulationStep(props: {
  draftId: string | null;
  signal: string;
  setSignal: (v: string) => void;
  result: OperatorSimulation | null;
  pending: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  if (!props.draftId)
    return (
      <OperatorQueryState
        kind="empty"
        title="Save the draft first"
        description="The simulation uses the persisted definition, real policy snapshot, capability gates, and configured evaluation adapter."
      />
    );
  return (
    <div className="space-y-5">
      <Alert>
        <Play className="size-4" />
        <AlertTitle>Dry simulation cannot dispatch work</AlertTitle>
        <AlertDescription>
          The candidate decision is evaluated, but Open Agency’s authoritative result remains no
          action. No signal or evaluation record is persisted.
        </AlertDescription>
      </Alert>
      <Field label="Representative signal">
        <Textarea rows={6} value={props.signal} onChange={(e) => props.setSignal(e.target.value)} />
      </Field>
      <Button
        variant="brand"
        disabled={props.disabled || props.pending || !props.signal.trim()}
        onClick={props.onRun}
      >
        {props.pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}{' '}
        Run dry simulation
      </Button>
      {props.result ? (
        <div className="border-y border-(--agency-shell-border) py-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="successful">Terminal result</Badge>
            <Badge variant="outline">Not persisted</Badge>
            <Badge variant="outline">No action performed</Badge>
          </div>
          <h3 className="mt-4 font-semibold">Shadow mode comparison</h3>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--agency-shell-muted)">
                Candidate
              </p>
              <div className="mt-2">
                <DecisionBadge decision={props.result.candidate_decision.decision} />
              </div>
              <p className="mt-2 text-sm leading-6">
                {props.result.candidate_decision.rationale_summary}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--agency-shell-muted)">
                Authoritative
              </p>
              <p className="mt-2 font-medium">No action</p>
              <p className="mt-2 text-sm leading-6">{props.result.authoritative_result.reason}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStep({
  name,
  responsibility,
  supervisor,
  bindings,
  autonomyMode,
  heartbeatMinutes,
  timezone,
  result,
  activated,
}: {
  name: string;
  responsibility: string;
  supervisor?: AgentDefinition;
  bindings: OperatorResourceBinding[];
  autonomyMode: AutonomyMode;
  heartbeatMinutes: string;
  timezone: string;
  result: OperatorSimulation | null;
  activated: boolean;
}) {
  return (
    <div className="space-y-6">
      {activated ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Operator activated</AlertTitle>
          <AlertDescription>
            The reviewed definition is now eligible to wake within its triggers, policies, grants,
            approvals, and budgets.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="divide-y border-y border-(--agency-shell-border)">
        <ReviewRow label="Operator" value={name} />
        <ReviewRow label="Responsibility" value={responsibility} />
        <ReviewRow label="Supervisor" value={supervisor?.name ?? 'Missing'} />
        <ReviewRow label="Explicit grants" value={`${bindings.length} resource(s)`} />
        <ReviewRow label="Autonomy" value={autonomyMode} />
        <ReviewRow label="Heartbeat" value={`Every ${heartbeatMinutes} minute(s), ${timezone}`} />
        <ReviewRow label="External delivery" value="Disabled" />
        <ReviewRow
          label="Simulation"
          value={
            result
              ? `${result.candidate_decision.decision.replaceAll('_', ' ')} candidate; authoritative no action`
              : 'Required'
          }
        />
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--agency-shell-muted)">
        {label}
      </p>
      <p className="text-sm leading-6">{value}</p>
    </div>
  );
}
function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      {help ? (
        <p className="mb-2 mt-1 text-xs leading-5 text-(--agency-shell-muted)">{help}</p>
      ) : (
        <div className="h-2" />
      )}
      {children}
    </div>
  );
}
